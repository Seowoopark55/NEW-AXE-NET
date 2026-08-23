import { store } from '../../state/store.js';
import { fetchTubeVideos, incrementTubeView } from './tubeService.js';
import { renderTubeView } from './tubeView.js';

let reloadPromise = null;
const SORTS = new Set(['recent', 'views', 'likes']);

export async function initTubeModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const actions = {
    async onRefresh() {
      await reloadTubeData();
    },

    onFilterChange(key, value) {
      if (!(key in store.getState().tube.filters)) return;
      store.updateState((state) => ({
        ...state,
        tube: {
          ...state.tube,
          filters: {
            ...state.tube.filters,
            [key]: key === 'sort' && !SORTS.has(value) ? 'recent' : value,
          },
        },
      }));
    },

    async onOpenVideo(tubeId) {
      const video = store.getState().tube.videos.find((item) => item.tube_id === tubeId);
      if (!video) return;

      store.updateState((state) => ({
        ...state,
        tube: { ...state.tube, selectedTubeId: tubeId },
      }));

      try {
        const nextViews = await incrementTubeView(tubeId);
        if (Number.isFinite(Number(nextViews))) {
          store.updateState((state) => ({
            ...state,
            tube: {
              ...state.tube,
              videos: state.tube.videos.map((item) => item.tube_id === tubeId
                ? { ...item, views: Number(nextViews) }
                : item),
            },
          }));
        }
      } catch (error) {
        console.warn('[NEW AXE NET] AXE TUBE view increment failed:', error);
      }
    },

    onCloseVideo() {
      store.updateState((state) => ({
        ...state,
        tube: { ...state.tube, selectedTubeId: null },
      }));
    },
  };

  const rerender = (state) => {
    if (state.ui.activeModule === 'tube') renderTubeView(root, state, actions);
  };

  rerender(store.getState());
  store.subscribe(rerender);
  await reloadTubeData({ silent: true });
}

async function reloadTubeData(options = {}) {
  if (reloadPromise) return reloadPromise;

  reloadPromise = (async () => {
    store.updateState((state) => ({
      ...state,
      tube: {
        ...state.tube,
        loading: !options.silent,
        error: null,
      },
    }));

    try {
      const videos = await fetchTubeVideos();
      store.updateState((state) => ({
        ...state,
        tube: {
          ...state.tube,
          initialized: true,
          loading: false,
          error: null,
          videos,
          selectedTubeId: videos.some((item) => item.tube_id === state.tube.selectedTubeId)
            ? state.tube.selectedTubeId
            : null,
        },
      }));
    } catch (error) {
      console.error('[NEW AXE NET] AXE TUBE load failed:', error);
      store.updateState((state) => ({
        ...state,
        tube: {
          ...state.tube,
          initialized: true,
          loading: false,
          error: formatTubeError(error),
        },
      }));
    }
  })().finally(() => {
    reloadPromise = null;
  });

  return reloadPromise;
}

function formatTubeError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (lower.includes('tube_videos') || lower.includes('increment_tube_view')) {
    return 'AXE TUBE 데이터베이스가 아직 준비되지 않았습니다. 033_tube_module.sql과 034_tube_legacy_import.sql을 먼저 적용하세요.';
  }
  return message;
}
