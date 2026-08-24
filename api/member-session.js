import crypto from 'node:crypto';
import {
  clearMemberSessionCookie,
  getSessionToken,
  normalizeApiError,
  onlyPost,
  publicMember,
  hydrateFundEvidence,
  uploadFundEvidence,
  removeFundEvidence,
  readBody,
  requireMemberSession,
  revokeMemberSession,
  sendJson,
} from '../server/memberSession.js';

const ALLOWED_PAYMENT_MODES = new Set(['공용계좌', '회사잔고', '분할납부']);

const SHORTCUT_TARGET_KEYS = new Set([
  'home',
  'notice.general', 'notice.patch', 'notice.operations',
  'info.craft', 'info.quest', 'info.process', 'info.modbook', 'info.skill',
  'outlaw.stats', 'outlaw.guide', 'outlaw.map', 'tube',
  'fund.overview', 'fund.payment', 'fund.submissions',
  'fund.review', 'fund.history', 'fund.balance', 'fund.feeRules', 'fund.exemptions', 'fund.integrity', 'fund.fundMembers',
  'assets.accounts', 'assets.company', 'assets.returns', 'members',
]);
const SHORTCUT_MAX_COUNT = 6;
const SHORTCUT_MAX_LABEL_LENGTH = 24;


function tubeApiError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeTubeText(value, maxLength) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function parseYoutubeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0])) videoId = parts[1] || '';
    }

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

function makeTubeId() {
  return `tube_new_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

const TUBE_PUBLIC_COLUMNS = 'tube_id,title,url,youtube_video_id,thumbnail_url,published_at,writer_member_key,writer,writer_badge,content,category,sort_order,views,likes,dislikes,comment_count,source,source_updated_at,sync_owner,discord_thread_id,discord_sync_status,discord_synced_at,discord_sync_error,discord_archived_by_sync,legacy_backup_id,legacy_backup_status,legacy_backup_synced_at,legacy_backup_error,active,created_at,updated_at';

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  let body = {};
  try {
    body = await readBody(req);
    const action = String(body.action || 'validate').trim();
    const token = getSessionToken(req, body);

    if (action === 'logout') {
      await revokeMemberSession(token);
      clearMemberSessionCookie(req, res);
      return sendJson(res, 200, { ok: true });
    }

    const context = await requireMemberSession(token);

    if (action === 'validate') {
      return sendJson(res, 200, {
        ok: true,
        member: publicMember(context.member),
        expires_at: context.session.expires_at,
      });
    }

    if (action === 'shortcut_list') {
      const { data, error } = await context.client
        .from('member_shortcuts')
        .select('id,label,target_key,sort_order,created_at,updated_at')
        .eq('member_key', context.member.member_key)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { ok: true, shortcuts: data || [] });
    }

    if (action === 'shortcut_save') {
      const rawId = body.id == null || body.id === '' ? null : Number(body.id);
      const label = String(body.label || '').trim();
      const targetKey = String(body.target_key || '').trim();

      if (rawId !== null && (!Number.isInteger(rawId) || rawId <= 0)) {
        return sendJson(res, 400, { ok: false, message: '수정할 바로가기 정보가 올바르지 않습니다.' });
      }
      if (!label) {
        return sendJson(res, 400, { ok: false, message: '바로가기 이름을 입력하세요.' });
      }
      if (label.length > SHORTCUT_MAX_LABEL_LENGTH) {
        return sendJson(res, 400, { ok: false, message: `바로가기 이름은 ${SHORTCUT_MAX_LABEL_LENGTH}자 이내로 입력하세요.` });
      }
      if (!SHORTCUT_TARGET_KEYS.has(targetKey)) {
        return sendJson(res, 400, { ok: false, message: '지원하지 않는 바로가기 위치입니다.' });
      }

      if (rawId === null) {
        const { count, error: countError } = await context.client
          .from('member_shortcuts')
          .select('id', { count: 'exact', head: true })
          .eq('member_key', context.member.member_key);
        if (countError) throw countError;
        if (Number(count || 0) >= SHORTCUT_MAX_COUNT) {
          return sendJson(res, 409, { ok: false, message: `바로가기는 최대 ${SHORTCUT_MAX_COUNT}개까지 등록할 수 있습니다.` });
        }

        const { data: lastRows, error: lastError } = await context.client
          .from('member_shortcuts')
          .select('sort_order')
          .eq('member_key', context.member.member_key)
          .order('sort_order', { ascending: false })
          .limit(1);
        if (lastError) throw lastError;
        const sortOrder = Number(lastRows?.[0]?.sort_order ?? -1) + 1;

        const { data, error } = await context.client
          .from('member_shortcuts')
          .insert({
            member_key: context.member.member_key,
            label,
            target_key: targetKey,
            sort_order: sortOrder,
          })
          .select('id,label,target_key,sort_order,created_at,updated_at')
          .single();
        if (error) throw error;
        return sendJson(res, 200, { ok: true, shortcut: data });
      }

      const { data, error } = await context.client
        .from('member_shortcuts')
        .update({
          label,
          target_key: targetKey,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rawId)
        .eq('member_key', context.member.member_key)
        .select('id,label,target_key,sort_order,created_at,updated_at')
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 404, { ok: false, message: '수정할 바로가기를 찾을 수 없습니다.' });
      return sendJson(res, 200, { ok: true, shortcut: data });
    }

    if (action === 'shortcut_delete') {
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) {
        return sendJson(res, 400, { ok: false, message: '삭제할 바로가기 정보가 올바르지 않습니다.' });
      }

      const { data, error } = await context.client
        .from('member_shortcuts')
        .delete()
        .eq('id', id)
        .eq('member_key', context.member.member_key)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 404, { ok: false, message: '삭제할 바로가기를 찾을 수 없습니다.' });
      return sendJson(res, 200, { ok: true, id });
    }

    if (action === 'shortcut_reorder') {
      const ids = Array.isArray(body.ids)
        ? body.ids.map((value) => Number(value)).filter(Number.isInteger)
        : [];
      if (!ids.length || ids.length > SHORTCUT_MAX_COUNT || new Set(ids).size !== ids.length) {
        return sendJson(res, 400, { ok: false, message: '바로가기 순서 정보가 올바르지 않습니다.' });
      }

      const { data: ownedRows, error: ownedError } = await context.client
        .from('member_shortcuts')
        .select('id')
        .eq('member_key', context.member.member_key)
        .in('id', ids);
      if (ownedError) throw ownedError;
      if ((ownedRows || []).length !== ids.length) {
        return sendJson(res, 403, { ok: false, message: '본인의 바로가기만 순서를 변경할 수 있습니다.' });
      }

      for (let index = 0; index < ids.length; index += 1) {
        const { error } = await context.client
          .from('member_shortcuts')
          .update({ sort_order: index, updated_at: new Date().toISOString() })
          .eq('id', ids[index])
          .eq('member_key', context.member.member_key);
        if (error) throw error;
      }

      const { data, error } = await context.client
        .from('member_shortcuts')
        .select('id,label,target_key,sort_order,created_at,updated_at')
        .eq('member_key', context.member.member_key)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return sendJson(res, 200, { ok: true, shortcuts: data || [] });
    }

    if (action === 'outlaw_bootstrap') {
      const [statsResult, locationsResult, stepsResult, mapsResult] = await Promise.all([
        context.client
          .from('outlaw_stats_current')
          .select('member_key,source_nickname,total_kills,total_deaths,kd,source_updated_at')
          .order('total_kills', { ascending: false }),
        context.client
          .from('outlaw_guide_locations')
          .select('location_key,map_name,main_image,coord,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        context.client
          .from('outlaw_guide_steps')
          .select('id,location_key,route_group,step_no,title,content,image,video_url,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
        context.client
          .from('outlaw_briefing_maps')
          .select('map_key,map_name,image,description,note,coord,source_updated_at,sort_order')
          .eq('active', true)
          .order('sort_order', { ascending: true }),
      ]);

      for (const result of [statsResult, locationsResult, stepsResult, mapsResult]) {
        if (result.error) throw result.error;
      }

      const statRows = statsResult.data || [];
      const memberKeys = [...new Set(statRows.map((row) => row.member_key).filter(Boolean))];
      let memberRows = [];
      if (memberKeys.length) {
        const { data, error } = await context.client
          .from('members')
          .select('member_key,nickname,status,sort_order')
          .in('member_key', memberKeys);
        if (error) throw error;
        memberRows = data || [];
      }
      const memberMap = new Map(memberRows.map((member) => [member.member_key, member]));
      const stats = statRows.map((row) => ({
        ...row,
        nickname: memberMap.get(row.member_key)?.nickname || row.source_nickname,
        member_status: memberMap.get(row.member_key)?.status || 'active',
        member_sort_order: memberMap.get(row.member_key)?.sort_order || 0,
      }));

      return sendJson(res, 200, {
        ok: true,
        stats,
        guide_locations: locationsResult.data || [],
        guide_steps: stepsResult.data || [],
        maps: mapsResult.data || [],
      });
    }

    if (action === 'outlaw_history') {
      const memberKey = String(body.member_key || '').trim();
      if (!memberKey) {
        return sendJson(res, 400, { ok: false, message: '조회할 멤버 정보가 없습니다.' });
      }

      const { data, error } = await context.client
        .from('outlaw_stats_history')
        .select('record_id,member_key,source_nickname,total_kills,total_deaths,kill_delta,death_delta,delta_kd,confidence,status,recorded_at')
        .eq('member_key', memberKey)
        .order('recorded_at', { ascending: false })
        .limit(120);
      if (error) throw error;

      return sendJson(res, 200, { ok: true, history: data || [] });
    }

    if (action === 'tube_my_reactions') {
      const { data, error } = await context.client
        .from('tube_reactions')
        .select('tube_id,reaction,updated_at')
        .eq('member_key', context.member.member_key)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, reactions: data || [] });
    }

    if (action === 'tube_reaction_set') {
      const tubeId = String(body.tube_id || '').trim();
      const rawReaction = body.reaction == null ? null : String(body.reaction || '').trim().toLowerCase();
      if (!tubeId) {
        return sendJson(res, 400, { ok: false, message: '영상 정보가 올바르지 않습니다.' });
      }
      if (rawReaction !== null && !['like', 'dislike'].includes(rawReaction)) {
        return sendJson(res, 400, { ok: false, message: '추천/비추천 값이 올바르지 않습니다.' });
      }

      const { data, error } = await context.client.rpc('set_tube_reaction', {
        p_tube_id: tubeId,
        p_member_key: context.member.member_key,
        p_reaction: rawReaction,
      });
      if (error) throw error;
      return sendJson(res, 200, { ok: true, result: data || null });
    }

    if (action === 'tube_comment_save') {
      const tubeId = String(body.tube_id || '').trim();
      const commentId = body.comment_id == null || body.comment_id === ''
        ? null
        : Number(body.comment_id);
      const commentBody = normalizeTubeText(body.body, 500);

      if (!tubeId) throw tubeApiError(400, '댓글을 등록할 영상 정보가 없습니다.');
      if (!commentBody) throw tubeApiError(400, '댓글 내용을 입력하세요.');
      if (commentId !== null && (!Number.isInteger(commentId) || commentId <= 0)) {
        throw tubeApiError(400, '댓글 정보가 올바르지 않습니다.');
      }

      const { data: video, error: videoError } = await context.client
        .from('tube_videos')
        .select('tube_id,active')
        .eq('tube_id', tubeId)
        .maybeSingle();
      if (videoError) throw videoError;
      if (!video || !video.active) throw tubeApiError(404, '댓글을 등록할 영상을 찾을 수 없습니다.');

      let saved = null;
      if (commentId !== null) {
        const { data: existing, error: existingError } = await context.client
          .from('tube_comments')
          .select('id,tube_id,member_key,active')
          .eq('id', commentId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existing || !existing.active || String(existing.tube_id) !== tubeId) {
          throw tubeApiError(404, '수정할 댓글을 찾을 수 없습니다.');
        }
        if (String(existing.member_key || '') !== String(context.member.member_key || '')) {
          throw tubeApiError(403, '본인이 작성한 댓글만 수정할 수 있습니다.');
        }

        const { data, error } = await context.client
          .from('tube_comments')
          .update({
            body: commentBody,
            author_name: context.member.nickname,
            author_badge: context.member.badge || null,
            edited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', commentId)
          .select('id,tube_id,member_key,author_name,author_badge,body,edited_at,created_at,updated_at')
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await context.client
          .from('tube_comments')
          .insert({
            tube_id: tubeId,
            member_key: context.member.member_key,
            author_name: context.member.nickname,
            author_badge: context.member.badge || null,
            body: commentBody,
            active: true,
          })
          .select('id,tube_id,member_key,author_name,author_badge,body,edited_at,created_at,updated_at')
          .single();
        if (error) throw error;
        saved = data;
      }

      return sendJson(res, 200, { ok: true, comment: saved });
    }

    if (action === 'tube_comment_delete') {
      const commentId = Number(body.comment_id);
      if (!Number.isInteger(commentId) || commentId <= 0) {
        throw tubeApiError(400, '삭제할 댓글 정보가 올바르지 않습니다.');
      }

      const { data: existing, error: existingError } = await context.client
        .from('tube_comments')
        .select('id,member_key,active')
        .eq('id', commentId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing || !existing.active) throw tubeApiError(404, '삭제할 댓글을 찾을 수 없습니다.');
      if (String(existing.member_key || '') !== String(context.member.member_key || '')) {
        throw tubeApiError(403, '본인이 작성한 댓글만 삭제할 수 있습니다.');
      }

      const { error } = await context.client
        .from('tube_comments')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', commentId);
      if (error) throw error;

      return sendJson(res, 200, { ok: true, comment_id: commentId });
    }

    if (action === 'tube_video_save') {
      const tubeId = String(body.tube_id || '').trim();
      const title = normalizeTubeText(body.title, 100);
      const content = normalizeTubeText(body.content, 1500);
      const category = normalizeTubeText(body.category, 50) || '일반';
      const youtube = parseYoutubeUrl(body.url);

      if (!title) throw tubeApiError(400, '영상 제목을 입력하세요.');
      if (!youtube) throw tubeApiError(400, '올바른 YouTube 영상 링크를 입력하세요.');

      let saved = null;

      if (tubeId) {
        const { data: existing, error: existingError } = await context.client
          .from('tube_videos')
          .select('tube_id,writer_member_key,active')
          .eq('tube_id', tubeId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existing) throw tubeApiError(404, '수정할 영상을 찾을 수 없습니다.');
        if (String(existing.writer_member_key || '') !== String(context.member.member_key || '')) {
          throw tubeApiError(403, '본인이 등록한 영상만 수정할 수 있습니다.');
        }

        const { data, error } = await context.client
          .from('tube_videos')
          .update({
            title,
            url: youtube.url,
            youtube_video_id: youtube.videoId,
            thumbnail_url: youtube.thumbnailUrl,
            writer_member_key: context.member.member_key,
            writer: context.member.nickname,
            writer_badge: context.member.badge || null,
            content: content || null,
            category,
            sync_owner: 'supabase',
            discord_sync_status: 'pending',
            discord_sync_error: null,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('tube_id', tubeId)
          .select(TUBE_PUBLIC_COLUMNS)
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const newTubeId = makeTubeId();
        const now = new Date().toISOString();
        const { data, error } = await context.client
          .from('tube_videos')
          .insert({
            tube_id: newTubeId,
            title,
            url: youtube.url,
            youtube_video_id: youtube.videoId,
            thumbnail_url: youtube.thumbnailUrl,
            published_at: now,
            writer_member_key: context.member.member_key,
            writer: context.member.nickname,
            writer_badge: context.member.badge || null,
            content: content || null,
            category,
            views: 0,
            likes: 0,
            dislikes: 0,
            source: 'new_axe_net',
            sync_owner: 'supabase',
            discord_sync_status: 'pending',
            discord_sync_error: null,
            active: true,
          })
          .select(TUBE_PUBLIC_COLUMNS)
          .single();
        if (error) throw error;
        saved = data;
      }

      return sendJson(res, 200, { ok: true, video: saved });
    }

    if (action === 'tube_video_delete') {
      const tubeId = String(body.tube_id || '').trim();
      if (!tubeId) throw tubeApiError(400, '삭제할 영상 정보가 없습니다.');

      const { data: existing, error: existingError } = await context.client
        .from('tube_videos')
        .select('tube_id,writer_member_key,active')
        .eq('tube_id', tubeId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) throw tubeApiError(404, '삭제할 영상을 찾을 수 없습니다.');
      if (String(existing.writer_member_key || '') !== String(context.member.member_key || '')) {
        throw tubeApiError(403, '본인이 등록한 영상만 삭제할 수 있습니다.');
      }

      const { error } = await context.client
        .from('tube_videos')
        .update({
          active: false,
          sync_owner: 'supabase',
          discord_sync_status: 'pending',
          discord_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tube_id', tubeId);
      if (error) throw error;

      return sendJson(res, 200, { ok: true, tube_id: tubeId });
    }

    if (action === 'fund_profile') {
      const discordUserId = String(context.member.discord_user_id || '').trim();
      if (!discordUserId) {
        return sendJson(res, 409, {
          ok: false,
          message: '이 멤버는 Discord 계정 연결 정보가 없습니다. 관리자에게 계정연동을 요청하세요.',
        });
      }

      const { data, error } = await context.client.rpc('get_my_fund_profile', {
        p_member_key: context.member.member_key,
        p_discord_user_id: discordUserId,
      });
      if (error) throw error;

      const profile = await hydrateFundEvidence(data, context.client);
      return sendJson(res, 200, { ok: true, profile });
    }

    if (action === 'asset_plika_accounts') {
      const { data: accountRows, error: accountError } = await context.client
        .from('member_accounts')
        .select('id,member_key,account,note,sort_order,updated_at')
        .eq('enabled', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
        .limit(1000);
      if (accountError) throw accountError;

      const keys = [...new Set((accountRows || []).map((row) => row.member_key).filter(Boolean))];
      let memberRows = [];
      if (keys.length) {
        const { data, error } = await context.client
          .from('members')
          .select('member_key,nickname,status,sort_order')
          .in('member_key', keys);
        if (error) throw error;
        memberRows = data || [];
      }

      const memberMap = new Map(memberRows.map((row) => [row.member_key, row]));
      const accounts = (accountRows || [])
        .map((row) => ({
          ...row,
          nickname: memberMap.get(row.member_key)?.nickname || row.member_key,
          member_status: memberMap.get(row.member_key)?.status || null,
          member_sort_order: Number(memberMap.get(row.member_key)?.sort_order || 0),
        }))
        .filter((row) => row.member_status === 'active')
        .sort((a, b) => a.member_sort_order - b.member_sort_order
          || Number(a.sort_order || 0) - Number(b.sort_order || 0)
          || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'ko'));

      return sendJson(res, 200, { ok: true, accounts });
    }

    if (action === 'asset_plika_my_requests') {
      const { data, error } = await context.client
        .from('member_account_requests')
        .select('id,account,note,status,reviewer,review_note,reviewed_at,created_at')
        .eq('member_key', context.member.member_key)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, requests: data || [] });
    }

    if (action === 'asset_plika_request_submit') {
      const account = String(body.account || '').trim();
      const note = String(body.note || '').trim();
      if (!account) {
        return sendJson(res, 400, { ok: false, message: '계좌번호를 입력하세요.' });
      }
      if (account.length > 100) {
        return sendJson(res, 400, { ok: false, message: '계좌번호가 너무 깁니다.' });
      }
      if (note.length > 500) {
        return sendJson(res, 400, { ok: false, message: '메모는 500자 이하로 입력하세요.' });
      }

      const { data, error } = await context.client
        .from('member_account_requests')
        .insert({
          member_key: context.member.member_key,
          nickname: context.member.nickname,
          account,
          note: note || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return sendJson(res, 409, { ok: false, message: '이미 검수대기 중인 계좌 신청이 있습니다.' });
        }
        throw error;
      }

      return sendJson(res, 200, { ok: true, request_id: data.id });
    }

    if (action === 'info_modbook_my_requests') {
      const { data, error } = await context.client
        .from('info_modbook_requests')
        .select('id,type,category,name,parts,option1,option2,option3,success_rate,note,status,review_note,reviewer,reviewed_at,created_at')
        .eq('member_key', context.member.member_key)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return sendJson(res, 200, { ok: true, requests: data || [] });
    }

    if (action === 'info_modbook_price_update') {
      const id = Number(body.id);
      const rawPrice = String(body.recent_price ?? '').trim().replace(/,/g, '');
      const recentPrice = rawPrice === '' ? null : Number(rawPrice);
      if (!Number.isInteger(id) || id <= 0) {
        return sendJson(res, 400, { ok: false, message: '개조서 정보가 올바르지 않습니다.' });
      }
      if (recentPrice !== null && (!Number.isInteger(recentPrice) || recentPrice < 0)) {
        return sendJson(res, 400, { ok: false, message: '최근 거래가는 0 이상의 정수로 입력하세요.' });
      }
      const recentDate = recentPrice === null
        ? null
        : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      const { data, error } = await context.client
        .from('info_modbooks')
        .update({
          recent_price: recentPrice,
          recent_date: recentDate,
          price_note: recentPrice === null ? null : context.member.nickname,
        })
        .eq('id', id)
        .eq('active', true)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return sendJson(res, 404, { ok: false, message: '개조서를 찾을 수 없습니다.' });
      return sendJson(res, 200, { ok: true, modbook_id: data.id });
    }

    if (action === 'info_modbook_request_submit') {
      const type = String(body.type || '').trim();
      const category = String(body.category || '').trim();
      const name = String(body.name || '').trim();
      const parts = String(body.parts || '').trim();
      const option1 = String(body.option1 || '').trim();
      const option2 = String(body.option2 || '').trim();
      const option3 = String(body.option3 || '').trim();
      const note = String(body.note || '').trim();
      const successRateText = String(body.success_rate ?? '').trim();
      const successRate = successRateText ? Number(successRateText) : null;

      if (!['접두', '접미'].includes(type)) {
        return sendJson(res, 400, { ok: false, message: '개조 위치는 접두 또는 접미 중에서 선택하세요.' });
      }
      if (!category || !name) {
        return sendJson(res, 400, { ok: false, message: '개조서 분류와 이름을 입력하세요.' });
      }
      if (!parts) {
        return sendJson(res, 400, { ok: false, message: '적용 부위를 입력하세요.' });
      }
      if (!option1 && !option2 && !option3) {
        return sendJson(res, 400, { ok: false, message: '개조 옵션을 하나 이상 입력하세요.' });
      }
      if (successRate !== null && (!Number.isInteger(successRate) || successRate < 0 || successRate > 100)) {
        return sendJson(res, 400, { ok: false, message: '성공률은 0~100 사이 정수로 입력하세요.' });
      }
      if (name.length > 100 || category.length > 80 || parts.length > 300) {
        return sendJson(res, 400, { ok: false, message: '입력 내용이 허용 길이를 초과했습니다.' });
      }

      const { data, error } = await context.client
        .from('info_modbook_requests')
        .insert({
          member_key: context.member.member_key,
          nickname: context.member.nickname,
          type,
          category,
          name,
          parts,
          option1: option1 || null,
          option2: option2 || null,
          option3: option3 || null,
          success_rate: successRate,
          note: note || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          return sendJson(res, 409, { ok: false, message: '같은 개조서의 검수대기 신청이 이미 있습니다.' });
        }
        throw error;
      }

      return sendJson(res, 200, { ok: true, request_id: data.id });
    }

    if (action === 'fund_submit') {
      const discordUserId = String(context.member.discord_user_id || '').trim();
      if (!discordUserId) {
        return sendJson(res, 409, {
          ok: false,
          message: '이 멤버는 Discord 계정 연결 정보가 없습니다. 관리자에게 계정연동을 요청하세요.',
        });
      }

      const paymentMode = String(body.payment_mode || '공용계좌');
      if (!ALLOWED_PAYMENT_MODES.has(paymentMode)) {
        return sendJson(res, 400, {
          ok: false,
          message: '납부 방식은 공용계좌, 회사잔고 또는 분할납부 중에서 선택하세요.',
        });
      }

      const year = Number(body.year);
      const month = Number(body.month);
      const week = Number(body.week);
      const amount = Number(body.amount);

      if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(week)) {
        return sendJson(res, 400, { ok: false, message: '납부 주차 정보가 올바르지 않습니다.' });
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        return sendJson(res, 400, { ok: false, message: '납부 금액은 0원보다 큰 정수여야 합니다.' });
      }

      let publicAmount = Number(body.public_amount || 0);
      let companyAmount = Number(body.company_amount || 0);
      if (paymentMode === '공용계좌') { publicAmount = amount; companyAmount = 0; }
      if (paymentMode === '회사잔고') { publicAmount = 0; companyAmount = amount; }
      if (paymentMode === '분할납부') {
        if (!Number.isInteger(publicAmount) || publicAmount <= 0 || !Number.isInteger(companyAmount) || companyAmount <= 0) {
          return sendJson(res, 400, { ok: false, message: '분할납부 금액을 모두 입력하세요.' });
        }
        if (publicAmount + companyAmount !== amount) {
          return sendJson(res, 400, { ok: false, message: '분할납부 합계가 총 납부금액과 일치하지 않습니다.' });
        }
      }

      const upload = await uploadFundEvidence(context.client, context.member.member_key, body.evidence);
      try {
        const { data, error } = await context.client.rpc('submit_fund_request_v2', {
          p_member_key: context.member.member_key,
          p_discord_user_id: discordUserId,
          p_year: year,
          p_month: month,
          p_week: week,
          p_amount: amount,
          p_payment_mode: paymentMode,
          p_public_amount: publicAmount,
          p_company_amount: companyAmount,
          p_evidence_url: upload.ref,
          p_memo: String(body.memo || '').trim() || null,
          p_submitted_by_name: context.member.nickname,
          p_proxy_admin_name: null,
          p_submitted_via: 'member_web',
        });
        if (error) throw error;
        return sendJson(res, 200, { ok: true, request_id: data });
      } catch (error) {
        await removeFundEvidence(context.client, upload.path);
        throw error;
      }
    }

    return sendJson(res, 400, { ok: false, message: '지원하지 않는 세션 작업입니다.' });
  } catch (error) {
    console.error('[NEW AXE NET] member session action failed:', error);
    const normalized = normalizeApiError(error);
    if (normalized.status === 401 || normalized.status === 403) clearMemberSessionCookie(req, res);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
