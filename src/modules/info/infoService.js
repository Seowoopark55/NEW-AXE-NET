import { api } from '../../api/api.js';

export async function fetchInfoData() {
  const [crafts, materials, materialRecipes, quests, processes, modbooks, skillRanks] = await Promise.all([
    api.select('info_crafts_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_craft_materials_app', { orderBy: 'id', ascending: true, limit: 1000 }),
    api.select('info_material_recipes_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_quests_app', { orderBy: 'sort_order', ascending: true, limit: 1000 }),
    api.select('info_processes_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_modbooks_app', { orderBy: 'id', ascending: true, limit: 1000 }),
    api.select('info_skill_ranks_app', { orderBy: 'sort_order', ascending: true, limit: 1000 }),
  ]);

  return { crafts, materials, materialRecipes, quests, processes, modbooks, skillRanks };
}

export async function fetchModbookRequests() {
  return api.select('info_modbook_requests', {
    columns: 'id,member_key,nickname,type,category,name,parts,option1,option2,option3,success_rate,note,status,review_note,reviewer,reviewed_at,created_at',
    orderBy: 'created_at',
    ascending: false,
    limit: 300,
  });
}

export async function saveModbook(values) {
  return api.rpc('save_info_modbook', {
    p_id: values.id || null,
    p_type: values.type,
    p_category: values.category,
    p_name: values.name,
    p_parts: values.parts || '',
    p_option1: values.option1 || null,
    p_option2: values.option2 || null,
    p_option3: values.option3 || null,
    p_success_rate: nullableInteger(values.success_rate),
    p_note: values.note || null,
  });
}

export async function updateModbookPrice(id, recentPrice, priceNote = '') {
  return api.rpc('update_info_modbook_price', {
    p_id: Number(id),
    p_recent_price: nullableInteger(recentPrice),
    p_price_note: String(priceNote || '').trim() || null,
  });
}

export async function deactivateModbook(id) {
  return api.rpc('deactivate_info_modbook', { p_id: Number(id) });
}

export async function reviewModbookRequest(id, action, reviewNote = '') {
  return api.rpc('review_info_modbook_request', {
    p_request_id: Number(id),
    p_action: action,
    p_review_note: String(reviewNote || '').trim() || null,
  });
}

function nullableInteger(value) {
  const text = String(value ?? '').trim().replace(/,/g, '');
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}
