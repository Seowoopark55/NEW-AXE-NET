import { supabase } from '../../api/supabaseClient.js';

async function postShortcutAction(action, payload = {}) {
  const response = await fetch('/api/member-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...payload }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // 공통 오류 처리에서 HTTP 상태를 사용합니다.
  }

  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || `바로가기 요청에 실패했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

function requireAdminClient() {
  if (!supabase) throw new Error('Supabase 설정이 없습니다.');
  return supabase;
}

export async function fetchShortcuts(identity) {
  if (identity?.mode === 'admin') {
    const client = requireAdminClient();
    const { data, error } = await client
      .from('member_shortcuts')
      .select('id,label,target_key,sort_order,created_at,updated_at')
      .eq('member_key', identity.memberKey)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  const data = await postShortcutAction('shortcut_list');
  return Array.isArray(data.shortcuts) ? data.shortcuts : [];
}

export async function saveShortcut(identity, values) {
  if (identity?.mode === 'admin') {
    const client = requireAdminClient();
    const id = values?.id == null ? null : Number(values.id);
    const label = String(values?.label || '').trim();
    const targetKey = String(values?.target_key || '').trim();

    if (id) {
      const { data, error } = await client
        .from('member_shortcuts')
        .update({ label, target_key: targetKey, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('member_key', identity.memberKey)
        .select('id,label,target_key,sort_order,created_at,updated_at')
        .single();
      if (error) throw error;
      return data;
    }

    const { count, error: countError } = await client
      .from('member_shortcuts')
      .select('id', { count: 'exact', head: true })
      .eq('member_key', identity.memberKey);
    if (countError) throw countError;
    if (Number(count || 0) >= 6) throw new Error('바로가기는 최대 6개까지 등록할 수 있습니다.');

    const { data: lastRows, error: lastError } = await client
      .from('member_shortcuts')
      .select('sort_order')
      .eq('member_key', identity.memberKey)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (lastError) throw lastError;

    const { data, error } = await client
      .from('member_shortcuts')
      .insert({
        member_key: identity.memberKey,
        label,
        target_key: targetKey,
        sort_order: Number(lastRows?.[0]?.sort_order ?? -1) + 1,
      })
      .select('id,label,target_key,sort_order,created_at,updated_at')
      .single();
    if (error) throw error;
    return data;
  }

  const data = await postShortcutAction('shortcut_save', {
    id: values?.id == null ? null : Number(values.id),
    label: String(values?.label || '').trim(),
    target_key: String(values?.target_key || '').trim(),
  });
  return data.shortcut || null;
}

export async function deleteShortcut(identity, id) {
  if (identity?.mode === 'admin') {
    const client = requireAdminClient();
    const { error } = await client
      .from('member_shortcuts')
      .delete()
      .eq('id', Number(id))
      .eq('member_key', identity.memberKey);
    if (error) throw error;
    return;
  }
  await postShortcutAction('shortcut_delete', { id: Number(id) });
}

export async function reorderShortcuts(identity, ids) {
  const normalizedIds = (ids || []).map((id) => Number(id)).filter(Number.isInteger);

  if (identity?.mode === 'admin') {
    const client = requireAdminClient();
    for (let index = 0; index < normalizedIds.length; index += 1) {
      const { error } = await client
        .from('member_shortcuts')
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq('id', normalizedIds[index])
        .eq('member_key', identity.memberKey);
      if (error) throw error;
    }
    return fetchShortcuts(identity);
  }

  const data = await postShortcutAction('shortcut_reorder', { ids: normalizedIds });
  return Array.isArray(data.shortcuts) ? data.shortcuts : [];
}
