import { api } from '../../api/api.js';

export async function fetchAdminOutlawData() {
  const [stats, guideLocations, guideSteps, maps] = await Promise.all([
    api.select('outlaw_stats_current', {
      columns: 'id,member_key,source_nickname,total_kills,total_deaths,kd,last_message_id,source_updated_at,updated_at',
      orderBy: 'total_kills',
      ascending: false,
      limit: 500,
    }),
    api.select('outlaw_guide_locations', {
      columns: 'location_key,map_name,main_image,coord,active,sort_order,updated_at',
      orderBy: 'sort_order',
      ascending: true,
      limit: 200,
    }),
    api.select('outlaw_guide_steps', {
      columns: 'id,location_key,route_group,step_no,title,content,image,video_url,sort_order,active,updated_at',
      orderBy: 'sort_order',
      ascending: true,
      limit: 1000,
    }),
    api.select('outlaw_briefing_maps', {
      columns: 'map_key,map_name,image,description,note,coord,source_updated_at,active,sort_order,updated_at',
      orderBy: 'sort_order',
      ascending: true,
      limit: 500,
    }),
  ]);

  return {
    stats,
    guideLocations: guideLocations.filter((row) => row.active !== false),
    guideSteps: guideSteps.filter((row) => row.active !== false),
    maps: maps.filter((row) => row.active !== false),
  };
}

export async function fetchAdminOutlawHistory(memberKey, limit = 120) {
  if (!memberKey) return [];
  return api.select('outlaw_stats_history', {
    columns: 'record_id,member_key,source_nickname,total_kills,total_deaths,kill_delta,death_delta,delta_kd,confidence,status,recorded_at',
    orderBy: 'recorded_at',
    ascending: false,
    limit,
    filters: { member_key: memberKey },
  });
}


export async function saveOutlawGuideLocation(values) {
  return api.rpc('save_outlaw_guide_location', {
    p_location_key: String(values.location_key || '').trim(),
    p_map_name: String(values.map_name || '').trim(),
    p_main_image: textOrNull(values.main_image),
    p_coord: textOrNull(values.coord),
    p_sort_order: integerOrZero(values.sort_order),
  });
}

export async function deactivateOutlawGuideLocation(locationKey) {
  return api.rpc('deactivate_outlaw_guide_location', {
    p_location_key: String(locationKey || '').trim(),
  });
}

export async function saveOutlawGuideStep(values) {
  return api.rpc('save_outlaw_guide_step', {
    p_id: nullableInteger(values.id),
    p_location_key: String(values.location_key || '').trim(),
    p_route_group: String(values.route_group || '').trim() || '기본 루트',
    p_step_no: String(values.step_no || '').trim(),
    p_title: String(values.title || '').trim(),
    p_content: textOrNull(values.content),
    p_image: textOrNull(values.image),
    p_video_url: textOrNull(values.video_url),
    p_sort_order: integerOrZero(values.sort_order),
  });
}

export async function deactivateOutlawGuideStep(id) {
  return api.rpc('deactivate_outlaw_guide_step', { p_id: Number(id) });
}

export async function saveOutlawBriefingMap(values) {
  return api.rpc('save_outlaw_briefing_map', {
    p_map_key: String(values.map_key || '').trim(),
    p_map_name: String(values.map_name || '').trim(),
    p_image: textOrNull(values.image),
    p_description: textOrNull(values.description),
    p_note: textOrNull(values.note),
    p_coord: textOrNull(values.coord),
    p_source_updated_at: textOrNull(values.source_updated_at),
    p_sort_order: integerOrZero(values.sort_order),
  });
}

export async function deactivateOutlawBriefingMap(mapKey) {
  return api.rpc('deactivate_outlaw_briefing_map', {
    p_map_key: String(mapKey || '').trim(),
  });
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function nullableInteger(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : null;
}

function integerOrZero(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : 0;
}
