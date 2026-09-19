import { store } from '../../state/store.js';
import {
  fetchCookingOrderSettings,
  saveCookingOrderConfig,
  saveCookingOrderType,
  setCookingOrderTypeEnabled,
} from './cookingControlService.js';
import { renderCookingControlView } from './cookingControlView.js';

let reloadPromise = null;

export async function initCookingControlModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const actions = {
    async onRefresh() {
      await reloadCookingSettings();
    },

    onSearch(value) {
      updateCooking((current) => ({ ...current, search: String(value || '') }));
    },

    onFilter(value) {
      const next = ['all', 'enabled', 'disabled'].includes(value) ? value : 'all';
      updateCooking((current) => ({ ...current, filter: next }));
    },

    onOpenNew() {
      requireAdmin();
      const types = store.getState().cookingControl.types || [];
      const maxSort = types.reduce((max, row) => Math.max(max, Number(row.sort_order || 0)), 0);
      updateCooking((current) => ({
        ...current,
        editor: {
          open: true,
          typeKey: null,
          label: '',
          shortLabel: '',
          detail: '',
          pricePerSet: 0,
          sortOrder: maxSort + 10,
          enabled: true,
          saving: false,
          error: null,
        },
      }));
    },

    onEdit(typeKey) {
      requireAdmin();
      const row = (store.getState().cookingControl.types || []).find((item) => String(item.type_key) === String(typeKey));
      if (!row) return;
      updateCooking((current) => ({
        ...current,
        editor: {
          open: true,
          typeKey: String(row.type_key),
          label: String(row.label || ''),
          shortLabel: String(row.short_label || ''),
          detail: String(row.detail || ''),
          pricePerSet: Number(row.price_per_set || 0),
          sortOrder: Number(row.sort_order || 0),
          enabled: row.enabled !== false,
          saving: false,
          error: null,
        },
      }));
    },

    onCloseEditor() {
      updateCooking((current) => ({ ...current, editor: emptyEditor() }));
    },

    async onSaveMenu(values) {
      requireAdmin();
      const label = String(values.label || '').trim();
      if (!label) {
        setEditorError('메뉴 이름을 입력해 주세요.');
        return;
      }
      const price = Number(values.pricePerSet || 0);
      const sortOrder = Number(values.sortOrder || 0);
      if (!Number.isFinite(price) || price < 0) {
        setEditorError('가격을 0 이상의 숫자로 입력해 주세요.');
        return;
      }
      if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        setEditorError('정렬 순서를 0 이상의 숫자로 입력해 주세요.');
        return;
      }

      setEditorSaving(true, null);
      try {
        await saveCookingOrderType({
          typeKey: values.typeKey,
          label,
          shortLabel: values.shortLabel || label,
          detail: values.detail,
          pricePerSet: price,
          sortOrder,
          enabled: values.enabled,
        });
        updateCooking((current) => ({
          ...current,
          editor: emptyEditor(),
          message: values.typeKey ? '요리 메뉴를 저장했습니다.' : '새 요리 메뉴를 추가했습니다.',
        }));
        await reloadCookingSettings({ preserveMessage: true, silent: true });
      } catch (error) {
        setEditorSaving(false, formatError(error));
      }
    },

    async onToggle(typeKey, enabled) {
      requireAdmin();
      const row = (store.getState().cookingControl.types || []).find((item) => String(item.type_key) === String(typeKey));
      if (!row) return;
      const next = Boolean(enabled);
      const verb = next ? '사용' : '숨김';
      if (!window.confirm(`“${row.label || row.type_key}” 메뉴를 ${verb} 상태로 바꿀까요?\n\n기존 주문 기록은 삭제되지 않습니다.`)) return;
      try {
        await setCookingOrderTypeEnabled(typeKey, next);
        updateCooking((current) => ({ ...current, message: next ? '요리 메뉴를 다시 사용합니다.' : '요리 메뉴를 주문 선택지에서 숨겼습니다.' }));
        await reloadCookingSettings({ preserveMessage: true, silent: true });
      } catch (error) {
        updateCooking((current) => ({ ...current, error: formatError(error) }));
      }
    },

    async onSaveGuide(values) {
      requireAdmin();
      updateCooking((current) => ({ ...current, savingGuide: true, error: null, message: null }));
      try {
        const saved = await saveCookingOrderConfig(values);
        updateCooking((current) => ({
          ...current,
          savingGuide: false,
          config: saved && typeof saved === 'object' ? saved : current.config,
          message: 'Discord 요리 주문 안내를 저장했습니다.',
        }));
      } catch (error) {
        updateCooking((current) => ({ ...current, savingGuide: false, error: formatError(error) }));
      }
    },
  };

  const rerender = (state) => {
    if (state.ui.activeModule !== 'cooking-control') return;
    renderCookingControlView(root, state, actions);
  };

  rerender(store.getState());
  store.subscribe(rerender);
  await reloadCookingSettings({ silent: true });
}

async function reloadCookingSettings(options = {}) {
  if (reloadPromise) return reloadPromise;
  if (!store.getState().auth.admin) {
    updateCooking((current) => ({ ...current, initialized: true, loading: false, types: [], config: {}, error: null }));
    return null;
  }

  if (!options.silent) {
    updateCooking((current) => ({ ...current, loading: true, error: null, message: options.preserveMessage ? current.message : null }));
  }

  reloadPromise = fetchCookingOrderSettings()
    .then(({ config, types }) => {
      updateCooking((current) => ({
        ...current,
        initialized: true,
        loading: false,
        error: null,
        message: options.preserveMessage ? current.message : null,
        config,
        types,
      }));
      return { config, types };
    })
    .catch((error) => {
      updateCooking((current) => ({ ...current, initialized: true, loading: false, error: formatError(error) }));
      return null;
    })
    .finally(() => { reloadPromise = null; });

  return reloadPromise;
}

function updateCooking(updater) {
  store.updateState((state) => ({
    ...state,
    cookingControl: updater(state.cookingControl),
  }));
}

function setEditorSaving(saving, error) {
  updateCooking((current) => ({ ...current, editor: { ...current.editor, saving, error } }));
}

function setEditorError(error) {
  setEditorSaving(false, error);
}

function emptyEditor() {
  return {
    open: false,
    typeKey: null,
    label: '',
    shortLabel: '',
    detail: '',
    pricePerSet: 0,
    sortOrder: 0,
    enabled: true,
    saving: false,
    error: null,
  };
}

function requireAdmin() {
  if (!store.getState().auth.admin) throw new Error('관리자 권한이 필요합니다.');
}

function formatError(error) {
  const message = error?.message || String(error);
  if (/관리자 권한|permission denied|row-level security/i.test(message)) return '관리자 권한이 필요합니다.';
  return message;
}
