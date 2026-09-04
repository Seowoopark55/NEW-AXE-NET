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

  // 홈은 원격 데이터 없이도 렌더링할 수 있으므로 인증보다 먼저 보여줍니다.
  initHomeModule();

  // 연결 상태 확인은 다른 초기화와 독립적이므로 병렬로 시작합니다.
  void startSystemHealthCheck();

  // 인증은 멤버/관리자별 데이터 접근 권한의 기준이므로 먼저 확정합니다.
  await initAuthModule();

  // 독립적인 초기 조회를 병렬 실행해 직렬 네트워크 대기를 없앱니다.
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
