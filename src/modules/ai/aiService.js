import { supabase, hasSupabaseConfig } from '../../api/supabaseClient.js';

function requireSupabase() {
  if (!hasSupabaseConfig || !supabase) throw new Error('Supabase 설정이 없습니다.');
  return supabase;
}

function cleanAliases(aliases) {
  const seen = new Set();
  return String(aliases || '')
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase().replace(/\s+/g, '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function fetchAiWorkspace() {
  const client = requireSupabase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [knowledgeRes, unknownRes, logsRes, todayCountRes] = await Promise.all([
    client.from('ai_knowledge_admin')
      .select('id,domain,category,title,content,source_type,source_table,source_key,priority,active,embedding_model,embedding_status,embedding_error,embedded_at,created_by,updated_by,created_at,updated_at,aliases')
      .order('updated_at', { ascending: false })
      .limit(500),
    client.from('ai_unknown_questions')
      .select('id,question,domain,ask_count,status,resolved_knowledge_id,admin_note,first_asked_at,last_asked_at,resolved_at,resolved_by')
      .order('last_asked_at', { ascending: false })
      .limit(300),
    client.from('ai_query_logs')
      .select('id,question,parsed_domain,parsed_intent,resolved_query,result_status,match_count,search_mode,openai_used,cached,top_knowledge_id,confidence,duration_ms,error_message,created_at')
      .order('created_at', { ascending: false })
      .limit(300),
    client.from('ai_query_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
  ]);

  for (const result of [knowledgeRes, unknownRes, logsRes, todayCountRes]) {
    if (result.error) throw result.error;
  }

  const knowledge = knowledgeRes.data || [];
  const unknown = unknownRes.data || [];
  const logs = logsRes.data || [];

  return {
    knowledge,
    unknown,
    logs,
    summary: {
      knowledgeCount: knowledge.length,
      activeKnowledgeCount: knowledge.filter((item) => item.active).length,
      pendingEmbeddingCount: knowledge.filter((item) => item.active && item.embedding_status === 'pending').length,
      unknownOpenCount: unknown.filter((item) => item.status === 'open').length,
      todayQueryCount: todayCountRes.count || 0,
      supabaseQueryCount: logs.filter((item) => item.search_mode === 'supabase_knowledge').length,
      fallbackQueryCount: logs.filter((item) => item.search_mode === 'apps_script_fallback').length,
    },
  };
}

export async function saveKnowledge(values, knowledgeId = null) {
  const client = requireSupabase();
  const auth = await client.auth.getUser();
  const actor = auth.data?.user?.email || 'admin';
  const payload = {
    domain: String(values.domain || 'general').trim() || 'general',
    category: String(values.category || '').trim() || null,
    title: String(values.title || '').trim(),
    content: String(values.content || '').trim(),
    source_type: String(values.source_type || 'manual').trim() || 'manual',
    source_table: String(values.source_table || '').trim() || null,
    source_key: String(values.source_key || '').trim() || null,
    priority: Math.max(-100, Math.min(100, Number(values.priority || 0))),
    active: Boolean(values.active),
    updated_by: actor,
  };

  if (!payload.title || !payload.content) throw new Error('제목과 내용은 필수입니다.');

  let saved;
  if (knowledgeId) {
    const result = await client.from('ai_knowledge')
      .update(payload)
      .eq('id', Number(knowledgeId))
      .select('id')
      .single();
    if (result.error) throw result.error;
    saved = result.data;
  } else {
    const result = await client.from('ai_knowledge')
      .insert({ ...payload, created_by: actor })
      .select('id')
      .single();
    if (result.error) throw result.error;
    saved = result.data;
  }

  const aliases = cleanAliases(values.aliases);
  const deleteResult = await client.from('ai_knowledge_aliases')
    .delete()
    .eq('knowledge_id', saved.id);
  if (deleteResult.error) throw deleteResult.error;

  if (aliases.length) {
    const aliasResult = await client.from('ai_knowledge_aliases').insert(
      aliases.map((alias) => ({ knowledge_id: saved.id, alias, active: true, created_by: actor })),
    );
    if (aliasResult.error) throw aliasResult.error;
  }

  if (values.sourceUnknownId) {
    const resolveResult = await client.from('ai_unknown_questions')
      .update({
        status: 'resolved',
        resolved_knowledge_id: saved.id,
        resolved_at: new Date().toISOString(),
        resolved_by: actor,
        admin_note: String(values.admin_note || '').trim() || null,
      })
      .eq('id', Number(values.sourceUnknownId));
    if (resolveResult.error) throw resolveResult.error;
  }

  return saved.id;
}

export async function setKnowledgeActive(id, active) {
  const client = requireSupabase();
  const result = await client.from('ai_knowledge')
    .update({ active: Boolean(active) })
    .eq('id', Number(id));
  if (result.error) throw result.error;
}

export async function deleteKnowledge(id) {
  const client = requireSupabase();
  const result = await client.from('ai_knowledge').delete().eq('id', Number(id));
  if (result.error) throw result.error;
}

export async function updateUnknownStatus(id, status, adminNote = '') {
  const client = requireSupabase();
  const auth = await client.auth.getUser();
  const actor = auth.data?.user?.email || 'admin';
  const values = {
    status,
    admin_note: String(adminNote || '').trim() || null,
  };
  if (status === 'resolved') {
    values.resolved_at = new Date().toISOString();
    values.resolved_by = actor;
  }
  const result = await client.from('ai_unknown_questions').update(values).eq('id', Number(id));
  if (result.error) throw result.error;
}
