import { api } from '../../api/api.js';

export async function fetchInfoData() {
  const [crafts, materials, materialRecipes, quests, processes, modbooks, skillRanks, presetCommunity] = await Promise.all([
    api.select('info_crafts_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_craft_materials_app', { orderBy: 'id', ascending: true, limit: 1000 }),
    api.select('info_material_recipes_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_quests_app', { orderBy: 'sort_order', ascending: true, limit: 1000 }),
    api.select('info_processes_app', { orderBy: 'sort_order', ascending: true, limit: 500 }),
    api.select('info_modbooks_app', { orderBy: 'id', ascending: true, limit: 1000 }),
    api.select('info_skill_ranks_app', { orderBy: 'sort_order', ascending: true, limit: 1000 }),
    fetchPresetCommunity(),
  ]);

  return {
    crafts,
    materials,
    materialRecipes,
    quests,
    processes,
    modbooks,
    skillRanks,
    presetCommunityReady: presetCommunity.ready,
    presetPosts: presetCommunity.posts,
  };
}

export async function fetchPresetCommunity() {
  try {
    const [posts, slots] = await Promise.all([
      api.select('info_preset_posts', {
        columns: 'id,system_key,author_member_key,author_nickname,title,description,tags,favorite_count,created_at,updated_at',
        orderBy: 'updated_at',
        ascending: false,
        limit: 300,
      }),
      api.select('info_preset_post_slots', {
        columns: 'id,post_id,slot_key,prefix_modbook_id,suffix_modbook_id,note,created_at,updated_at',
        orderBy: 'id',
        ascending: true,
        limit: 1200,
      }),
    ]);

    const slotsByPost = new Map();
    (slots || []).forEach((slot) => {
      const key = Number(slot.post_id);
      if (!slotsByPost.has(key)) slotsByPost.set(key, []);
      slotsByPost.get(key).push(slot);
    });

    return {
      ready: true,
      posts: (posts || []).map((post) => ({
        ...post,
        slots: slotsByPost.get(Number(post.id)) || [],
      })),
    };
  } catch (error) {
    const message = String(error?.message || error || '');
    if (error?.code === '42P01' || message.includes('info_preset_posts') || message.includes('info_preset_post_slots')) {
      return { ready: false, posts: [] };
    }
    throw error;
  }
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
