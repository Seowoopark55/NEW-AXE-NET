import { store } from '../../state/store.js';
import {
  deleteMemberTubeComment,
  deleteMemberTubeVideo,
  fetchMemberTubeReactions,
  saveMemberTubeComment,
  saveMemberTubeVideo,
  setMemberTubeReaction,
} from '../auth/memberAuthService.js';
import {
  deleteAdminTubeComment,
  deleteAdminTubeVideo,
  fetchTubeComments,
  fetchTubeVideos,
  incrementTubeView,
  saveAdminTubeVideo,
} from './tubeService.js';
import { renderTubeView } from './tubeView.js';

let reloadPromise = null;
const SORTS = new Set(['recent', 'views', 'likes']);

export async function initTubeModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  let lastIdentity = identityKey(store.getState());

  const actions = {
    async onRefresh() {
      await reloadTubeData();
    },

    onFilterChange(key, value) {
      if (!(key in store.getState().tube.filters)) return;
      updateTube((tube) => ({
        ...tube,
        filters: {
          ...tube.filters,
          [key]: key === 'sort' && !SORTS.has(value) ? 'recent' : value,
        },
      }));
    },

    onOpenLogin() {
      store.updateState((state) => ({
        ...state,
        auth: { ...state.auth, loginOpen: true, loginMode: 'member', error: null },
      }));
    },

    async onOpenVideo(tubeId) {
      const video = store.getState().tube.videos.find((item) => item.tube_id === tubeId);
      if (!video) return;

      updateTube((tube) => ({
        ...tube,
        selectedTubeId: tubeId,
        commentError: null,
        commentEditingId: null,
        commentDeleteId: null,
      }));
      loadTubeComments(tubeId).catch((error) => {
        console.warn('[AXE NET] AXE TUBE comments load failed:', error);
      });

      try {
        const nextViews = await incrementTubeView(tubeId);
        if (Number.isFinite(Number(nextViews))) {
          updateTube((tube) => ({
            ...tube,
            videos: tube.videos.map((item) => item.tube_id === tubeId
              ? { ...item, views: Number(nextViews) }
              : item),
          }));
        }
      } catch (error) {
        console.warn('[AXE NET] AXE TUBE view increment failed:', error);
      }
    },

    onCloseVideo() {
      updateTube((tube) => ({
        ...tube,
        selectedTubeId: null,
        commentError: null,
        commentEditingId: null,
        commentDeleteId: null,
      }));
    },

    async onReact(tubeId, reaction) {
      const state = store.getState();
      if (!state.auth.member) {
        actions.onOpenLogin();
        return;
      }
      if (state.tube.reactionSavingTubeId) return;

      updateTube((tube) => ({ ...tube, reactionSavingTubeId: tubeId, message: null }));
      try {
        const result = await setMemberTubeReaction(tubeId, reaction);
        if (!result) throw new Error('반응 저장 결과를 확인하지 못했습니다.');

        updateTube((tube) => {
          const nextReactions = { ...tube.myReactions };
          if (result.reaction) nextReactions[tubeId] = result.reaction;
          else delete nextReactions[tubeId];

          return {
            ...tube,
            reactionSavingTubeId: null,
            myReactions: nextReactions,
            videos: tube.videos.map((item) => item.tube_id === tubeId
              ? {
                  ...item,
                  likes: Number(result.likes ?? item.likes ?? 0),
                  dislikes: Number(result.dislikes ?? item.dislikes ?? 0),
                }
              : item),
          };
        });
      } catch (error) {
        console.error('[AXE NET] AXE TUBE reaction failed:', error);
        updateTube((tube) => ({
          ...tube,
          reactionSavingTubeId: null,
          message: formatTubeError(error),
          messageType: 'error',
        }));
      }
    },

    onStartCommentEdit(commentId) {
      const state = store.getState();
      const tubeId = state.tube.selectedTubeId;
      const comments = state.tube.commentsByTubeId?.[tubeId] || [];
      const comment = comments.find((item) => Number(item.id) === Number(commentId));
      if (!comment || !state.auth.member || String(comment.member_key || '') !== String(state.auth.member.member_key || '')) {
        updateTube((tube) => ({ ...tube, commentError: '본인이 작성한 댓글만 수정할 수 있습니다.' }));
        return;
      }
      updateTube((tube) => ({
        ...tube,
        commentEditingId: Number(commentId),
        commentDeleteId: null,
        commentError: null,
      }));
    },

    onCancelCommentEdit() {
      updateTube((tube) => ({ ...tube, commentEditingId: null, commentError: null }));
    },

    async onSaveComment(body) {
      const state = store.getState();
      const tubeId = state.tube.selectedTubeId;
      if (!state.auth.member) {
        actions.onOpenLogin();
        return;
      }
      if (!tubeId || state.tube.commentSaving) return;

      const text = String(body || '').trim();
      if (!text) {
        updateTube((tube) => ({ ...tube, commentError: '댓글 내용을 입력하세요.' }));
        return;
      }
      if (text.length > 500) {
        updateTube((tube) => ({ ...tube, commentError: '댓글은 500자 이하로 입력하세요.' }));
        return;
      }

      updateTube((tube) => ({ ...tube, commentSaving: true, commentError: null }));
      try {
        await saveMemberTubeComment(state.tube.commentEditingId, tubeId, text);
        updateTube((tube) => ({
          ...tube,
          commentSaving: false,
          commentEditingId: null,
          commentDeleteId: null,
          commentError: null,
        }));
        await loadTubeComments(tubeId);
      } catch (error) {
        console.error('[AXE NET] AXE TUBE comment save failed:', error);
        updateTube((tube) => ({
          ...tube,
          commentSaving: false,
          commentError: formatTubeError(error),
        }));
      }
    },

    onRequestCommentDelete(commentId) {
      updateTube((tube) => ({
        ...tube,
        commentDeleteId: Number(commentId),
        commentEditingId: tube.commentEditingId === Number(commentId) ? null : tube.commentEditingId,
        commentError: null,
      }));
    },

    onCancelCommentDelete() {
      updateTube((tube) => ({ ...tube, commentDeleteId: null, commentError: null }));
    },

    async onConfirmCommentDelete(commentId) {
      const state = store.getState();
      const tubeId = state.tube.selectedTubeId;
      const comments = state.tube.commentsByTubeId?.[tubeId] || [];
      const comment = comments.find((item) => Number(item.id) === Number(commentId));
      if (!tubeId || !comment || state.tube.commentSaving) return;

      const isOwner = Boolean(
        state.auth.member
        && String(comment.member_key || '') === String(state.auth.member.member_key || '')
      );
      if (!state.auth.admin && !isOwner) {
        updateTube((tube) => ({ ...tube, commentError: '이 댓글을 삭제할 권한이 없습니다.' }));
        return;
      }

      updateTube((tube) => ({ ...tube, commentSaving: true, commentError: null }));
      try {
        if (state.auth.admin) await deleteAdminTubeComment(commentId);
        else await deleteMemberTubeComment(commentId);
        updateTube((tube) => ({
          ...tube,
          commentSaving: false,
          commentDeleteId: null,
          commentEditingId: null,
          commentError: null,
        }));
        await loadTubeComments(tubeId);
      } catch (error) {
        console.error('[AXE NET] AXE TUBE comment delete failed:', error);
        updateTube((tube) => ({
          ...tube,
          commentSaving: false,
          commentError: formatTubeError(error),
        }));
      }
    },

    onOpenEditor(tubeId = null) {
      const state = store.getState();
      if (!state.auth.member && !state.auth.admin) {
        actions.onOpenLogin();
        return;
      }

      if (tubeId) {
        const video = state.tube.videos.find((item) => item.tube_id === tubeId);
        if (!video || !canManageTubeVideo(state, video)) {
          updateTube((tube) => ({
            ...tube,
            message: '이 영상을 수정할 권한이 없습니다.',
            messageType: 'error',
          }));
          return;
        }
      }

      updateTube((tube) => ({
        ...tube,
        editor: {
          open: true,
          tubeId: tubeId || null,
          saving: false,
          error: null,
          confirmDelete: false,
          draft: null,
        },
      }));
    },

    onCloseEditor() {
      updateTube((tube) => ({
        ...tube,
        editor: {
          open: false,
          tubeId: null,
          saving: false,
          error: null,
          confirmDelete: false,
          draft: null,
        },
      }));
    },

    async onSaveVideo(values) {
      const state = store.getState();
      if (!state.auth.member && !state.auth.admin) {
        actions.onOpenLogin();
        return;
      }
      if (state.tube.editor.saving) return;

      const existing = state.tube.editor.tubeId
        ? state.tube.videos.find((item) => item.tube_id === state.tube.editor.tubeId)
        : null;
      if (existing && !canManageTubeVideo(state, existing)) {
        updateEditor({ error: '이 영상을 수정할 권한이 없습니다.' });
        return;
      }

      const normalized = normalizeTubeInput(values);
      if (normalized.error) {
        updateEditor({ error: normalized.error, draft: { ...values } });
        return;
      }

      updateEditor({ saving: true, error: null, confirmDelete: false, draft: { ...values } });
      try {
        let savedId = null;
        if (state.auth.admin) {
          savedId = await saveAdminTubeVideo({
            tube_id: existing?.tube_id || null,
            title: normalized.title,
            url: normalized.url,
            youtube_video_id: normalized.youtube_video_id,
            thumbnail_url: normalized.thumbnail_url,
            content: normalized.content,
            category: normalized.category,
            writer_member_key: existing?.writer_member_key || state.auth.admin.member_key || null,
            writer: existing?.writer || state.auth.admin.nickname || 'AXE',
            writer_badge: existing?.writer_badge || (state.auth.admin ? 'admin' : null),
          });
        } else {
          const saved = await saveMemberTubeVideo({
            tube_id: existing?.tube_id || null,
            title: normalized.title,
            url: normalized.url,
            content: normalized.content,
            category: normalized.category,
          });
          savedId = saved?.tube_id || existing?.tube_id || null;
        }

        updateTube((tube) => ({
          ...tube,
          selectedTubeId: savedId || tube.selectedTubeId,
          message: existing ? '영상 정보를 저장했습니다. 이제 이 영상은 AXE NET 기준으로 관리됩니다.' : 'AXE TUBE 영상을 등록했습니다.',
          messageType: 'success',
          editor: {
            open: false,
            tubeId: null,
            saving: false,
            error: null,
            confirmDelete: false,
            draft: null,
          },
        }));
        await reloadTubeData({ silent: true, preserveMessage: true });
      } catch (error) {
        console.error('[AXE NET] AXE TUBE save failed:', error);
        updateEditor({ saving: false, error: formatTubeError(error) });
      }
    },

    onRequestDelete() {
      const state = store.getState();
      if (!state.tube.editor.tubeId) return;
      updateEditor({ confirmDelete: true, error: null });
    },

    onCancelDelete() {
      updateEditor({ confirmDelete: false });
    },

    async onConfirmDelete() {
      const state = store.getState();
      const tubeId = state.tube.editor.tubeId;
      const video = state.tube.videos.find((item) => item.tube_id === tubeId);
      if (!tubeId || !video || !canManageTubeVideo(state, video)) {
        updateEditor({ error: '삭제할 영상 또는 권한을 확인하지 못했습니다.' });
        return;
      }
      if (state.tube.editor.saving) return;

      updateEditor({ saving: true, error: null });
      try {
        if (state.auth.admin) await deleteAdminTubeVideo(tubeId);
        else await deleteMemberTubeVideo(tubeId);

        updateTube((tube) => ({
          ...tube,
          selectedTubeId: tube.selectedTubeId === tubeId ? null : tube.selectedTubeId,
          message: '영상을 AXE TUBE 목록에서 내렸습니다.',
          messageType: 'success',
          editor: {
            open: false,
            tubeId: null,
            saving: false,
            error: null,
            confirmDelete: false,
            draft: null,
          },
        }));
        await reloadTubeData({ silent: true, preserveMessage: true });
      } catch (error) {
        console.error('[AXE NET] AXE TUBE delete failed:', error);
        updateEditor({ saving: false, error: formatTubeError(error) });
      }
    },
  };

  const rerender = (state) => {
    if (state.ui.activeModule === 'tube') renderTubeView(root, state, actions);

    const nextIdentity = identityKey(state);
    if (nextIdentity !== lastIdentity) {
      lastIdentity = nextIdentity;
      queueMicrotask(() => reloadTubeData({ silent: true }));
    }
  };

  rerender(store.getState());
  store.subscribe(rerender);
  await reloadTubeData({ silent: true });
}

async function reloadTubeData(options = {}) {
  if (reloadPromise) return reloadPromise;

  reloadPromise = (async () => {
    const current = store.getState();
    const isMember = Boolean(current.auth.member);

    updateTube((tube) => ({
      ...tube,
      loading: !options.silent,
      error: null,
      message: options.preserveMessage ? tube.message : null,
      messageType: options.preserveMessage ? tube.messageType : 'info',
    }));

    try {
      const reactionsTask = isMember
        ? fetchMemberTubeReactions().catch((error) => {
            console.warn('[AXE NET] AXE TUBE member reactions preload failed:', error);
            return [];
          })
        : Promise.resolve([]);

      // 영상 목록은 홈에서 바로 사용하므로 멤버 반응 API를 기다리지 않고 먼저 반영합니다.
      const videos = await fetchTubeVideos();

      updateTube((tube) => ({
        ...tube,
        initialized: true,
        loading: false,
        error: null,
        videos,
        reactionSavingTubeId: null,
        selectedTubeId: videos.some((item) => item.tube_id === tube.selectedTubeId)
          ? tube.selectedTubeId
          : null,
      }));

      const reactions = await reactionsTask;
      const myReactions = Object.fromEntries(
        reactions
          .filter((row) => row?.tube_id && ['like', 'dislike'].includes(String(row.reaction || '')))
          .map((row) => [String(row.tube_id), String(row.reaction)]),
      );

      updateTube((tube) => ({
        ...tube,
        myReactions,
      }));
    } catch (error) {
      console.error('[AXE NET] AXE TUBE load failed:', error);
      updateTube((tube) => ({
        ...tube,
        initialized: true,
        loading: false,
        reactionSavingTubeId: null,
        error: formatTubeError(error),
      }));
    }
  })().finally(() => {
    reloadPromise = null;
  });

  return reloadPromise;
}

async function loadTubeComments(tubeId) {
  const id = String(tubeId || '').trim();
  if (!id) return [];

  updateTube((tube) => ({
    ...tube,
    commentsLoadingTubeId: id,
    commentError: null,
  }));

  try {
    const comments = await fetchTubeComments(id);
    updateTube((tube) => ({
      ...tube,
      commentsLoadingTubeId: tube.commentsLoadingTubeId === id ? null : tube.commentsLoadingTubeId,
      commentsByTubeId: { ...tube.commentsByTubeId, [id]: comments },
      videos: tube.videos.map((item) => item.tube_id === id
        ? { ...item, comment_count: comments.length }
        : item),
      commentError: null,
    }));
    return comments;
  } catch (error) {
    updateTube((tube) => ({
      ...tube,
      commentsLoadingTubeId: tube.commentsLoadingTubeId === id ? null : tube.commentsLoadingTubeId,
      commentError: formatTubeError(error),
    }));
    throw error;
  }
}

function updateTube(updater) {
  store.updateState((state) => ({
    ...state,
    tube: updater(state.tube),
  }));
}

function updateEditor(patch) {
  updateTube((tube) => ({
    ...tube,
    editor: { ...tube.editor, ...patch },
  }));
}

function canManageTubeVideo(state, video) {
  if (state.auth?.admin) return true;
  const memberKey = String(state.auth?.member?.member_key || '');
  return Boolean(memberKey && memberKey === String(video?.writer_member_key || ''));
}

function identityKey(state) {
  return `${state.auth.member?.member_key || '-'}:${state.auth.admin?.user_id || '-'}`;
}

function normalizeTubeInput(values = {}) {
  const title = String(values.title || '').trim();
  const content = String(values.content || '').trim();
  const category = String(values.category || '').trim() || '일반';
  const youtube = parseYoutubeUrl(values.url);

  if (!title) return { error: '영상 제목을 입력하세요.' };
  if (title.length > 100) return { error: '영상 제목은 100자 이하로 입력하세요.' };
  if (!youtube) return { error: '올바른 YouTube 영상 링크를 입력하세요.' };
  if (content.length > 1500) return { error: '영상 설명은 1500자 이하로 입력하세요.' };
  if (category.length > 50) return { error: '분류는 50자 이하로 입력하세요.' };

  return {
    title,
    content,
    category,
    ...youtube,
  };
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
      youtube_video_id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

function formatTubeError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (lower.includes('sync_owner') || lower.includes('save_tube_video_admin') || lower.includes('deactivate_tube_video_admin')) {
    return 'AXE TUBE Supabase-first DB가 아직 준비되지 않았습니다. 036_tube_supabase_primary.sql을 먼저 적용하세요.';
  }
  if (lower.includes('tube_comments') || lower.includes('deactivate_tube_comment_admin')) {
    return 'AXE TUBE 댓글 DB가 아직 준비되지 않았습니다. 039_tube_comments.sql을 먼저 적용하세요.';
  }
  if (lower.includes('tube_reactions') || lower.includes('set_tube_reaction')) {
    return 'AXE TUBE 추천/비추천 DB가 아직 준비되지 않았습니다. 035_tube_reactions_bridge.sql을 먼저 적용하세요.';
  }
  if (lower.includes('tube_videos') || lower.includes('increment_tube_view')) {
    return 'AXE TUBE 데이터베이스가 아직 준비되지 않았습니다. 033_tube_module.sql과 034_tube_legacy_import.sql을 먼저 적용하세요.';
  }
  return message;
}
