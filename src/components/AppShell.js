import { store } from '../state/store.js';

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand__title">NEW AXE NET</div>
          <div class="brand__subtitle">Modular System</div>
        </div>

        <nav class="nav">
          <button class="nav__item nav__item--active" type="button">
            멤버
          </button>
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <h1>NEW AXE NET</h1>
            <p>Supabase-first modular architecture</p>
          </div>

          <div class="topbar__controls">
            <div id="connection-status" class="connection-status"></div>
            <div id="auth-root"></div>
          </div>
        </header>

        <section id="module-root" class="module-root"></section>
      </main>
    </div>
  `;

  renderConnectionStatus(store.getState().system);

  store.subscribe((state) => {
    renderConnectionStatus(state.system);
  });
}

function renderConnectionStatus(system) {
  const root = document.querySelector('#connection-status');

  if (!root) return;

  if (system.checking) {
    root.innerHTML = '<span class="status-pill">SUPABASE CHECKING</span>';
    return;
  }

  if (system.connected) {
    root.innerHTML = '<span class="status-pill status-pill--ok">SUPABASE CONNECTED</span>';
    return;
  }

  if (system.error) {
    root.innerHTML = '<span class="status-pill status-pill--error">SUPABASE ERROR</span>';
    return;
  }

  root.innerHTML = '<span class="status-pill">SUPABASE WAITING</span>';
}
