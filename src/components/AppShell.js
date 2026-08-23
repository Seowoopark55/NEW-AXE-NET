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
          <button class="nav__item" type="button" data-nav-module="members">멤버</button>
          <button class="nav__item" type="button" data-nav-module="fund">공금</button>
        </nav>
      </aside>

      <main class="main">
        <div class="main__wrap">
          <div class="utility-bar" aria-label="시스템 및 계정 상태">
            <div class="utility-bar__left">
              <div id="connection-status" class="connection-status"></div>
            </div>
            <div class="utility-bar__right">
              <div id="auth-root"></div>
            </div>
          </div>

          <header class="hero-banner">
            <div class="hero-banner__logo">
              <img src="/assets/axe-brand-mark.webp" alt="AXE" />
            </div>
            <div class="hero-banner__identity">
              <span class="hero-banner__eyebrow">AXE COMPANY NETWORK</span>
              <h1>NEW AXE NET</h1>
              <p>AXE 내부 운영 시스템</p>
            </div>
            <div class="hero-banner__watermark" aria-hidden="true">AXE</div>
            <div class="hero-banner__network" aria-hidden="true">NETWORK</div>
            <div class="hero-banner__shine" aria-hidden="true"></div>
          </header>

          <section id="module-root" class="module-root"></section>
        </div>
      </main>
    </div>
  `;

  root.querySelectorAll('[data-nav-module]').forEach((button) => {
    button.addEventListener('click', () => {
      const moduleName = button.dataset.navModule;
      store.updateState((state) => ({
        ...state,
        ui: { ...state.ui, activeModule: moduleName },
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
    root.innerHTML = '<span class="status-pill"><i></i> SYSTEM CHECKING</span>';
    return;
  }
  if (system.connected) {
    root.innerHTML = '<span class="status-pill status-pill--ok"><i></i> SYSTEM ONLINE</span>';
    return;
  }
  if (system.error) {
    root.innerHTML = '<span class="status-pill status-pill--error"><i></i> SYSTEM ERROR</span>';
    return;
  }
  root.innerHTML = '<span class="status-pill"><i></i> SYSTEM WAITING</span>';
}
