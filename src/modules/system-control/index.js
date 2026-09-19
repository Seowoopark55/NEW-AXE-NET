import { store } from '../../state/store.js';
import { fetchRuntimeControls, setRuntimeControl } from './systemControlService.js';
import { renderSystemControlView } from './systemControlView.js';

let refreshPromise = null;
let pollTimer = null;

export async function initSystemControlModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    const state = store.getState();
    if (state.ui.activeModule !== 'system-control') return;

    renderSystemControlView(root, state, {
      onRefresh() { void refreshRuntimeControls(); },
      async onToggle(systemKey, nextEnabled) {
        if (!isSuperadmin()) return;
        const label = systemKey === 'axe_bot' ? 'AXE BOT' : 'AXE NET';
        const verb = nextEnabled ? '운영을 시작' : '운영을 중지';
        const detail = nextEnabled
          ? '저장된 데이터와 설정을 그대로 사용해 서비스 기능을 다시 활성화합니다.'
          : '서비스 기능이 차단됩니다. 데이터와 설정은 삭제되지 않습니다.';
        if (!window.confirm(`${label} ${verb}하시겠습니까?\n\n${detail}`)) return;

        store.updateState((current) => ({
          ...current,
          runtimeControl: { ...current.runtimeControl, savingKey: systemKey, error: null },
        }));

        try {
          await setRuntimeControl(systemKey, nextEnabled);
          await refreshRuntimeControls({ silent: true });
        } catch (error) {
          store.updateState((current) => ({
            ...current,
            runtimeControl: {
              ...current.runtimeControl,
              savingKey: null,
              error: formatError(error),
            },
          }));
        }
      },
    });
  };

  rerender();
  store.subscribe(rerender);

  await refreshRuntimeControls();
  if (!pollTimer) {
    pollTimer = window.setInterval(() => void refreshRuntimeControls({ silent: true }), 15_000);
  }
}

export async function refreshRuntimeControls(options = {}) {
  if (refreshPromise) return refreshPromise;
  if (!options.silent) {
    store.updateState((state) => ({
      ...state,
      runtimeControl: { ...state.runtimeControl, loading: true, error: null },
    }));
  }

  refreshPromise = fetchRuntimeControls()
    .then((rows) => {
      const items = {};
      for (const row of rows) {
        if (!row?.system_key) continue;
        items[row.system_key] = {
          enabled: row.enabled !== false,
          updated_at: row.updated_at || null,
        };
      }
      store.updateState((state) => ({
        ...state,
        runtimeControl: {
          ...state.runtimeControl,
          initialized: true,
          loading: false,
          savingKey: null,
          error: null,
          items,
        },
      }));
      return items;
    })
    .catch((error) => {
      store.updateState((state) => ({
        ...state,
        runtimeControl: {
          ...state.runtimeControl,
          initialized: true,
          loading: false,
          savingKey: null,
          error: formatError(error),
        },
      }));
      return null;
    })
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}

export function isAxeNetRuntimeEnabled() {
  const runtime = store.getState().runtimeControl;
  if (!runtime?.initialized) return null;
  const item = runtime.items?.axe_net;
  if (!item) return null;
  return item.enabled !== false;
}

function isSuperadmin() {
  return store.getState().auth.admin?.admin_level === 'superadmin';
}

function formatError(error) {
  const message = error?.message || String(error);
  if (/최고관리자|permission denied|row-level security/i.test(message)) {
    return '최고관리자 권한이 필요합니다.';
  }
  return message;
}
