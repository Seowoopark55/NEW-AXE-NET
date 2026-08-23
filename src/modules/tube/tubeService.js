import { api } from '../../api/api.js';

export async function fetchTubeVideos() {
  return api.select('tube_videos', {
    columns: 'tube_id,title,url,youtube_video_id,thumbnail_url,published_at,writer_member_key,writer,writer_badge,content,category,sort_order,views,likes,dislikes,source_updated_at,created_at,updated_at',
    orderBy: 'published_at',
    ascending: false,
    limit: 500,
    filters: { active: true },
  });
}

export async function incrementTubeView(tubeId) {
  return api.rpc('increment_tube_view', {
    p_tube_id: String(tubeId || '').trim(),
  });
}
