import './styles/main.css';
import { store } from './state/store.js';
import { renderAppShell } from './components/AppShell.js';
import { initMembersModule } from './modules/members/index.js';

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
}

bootstrap().catch((error) => {
  console.error('[NEW AXE NET] bootstrap failed:', error);
});
