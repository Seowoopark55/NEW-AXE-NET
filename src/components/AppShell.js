import { store } from '../state/store.js';

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="ops-shell">
      <header class="ops-topbar">
        <div class="ops-topbar__inner">
          <button class="ops-brand ops-home-trigger" type="button" data-nav-home aria-label="NEW AXE NET 홈으로 이동">
            <span class="ops-brand__mark">
              <img src="/assets/axe-brand-mark.webp" alt="AXE" />
            </span>
            <span class="ops-brand__copy">
              <strong>NEW AXE NET</strong>
              <span>OPERATIONS</span>
            </span>
          </button>

          <div class="ops-topbar__utility">
            <div id="connection-status" class="connection-status"></div>
            <div id="auth-root"></div>
          </div>
        </div>
      </header>

      <section class="ops-sitehead" aria-label="NEW AXE NET 배너와 주요 메뉴">
        <div class="ops-sitehead__inner">
          <button class="ops-hero ops-home-trigger" type="button" data-nav-home aria-label="운영 홈으로 이동" title="홈으로 이동">
            <img class="ops-hero__mark" src="/assets/axe-brand-mark.webp" alt="" aria-hidden="true" />
          </button>

          <div class="ops-module-rail">
            <nav class="ops-module-nav" aria-label="주요 메뉴">
              <button class="ops-module-nav__item" type="button" data-nav-module="home">홈</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="notice">공지</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="info">정보</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="members">멤버</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="assets">자산·계좌</button>
              <button class="ops-module-nav__item" type="button" data-nav-module="outlaw">무법지대</button>
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
      navigateTo(moduleName);
    });
  });

  root.querySelectorAll('[data-nav-home]').forEach((element) => {
    element.addEventListener('click', () => navigateTo('home'));
  });

  renderConnectionStatus(store.getState().system);
  renderNavigation(store.getState().ui.activeModule);

  store.subscribe((state) => {
    renderConnectionStatus(state.system);
    renderNavigation(state.ui.activeModule);
  });
}

function navigateTo(moduleName) {
  store.updateState((state) => ({
    ...state,
    ui: { ...state.ui, activeModule: moduleName },
  }));
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
