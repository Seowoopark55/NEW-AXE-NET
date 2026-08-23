import { store } from '../../state/store.js';
import {
  fetchMemberOutlawData,
  fetchMemberOutlawHistory,
} from '../auth/memberAuthService.js';
import {
  fetchAdminOutlawData,
  fetchAdminOutlawHistory,
} from './outlawService.js';
import { renderOutlawView } from './outlawView.js';

const TABS = new Set(['stats', 'guide', 'map']);
let reloadPromise = null;
let historyRequestKey = null;

export async function initOutlawModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  let lastIdentity = identityKey(store.getState());

  const rerender = (state) => {
    if (state.ui.activeModule === 'outlaw') {
      renderOutlawView(root, state, actions);
    }

    const nextIdentity = identityKey(state);
    if (nextIdentity !== lastIdentity) {
      lastIdentity = nextIdentity;
      queueMicrotask(() => reloadOutlawData({ silent: true }));
    }
  };

  const actions = {
    onTabChange(tab) {
      if (!TABS.has(tab)) return;
      updateOutlaw((outlaw) => ({ ...outlaw, tab, error: null }));
    },

    onFilterChange(key, value) {
      if (!(key in store.getState().outlaw.filters)) return;
      updateOutlaw((outlaw) => ({
        ...outlaw,
        filters: { ...outlaw.filters, [key]: value },
      }));
    },

    onOpenLogin() {
      store.updateState((state) => ({
        ...state,
        auth: { ...state.auth, loginOpen: true, loginMode: 'member', error: null },
      }));
    },

    async onRefresh() {
      await reloadOutlawData();
    },

    async onSelectStat(memberKey) {
      const current = store.getState().outlaw;
      if (current.selectedMemberKey === memberKey && current.history.length) {
        updateOutlaw((outlaw) => ({ ...outlaw, selectedMemberKey: null, history: [], historyError: null }));
        return;
      }
      updateOutlaw((outlaw) => ({ ...outlaw, selectedMemberKey: memberKey, history: [], historyError: null }));
      await loadHistory(memberKey);
    },

    onCloseHistory() {
      updateOutlaw((outlaw) => ({
        ...outlaw,
        selectedMemberKey: null,
        history: [],
        historyLoading: false,
        historyError: null,
      }));
    },

    onSelectGuide(locationKey) {
      updateOutlaw((outlaw) => ({ ...outlaw, selectedLocationKey: locationKey }));
    },

    onSelectMap(mapKey) {
      updateOutlaw((outlaw) => ({ ...outlaw, selectedMapKey: mapKey }));
    },
  };

  rerender(store.getState());
  store.subscribe(rerender);
  await reloadOutlawData({ silent: true });
}

async function reloadOutlawData(options = {}) {
  if (reloadPromise) return reloadPromise;

  reloadPromise = (async () => {
    const state = store.getState();
    const canRead = Boolean(state.auth.member || state.auth.admin);

    if (!canRead) {
      updateOutlaw((outlaw) => ({
        ...outlaw,
        initialized: true,
        loading: false,
        error: null,
        stats: [],
        guideLocations: [],
        guideSteps: [],
        maps: [],
        history: [],
        selectedMemberKey: null,
      }));
      return;
    }

    updateOutlaw((outlaw) => ({
      ...outlaw,
      loading: !options.silent,
      error: null,
    }));

    try {
      const next = state.auth.admin
        ? await fetchAdminOutlawData()
        : await fetchMemberOutlawData();

      updateOutlaw((outlaw) => ({
        ...outlaw,
        initialized: true,
        loading: false,
        error: null,
        stats: next.stats || [],
        guideLocations: next.guideLocations || [],
        guideSteps: next.guideSteps || [],
        maps: next.maps || [],
        selectedLocationKey: pickExistingKey(
          outlaw.selectedLocationKey,
          next.guideLocations || [],
          'location_key',
        ),
        selectedMapKey: pickExistingKey(
          outlaw.selectedMapKey,
          next.maps || [],
          'map_key',
        ),
      }));

      const selected = store.getState().outlaw.selectedMemberKey;
      if (selected && (next.stats || []).some((row) => row.member_key === selected)) {
        await loadHistory(selected, { silent: true });
      }
    } catch (error) {
      console.error('[NEW AXE NET] outlaw data load failed:', error);
      updateOutlaw((outlaw) => ({
        ...outlaw,
        initialized: true,
        loading: false,
        error: formatOutlawError(error),
      }));
    }
  })().finally(() => {
    reloadPromise = null;
  });

  return reloadPromise;
}

async function loadHistory(memberKey, options = {}) {
  if (!memberKey) return;
  const requestKey = `${identityKey(store.getState())}|${memberKey}`;
  historyRequestKey = requestKey;

  updateOutlaw((outlaw) => ({
    ...outlaw,
    historyLoading: !options.silent,
    historyError: null,
  }));

  try {
    const state = store.getState();
    const rows = state.auth.admin
      ? await fetchAdminOutlawHistory(memberKey)
      : await fetchMemberOutlawHistory(memberKey);

    if (historyRequestKey !== requestKey) return;
    updateOutlaw((outlaw) => ({
      ...outlaw,
      history: rows || [],
      historyLoading: false,
      historyError: null,
    }));
  } catch (error) {
    if (historyRequestKey !== requestKey) return;
    console.error('[NEW AXE NET] outlaw history load failed:', error);
    updateOutlaw((outlaw) => ({
      ...outlaw,
      history: [],
      historyLoading: false,
      historyError: formatOutlawError(error),
    }));
  }
}

function updateOutlaw(updater) {
  store.updateState((state) => ({ ...state, outlaw: updater(state.outlaw) }));
}

function pickExistingKey(currentKey, rows, key) {
  if (currentKey && rows.some((row) => row[key] === currentKey)) return currentKey;
  return rows[0]?.[key] || null;
}

function identityKey(state) {
  return `${state.auth.member?.member_key || '-'}|${state.auth.admin?.user_id || state.auth.user?.id || '-'}`;
}

function formatOutlawError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (lower.includes('outlaw_') || message.includes('030_outlaw_module.sql')) {
    return '무법지대 데이터베이스가 아직 준비되지 않았습니다. 030_outlaw_module.sql과 031_outlaw_legacy_import.sql 적용 여부를 확인하세요.';
  }
  return message;
}
