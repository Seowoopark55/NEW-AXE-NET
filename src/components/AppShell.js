import { store } from '../state/store.js';

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="ops-shell">
      <header class="ops-topbar">
        <div class="ops-topbar__inner">
          <div class="ops-brand" aria-label="NEW AXE NET">
            <div class="ops-brand__mark">
              <img src="/assets/axe-brand-mark.webp" alt="AXE" />
            </div>
            <div class="ops-brand__copy">
              <strong>NEW AXE NET</strong>
              <span>OPERATIONS</span>
            </div>
          </div>

          <div class="ops-topbar__utility">
            <div id="connection-status" class="connection-status"></div>
            <div id="auth-root"></div>
          </div>
        </div>
      </header>

      <section class="ops-sitehead" aria-label="NEW AXE NET 배너와 주요 메뉴">
        <div class="ops-sitehead__inner">
          <div class="ops-hero" aria-label="AXE Operations Network">
            <div class="ops-hero__veil"></div>
            <div class="ops-hero__caption">
              <span>AXE OPERATIONS NETWORK</span>
              <strong>NEW AXE NET</strong>
              <p>MEMBERS · FUND · OPERATIONS</p>
            </div>
          </div>

          <div class="ops-module-rail">
            <nav class="ops-module-nav" aria-label="주요 메뉴">
              <button class="ops-module-nav__item" type="button" data-nav-module="members">멤버</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="fund">공금</button>
            </nav>
          </div>
        </div>
      </section>

      <main class="ops-main">
        <div class="ops-main__inner">
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
    button.classList.toggle('ops-module-nav__item--active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

function renderConnectionStatus(system) {
  const root = document.querySelector('#connection-status');
  if (!root) return;

  if (system.checking) {
    root.innerHTML = '<span class="status-pill"><i></i> CHECKING</span>';
    return;
  }
  if (system.connected) {
    root.innerHTML = '<span class="status-pill status-pill--ok"><i></i> ONLINE</span>';
    return;
  }
  if (system.error) {
    root.innerHTML = '<span class="status-pill status-pill--error"><i></i> ERROR</span>';
    return;
  }
  root.innerHTML = '<span class="status-pill"><i></i> WAITING</span>';
}
