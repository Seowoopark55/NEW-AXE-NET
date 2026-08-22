import './styles/main.css';
import { store } from './state/store.js';
import { renderAppShell } from './components/AppShell.js';
import { initMembersModule } from './modules/members/index.js';
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

  await initMembersModule();

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
