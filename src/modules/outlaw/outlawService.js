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
