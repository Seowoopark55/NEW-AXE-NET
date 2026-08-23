import './styles/main.css';
import './styles/axe-ui-system.css';
import './styles/operations-shell.css';
import './modules/members/operations-members.css';
import './modules/home/home.css';
import './modules/notice/notice.css';
import './modules/info/info.css';
import './modules/assets/assets.css';
import { store } from './state/store.js';
import { renderAppShell } from './components/AppShell.js';
import { initAuthModule } from './modules/auth/index.js';
import { initMembersModule } from './modules/members/index.js';
import { initHomeModule } from './modules/home/index.js';
import { initNoticeModule } from './modules/notice/index.js';
import { initInfoModule } from './modules/info/index.js';
import { initAssetsModule } from './modules/assets/index.js';
import { initFundModule } from './modules/fund/index.js';
import { runSupabaseHealthCheck } from './modules/system/systemService.js';

const app = document.querySelector('#app');

if (!app) {
  throw new Error('#app element not found.');
}

renderAppShell(app);

async function bootstrap() {
  store.setState({
    app: {
      ...store.getState().app,
      ready: true,
    },
  });

  await initAuthModule();
  await initNoticeModule();
  await initInfoModule();
  initHomeModule();
  await initMembersModule();
  await initAssetsModule();
  await initFundModule();

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
    console.error('[NEW AXE NET] Supabase health check failed:', error);

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
  console.error('[NEW AXE NET] bootstrap failed:', error);
});
