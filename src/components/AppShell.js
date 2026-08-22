import { store } from '../state/store.js';

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand__mark">
            <img src="/assets/axe-brand-mark.webp" alt="AXE" />
          </div>
          <div class="brand__copy">
            <div class="brand__eyebrow">AXE NETWORK</div>
            <div class="brand__title">NEW AXE NET</div>
            <div class="brand__subtitle">Operations Console</div>
          </div>
        </div>

        <nav class="nav">
          <button class="nav__item" type="button" data-nav-module="members">
            멤버
          </button>
          <button class="nav__item" type="button" data-nav-module="fund">
            공금
          </button>
        </nav>
      </aside>

      <main class="main">
        <header class="topbar">
          <div class="topbar__identity">
            <span class="topbar__eyebrow">AXE INTERNAL SYSTEM</span>
            <h1>NEW AXE NET</h1>
            <p>Supabase-first modular operations platform</p>
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

  root.querySelectorAll('[data-nav-module]').forEach((button) => {
    button.addEventListener('click', () => {
      const moduleName = button.dataset.navModule;

      store.updateState((state) => ({
        ...state,
        ui: {
          ...state.ui,
          activeModule: moduleName,
        },
      }));
    });
  });

  renderConnectionStatus(store.getState().system);
  renderNavigation(store.getState().ui.activeModule);

  store.subscribe((state) => {
    renderConnectionStatus(state.system);
    renderNavigation(state.ui.activeModule);
  });
}

function renderNavigation(activeModule) {
  document.querySelectorAll('[data-nav-module]').forEach((button) => {
    const active = button.dataset.navModule === activeModule;
    button.classList.toggle('nav__item--active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
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
