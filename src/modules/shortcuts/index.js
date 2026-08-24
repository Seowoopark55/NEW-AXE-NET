import { store } from '../../state/store.js';
import { navigateToShortcut } from './shortcutTargets.js';
import {
  deleteShortcut,
  fetchShortcuts,
  reorderShortcuts,
  saveShortcut,
} from './shortcutsService.js';
import { renderShortcutsView } from './shortcutsView.js';

let loadedIdentityKey = null;
let loadingPromise = null;

export async function initShortcutsModule() {
  const root = document.querySelector('#quick-access-root');
  if (!root) throw new Error('#quick-access-root element not found.');

  // The top bar uses backdrop-filter, which creates a containing block for fixed
  // descendants in modern browsers. Keep the manager modal in a body-level
  // portal so `position: fixed` is always based on the viewport.
  const modalRoot = ensureShortcutModalRoot();
  const rerender = () => renderShortcutsView(root, modalRoot, store.getState(), buildActions());
  rerender();

  store.subscribe((state) => {
    rerender();
    const identity = getShortcutIdentity(state);
    const identityKey = identity ? `${identity.mode}:${identity.memberKey}` : null;
    if (identityKey !== loadedIdentityKey) {
      loadedIdentityKey = identityKey;
      if (identity) void loadShortcuts();
      else clearShortcuts();
    }
  });

  const identity = getShortcutIdentity(store.getState());
  loadedIdentityKey = identity ? `${identity.mode}:${identity.memberKey}` : null;
  if (identity) await loadShortcuts();
}


function ensureShortcutModalRoot() {
  let root = document.querySelector('#quick-access-modal-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'quick-access-modal-root';
  document.body.appendChild(root);
  return root;
}

function buildActions() {
  return {
    onToggle() {
      updateShortcuts((current) => ({ ...current, open: !current.open, error: null }));
    },

    onOpenShortcut(targetKey) {
      const ok = navigateToShortcut(targetKey);
      updateShortcuts((current) => ({
        ...current,
        open: false,
        error: ok ? null : '현재 계정으로 접근할 수 없는 기능입니다.',
      }));
    },

    onOpenManager() {
      updateShortcuts((current) => ({ ...current, open: false, managerOpen: true, editingId: null, error: null }));
    },

    onCloseManager() {
      updateShortcuts((current) => ({ ...current, managerOpen: false, editingId: null, error: null }));
    },

    onEdit(id) {
      updateShortcuts((current) => ({ ...current, editingId: id || null, error: null }));
    },

    async onSave(values) {
      const current = store.getState().shortcuts;
      if (!values.label || !values.target_key) {
        updateShortcuts((next) => ({ ...next, error: '이름과 이동 위치를 모두 입력하세요.' }));
        return;
      }

      updateShortcuts((next) => ({ ...next, saving: true, error: null }));
      try {
        await saveShortcut(getShortcutIdentity(store.getState()), {
          id: current.editingId,
          label: values.label,
          target_key: values.target_key,
        });
        await loadShortcuts({ preserveManager: true });
        updateShortcuts((next) => ({ ...next, saving: false, editingId: null, managerOpen: true, error: null }));
      } catch (error) {
        updateShortcuts((next) => ({ ...next, saving: false, error: formatError(error) }));
      }
    },

    async onDelete(id) {
      const item = store.getState().shortcuts.items.find((row) => Number(row.id) === Number(id));
      if (!item) return;
      if (!window.confirm(`'${item.label}' 바로가기를 삭제할까요?`)) return;

      try {
        await deleteShortcut(getShortcutIdentity(store.getState()), id);
        await loadShortcuts({ preserveManager: true });
        updateShortcuts((next) => ({ ...next, managerOpen: true, editingId: null, error: null }));
      } catch (error) {
        updateShortcuts((next) => ({ ...next, error: formatError(error) }));
      }
    },

    async onMove(id, direction) {
      const items = [...store.getState().shortcuts.items];
      const index = items.findIndex((row) => Number(row.id) === Number(id));
      if (index < 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return;

      [items[index], items[targetIndex]] = [items[targetIndex], items[index]];
      updateShortcuts((current) => ({ ...current, items, error: null }));

      try {
        const reordered = await reorderShortcuts(getShortcutIdentity(store.getState()), items.map((item) => item.id));
        updateShortcuts((current) => ({ ...current, items: reordered, managerOpen: true, error: null }));
      } catch (error) {
        updateShortcuts((current) => ({ ...current, error: formatError(error) }));
        await loadShortcuts({ preserveManager: true });
      }
    },
  };
}

async function loadShortcuts(options = {}) {
  if (loadingPromise) return loadingPromise;
  const identity = getShortcutIdentity(store.getState());
  if (!identity) return [];
  const identityKey = `${identity.mode}:${identity.memberKey}`;

  updateShortcuts((current) => ({ ...current, loading: true, error: null }));
  loadingPromise = (async () => {
    try {
      const items = await fetchShortcuts(identity);
      const currentIdentity = getShortcutIdentity(store.getState());
      if (!currentIdentity || `${currentIdentity.mode}:${currentIdentity.memberKey}` !== identityKey) return [];
      updateShortcuts((current) => ({
        ...current,
        initialized: true,
        loading: false,
        items,
        managerOpen: options.preserveManager ? current.managerOpen : current.managerOpen,
        error: null,
      }));
      return items;
    } catch (error) {
      const currentIdentity = getShortcutIdentity(store.getState());
      if (currentIdentity && `${currentIdentity.mode}:${currentIdentity.memberKey}` === identityKey) {
        updateShortcuts((current) => ({ ...current, initialized: true, loading: false, error: formatError(error) }));
      }
      return [];
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

function getShortcutIdentity(state) {
  const memberKey = state.auth?.member?.member_key || null;
  if (memberKey) return { mode: 'member', memberKey };

  const adminMemberKey = state.auth?.admin?.member_key || null;
  if (adminMemberKey) return { mode: 'admin', memberKey: adminMemberKey };

  return null;
}

function clearShortcuts() {
  updateShortcuts(() => ({
    initialized: false,
    loading: false,
    items: [],
    open: false,
    managerOpen: false,
    editingId: null,
    saving: false,
    error: null,
  }));
}

function updateShortcuts(updater) {
  store.updateState((state) => ({
    ...state,
    shortcuts: updater(state.shortcuts),
  }));
}

function formatError(error) {
  if (error?.status === 401 || error?.status === 403) return '로그인 세션을 확인해주세요.';
  return error?.message || String(error);
}
