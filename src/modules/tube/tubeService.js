import { api } from '../../api/api.js';

export async function fetchTubeVideos() {
  return api.select('tube_videos', {
    columns: 'tube_id,title,url,youtube_video_id,thumbnail_url,published_at,writer_member_key,writer,writer_badge,content,category,sort_order,views,likes,dislikes,comment_count,source,source_updated_at,created_at,updated_at',
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


export async function saveAdminTubeVideo(values) {
  return api.rpc('save_tube_video_admin', {
    p_tube_id: String(values?.tube_id || '').trim() || null,
    p_title: String(values?.title || '').trim(),
    p_url: String(values?.url || '').trim(),
    p_youtube_video_id: String(values?.youtube_video_id || '').trim(),
    p_thumbnail_url: String(values?.thumbnail_url || '').trim() || null,
    p_content: String(values?.content || '').trim() || null,
    p_category: String(values?.category || '').trim() || '일반',
    p_writer_member_key: String(values?.writer_member_key || '').trim() || null,
    p_writer: String(values?.writer || '').trim() || 'AXE',
    p_writer_badge: String(values?.writer_badge || '').trim() || null,
  });
}

export async function deleteAdminTubeVideo(tubeId) {
  return api.rpc('deactivate_tube_video_admin', {
    p_tube_id: String(tubeId || '').trim(),
  });
}


export async function fetchTubeComments(tubeId) {
  return api.select('tube_comments', {
    columns: 'id,tube_id,member_key,author_name,author_badge,body,edited_at,created_at,updated_at',
    orderBy: 'created_at',
    ascending: true,
    limit: 500,
    filters: {
      tube_id: String(tubeId || '').trim(),
      active: true,
    },
  });
}

export async function deleteAdminTubeComment(commentId) {
  return api.rpc('deactivate_tube_comment_admin', {
    p_comment_id: Number(commentId),
  });
}
