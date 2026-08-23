import { store } from '../../state/store.js';
import {
  fetchMemberTubeReactions,
  setMemberTubeReaction,
} from '../auth/memberAuthService.js';
import { fetchTubeVideos, incrementTubeView } from './tubeService.js';
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

      updateTube((tube) => ({ ...tube, selectedTubeId: tubeId }));

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
        console.warn('[NEW AXE NET] AXE TUBE view increment failed:', error);
      }
    },

    onCloseVideo() {
      updateTube((tube) => ({ ...tube, selectedTubeId: null }));
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
        console.error('[NEW AXE NET] AXE TUBE reaction failed:', error);
        updateTube((tube) => ({
          ...tube,
          reactionSavingTubeId: null,
          message: formatTubeError(error),
        }));
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
    }));

    try {
      const [videos, reactions] = await Promise.all([
        fetchTubeVideos(),
        isMember ? fetchMemberTubeReactions() : Promise.resolve([]),
      ]);
      const myReactions = Object.fromEntries(
        reactions
          .filter((row) => row?.tube_id && ['like', 'dislike'].includes(String(row.reaction || '')))
          .map((row) => [String(row.tube_id), String(row.reaction)]),
      );

      updateTube((tube) => ({
        ...tube,
        initialized: true,
        loading: false,
        error: null,
        videos,
        myReactions,
        reactionSavingTubeId: null,
        selectedTubeId: videos.some((item) => item.tube_id === tube.selectedTubeId)
          ? tube.selectedTubeId
          : null,
      }));
    } catch (error) {
      console.error('[NEW AXE NET] AXE TUBE load failed:', error);
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

function updateTube(updater) {
  store.updateState((state) => ({
    ...state,
    tube: updater(state.tube),
  }));
}

function identityKey(state) {
  return `${state.auth.member?.member_key || '-'}`;
}

function formatTubeError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (lower.includes('tube_reactions') || lower.includes('set_tube_reaction')) {
    return 'AXE TUBE 추천/비추천 DB가 아직 준비되지 않았습니다. 035_tube_reactions_bridge.sql을 먼저 적용하세요.';
  }
  if (lower.includes('tube_videos') || lower.includes('increment_tube_view')) {
    return 'AXE TUBE 데이터베이스가 아직 준비되지 않았습니다. 033_tube_module.sql과 034_tube_legacy_import.sql을 먼저 적용하세요.';
  }
  return message;
}
