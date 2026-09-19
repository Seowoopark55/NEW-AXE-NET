import './styles/main.css';
import './styles/axe-ui-system.css';
import './styles/operations-shell.css';
import './modules/members/operations-members.css';
import './modules/home/home.css';
import './modules/shortcuts/shortcuts.css';
import './modules/notice/notice.css';
import './modules/info/info.css';
import './modules/assets/assets.css';
import './modules/outlaw/outlaw.css';
import './modules/tube/tube.css';
import './modules/ai/ai.css';
import './modules/system-control/system-control.css';
import './styles/professional-polish.css';
import { store } from './state/store.js';
import { renderAppShell } from './components/AppShell.js';
import { initAuthModule } from './modules/auth/index.js';
import { initShortcutsModule } from './modules/shortcuts/index.js';
import { initMembersModule } from './modules/members/index.js';
import { initHomeModule } from './modules/home/index.js';
import { initNoticeModule } from './modules/notice/index.js';
import { initInfoModule } from './modules/info/index.js';
import { initAssetsModule } from './modules/assets/index.js';
import { initOutlawModule } from './modules/outlaw/index.js';
import { initTubeModule } from './modules/tube/index.js';
import { initFundModule } from './modules/fund/index.js';
import { initAiModule } from './modules/ai/index.js';
import { initSystemControlModule, isAxeNetRuntimeEnabled } from './modules/system-control/index.js';
import { runSupabaseHealthCheck } from './modules/system/systemService.js';
import { installHistoryRouter } from './utils/historyRouter.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('#app element not found.');
}

installHistoryRouter(store);
renderAppShell(app);

async function bootstrap() {
  store.setState({
    app: {
      ...store.getState().app,
      ready: true,
    },
  });

  // 홈은 원격 데이터 없이도 그릴 수 있으므로 기존 UX 기준대로 즉시 렌더링합니다.
  // 운영 스위치가 OFF이면 상태 확인 직후 중지 화면으로 교체됩니다.
  initHomeModule();

  // 연결 상태 확인은 인증/운영 스위치와 독립적으로 시작합니다.
  void startSystemHealthCheck();

  // OFF 상태에서도 최고관리자가 로그인해 다시 켤 수 있어야 하므로 인증을 먼저 복원합니다.
  await initAuthModule();

  // AXE NET / AXE BOT 중앙 운영 상태는 공개 상태 RPC로 조회합니다.
  await initSystemControlModule();

  let featureModulesInitialized = false;

  const applyRuntimeGate = async () => {
    const state = store.getState();
    const enabled = isAxeNetRuntimeEnabled();
    const isSuperadmin = state.auth.admin?.admin_level === 'superadmin';

    document.body.classList.toggle('axe-net-runtime-off', enabled === false);

    if (enabled === false) {
      if (isSuperadmin) {
        if (state.ui.activeModule !== 'system-control') {
          store.updateState((current) => ({
            ...current,
            ui: { ...current.ui, activeModule: 'system-control' },
          }));
        }
      } else {
        if (state.ui.activeModule !== 'runtime-off') {
          store.updateState((current) => ({
            ...current,
            ui: { ...current.ui, activeModule: 'runtime-off' },
          }));
          return;
        }
        renderRuntimeOffScreen();
      }
      return;
    }

    if (enabled === null) {
      renderRuntimeStateError();
      return;
    }

    document.body.classList.remove('axe-net-runtime-off');
    if (state.ui.activeModule === 'runtime-off') {
      store.updateState((current) => ({
        ...current,
        ui: { ...current.ui, activeModule: 'home' },
      }));
      return;
    }
    if (featureModulesInitialized) return;
    featureModulesInitialized = true;

    const initializers = [
      ['shortcuts', initShortcutsModule],
      ['notice', initNoticeModule],
      ['info', initInfoModule],
      ['members', initMembersModule],
      ['assets', initAssetsModule],
      ['outlaw', initOutlawModule],
      ['tube', initTubeModule],
      ['fund', initFundModule],
      ['ai', initAiModule],
    ];

    const results = await Promise.allSettled(
      initializers.map(([, initializer]) => initializer()),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[AXE NET] ${initializers[index][0]} module init failed:`, result.reason);
      }
    });
  };

  let applyingGate = false;
  let gateQueued = false;
  const scheduleGate = () => {
    if (applyingGate) {
      gateQueued = true;
      return;
    }
    applyingGate = true;
    Promise.resolve(applyRuntimeGate())
      .catch((error) => console.error('[AXE NET] runtime gate failed:', error))
      .finally(() => {
        applyingGate = false;
        if (gateQueued) {
          gateQueued = false;
          scheduleGate();
        }
      });
  };

  store.subscribe(scheduleGate);
  scheduleGate();

}

function renderRuntimeOffScreen() {
  const root = document.querySelector('#module-root');
  if (!root) return;
  root.innerHTML = `
    <section class="ops-runtime-off-screen" aria-label="AXE NET 운영 중지">
      <span>AXE NET</span>
      <h1>현재 운영이 중지되어 있습니다.</h1>
      <p>서비스 기능이 일시적으로 비활성화되어 있습니다.<br />저장된 데이터와 설정은 그대로 보존됩니다.</p>
      <small>최고관리자는 우측 상단 관리자 인증 후 시스템을 다시 시작할 수 있습니다.</small>
    </section>
  `;
}

function renderRuntimeStateError() {
  const root = document.querySelector('#module-root');
  if (!root) return;
  root.innerHTML = `
    <section class="ops-runtime-off-screen" aria-label="AXE NET 상태 확인 실패">
      <span>AXE NET</span>
      <h1>운영 상태를 확인하고 있습니다.</h1>
      <p>시스템 제어 상태를 불러오지 못했습니다. 잠시 후 자동으로 다시 확인합니다.</p>
    </section>
  `;
}

async function startSystemHealthCheck() {
  store.updateState((state) => ({
    ...state,
    system: {
      ...state.system,
      checking: true,
      error: null,
    },
  }));

  try {
    const result = await runSupabaseHealthCheck();

    store.updateState((state) => ({
      ...state,
      system: {
        checking: false,
        connected: true,
        message: result?.value ?? 'connected',
        error: null,
      },
    }));
  } catch (error) {
    console.error('[AXE NET] Supabase health check failed:', error);

    store.updateState((state) => ({
      ...state,
      system: {
        checking: false,
        connected: false,
        message: null,
        error: error?.message ?? String(error),
      },
    }));
  }
}

bootstrap().catch((error) => {
  console.error('[AXE NET] bootstrap failed:', error);
});
