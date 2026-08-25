import { store } from '../../state/store.js';
import {
  fetchMemberOutlawData,
  fetchMemberOutlawHistory,
} from '../auth/memberAuthService.js';
import {
  deactivateOutlawBriefingMap,
  deactivateOutlawGuideLocation,
  deactivateOutlawGuideStep,
  fetchAdminOutlawData,
  fetchAdminOutlawHistory,
  saveOutlawBriefingMap,
  saveOutlawGuideLocation,
  saveOutlawGuideStep,
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

    onOpenAdmin(type, itemId = null) {
      requireAdmin();
      const supported = new Set(['guide-location', 'guide-step', 'briefing-map']);
      if (!supported.has(type)) return;
      const normalizedId = type === 'guide-step' && itemId !== null && itemId !== ''
        ? Number(itemId)
        : itemId;
      updateOutlaw((outlaw) => ({
        ...outlaw,
        modal: { type, itemId: normalizedId, saving: false, error: null },
      }));
    },

    onCloseAdmin() {
      closeAdminModal();
    },

    async onSaveAdmin(type, values) {
      requireAdmin();
      setAdminModalSaving(true, null);
      try {
        if (type === 'guide-location') {
          validateGuideLocation(values);
          const key = await saveOutlawGuideLocation(values);
          closeAdminModal();
          setOutlawMessage('공략 지역을 저장했습니다.');
          await reloadOutlawData({ preserveMessage: true });
          updateOutlaw((outlaw) => ({ ...outlaw, selectedLocationKey: key || values.location_key }));
        } else if (type === 'guide-step') {
          validateGuideStep(values);
          await saveOutlawGuideStep(values);
          closeAdminModal();
          setOutlawMessage('공략 단계를 저장했습니다.');
          await reloadOutlawData({ preserveMessage: true });
          updateOutlaw((outlaw) => ({ ...outlaw, selectedLocationKey: values.location_key }));
        } else if (type === 'briefing-map') {
          validateBriefingMap(values);
          const key = await saveOutlawBriefingMap(values);
          closeAdminModal();
          setOutlawMessage('브리핑맵을 저장했습니다.');
          await reloadOutlawData({ preserveMessage: true });
          updateOutlaw((outlaw) => ({ ...outlaw, selectedMapKey: key || values.map_key }));
        } else {
          throw new Error('지원하지 않는 관리 작업입니다.');
        }
      } catch (error) {
        console.error('[AXE NET] outlaw admin save failed:', error);
        setAdminModalSaving(false, formatOutlawError(error));
      }
    },

    async onDeactivateAdmin(type, itemId) {
      requireAdmin();
      const label = type === 'guide-location' ? '이 공략 지역'
        : type === 'guide-step' ? '이 공략 단계'
        : '이 브리핑맵';
      if (!window.confirm(`${label}을 목록에서 내릴까요?`)) return;

      try {
        if (type === 'guide-location') {
          await deactivateOutlawGuideLocation(itemId);
          setOutlawMessage('공략 지역을 목록에서 내렸습니다.');
        } else if (type === 'guide-step') {
          await deactivateOutlawGuideStep(Number(itemId));
          setOutlawMessage('공략 단계를 목록에서 내렸습니다.');
        } else if (type === 'briefing-map') {
          await deactivateOutlawBriefingMap(itemId);
          setOutlawMessage('브리핑맵을 목록에서 내렸습니다.');
        } else {
          return;
        }
        closeAdminModal();
        await reloadOutlawData({ preserveMessage: true });
      } catch (error) {
        window.alert(formatOutlawError(error));
      }
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
      message: options.preserveMessage ? outlaw.message : null,
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
      console.error('[AXE NET] outlaw data load failed:', error);
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
    console.error('[AXE NET] outlaw history load failed:', error);
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


function closeAdminModal() {
  updateOutlaw((outlaw) => ({
    ...outlaw,
    modal: { type: null, itemId: null, saving: false, error: null },
  }));
}

function setAdminModalSaving(saving, error) {
  updateOutlaw((outlaw) => ({
    ...outlaw,
    modal: { ...outlaw.modal, saving, error },
  }));
}

function setOutlawMessage(message) {
  updateOutlaw((outlaw) => ({ ...outlaw, message }));
  window.setTimeout(() => {
    if (store.getState().outlaw.message === message) {
      updateOutlaw((outlaw) => ({ ...outlaw, message: null }));
    }
  }, 2400);
}

function requireAdmin() {
  if (!store.getState().auth.admin) throw new Error('관리자 권한이 필요합니다.');
}

function validateGuideLocation(values) {
  if (!String(values.location_key || '').trim()) throw new Error('지역 키를 입력하세요.');
  if (!String(values.map_name || '').trim()) throw new Error('지역명을 입력하세요.');
}

function validateGuideStep(values) {
  if (!String(values.location_key || '').trim()) throw new Error('공략 지역을 선택하세요.');
  if (!String(values.step_no || '').trim()) throw new Error('단계 번호를 입력하세요.');
  if (!String(values.title || '').trim()) throw new Error('단계 제목을 입력하세요.');
}

function validateBriefingMap(values) {
  if (!String(values.map_key || '').trim()) throw new Error('맵 키를 입력하세요.');
  if (!String(values.map_name || '').trim()) throw new Error('맵 이름을 입력하세요.');
}

function identityKey(state) {
  return `${state.auth.member?.member_key || '-'}|${state.auth.admin?.user_id || state.auth.user?.id || '-'}`;
}

function formatOutlawError(error) {
  const message = String(error?.message || error || '오류가 발생했습니다.');
  const lower = message.toLowerCase();
  if (message.includes('관리자 권한')) return '관리자 권한이 필요합니다.';
  if (lower.includes('save_outlaw_') || lower.includes('deactivate_outlaw_')) {
    return '무법지대 관리자 관리 기능이 아직 준비되지 않았습니다. 032_outlaw_admin_management.sql 적용 여부를 확인하세요.';
  }
  if (lower.includes('outlaw_') || message.includes('030_outlaw_module.sql')) {
    return '무법지대 데이터베이스가 아직 준비되지 않았습니다. 030_outlaw_module.sql과 031_outlaw_legacy_import.sql 적용 여부를 확인하세요.';
  }
  return message;
}
