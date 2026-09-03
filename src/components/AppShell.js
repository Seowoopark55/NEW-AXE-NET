import { store } from '../state/store.js';

const NAV_GROUPS = {
  home: {
    label: '홈',
    landing: 'home',
    modules: [{ module: 'home', label: '홈' }],
  },
  news: {
    label: '소식',
    landing: 'notice',
    modules: [{ module: 'notice', label: '공지사항' }],
  },
  info: {
    label: '정보',
    landing: 'info',
    modules: [{ module: 'info', label: '정보' }],
  },
  content: {
    label: '콘텐츠',
    landing: 'outlaw',
    modules: [
      { module: 'outlaw', label: '무법지대' },
    ],
  },
  operations: {
    label: '운영',
    landing: 'fund',
    modules: [
      { module: 'fund', label: '공금' },
      { module: 'assets', label: '자산·계좌' },
      { module: 'members', label: '멤버' },
      { module: 'ai', label: 'AXE AI', adminOnly: true },
    ],
  },
};

const MODULE_GROUP = Object.entries(NAV_GROUPS).reduce((map, [groupKey, group]) => {
  for (const item of group.modules) map[item.module] = groupKey;
  return map;
}, {});

export function renderAppShell(root) {
  root.innerHTML = `
    <div class="ops-shell">
      <header class="ops-topbar">
        <div class="ops-topbar__inner">
          <button class="ops-brand ops-home-trigger" type="button" data-nav-home aria-label="AXE NET 홈으로 이동">
            <span class="ops-brand__mark">
              <img src="/assets/axe-brand-mark.webp" alt="AXE" />
            </span>
            <span class="ops-brand__copy">
              <strong>AXE NET</strong>
              <span>OPERATIONS</span>
            </span>
          </button>

          <div class="ops-topbar__utility">
            <div id="quick-access-root"></div>
            <div id="connection-status" class="connection-status"></div>
            <div id="auth-root"></div>
          </div>
        </div>
      </header>

      <section class="ops-sitehead" aria-label="AXE NET 브랜드 배너와 주요 메뉴">
        <div class="ops-sitehead__inner">
          <button class="ops-hero ops-home-trigger" type="button" data-nav-home aria-label="AXE NET 홈으로 이동" title="홈으로 이동">
            <span class="ops-hero__copy" aria-hidden="true">
              <span>AXE OPERATIONS NETWORK</span>
              <strong>AXE NET</strong>
            </span>
            <span class="ops-hero__meta" aria-hidden="true">EST. 2026 · LAC OPERATIONS</span>
          </button>

          <div class="ops-module-rail">
            <nav class="ops-module-nav" aria-label="1차 메뉴">
              ${Object.entries(NAV_GROUPS).map(([key, group]) => `
                <button class="ops-module-nav__item" type="button" data-nav-group="${key}">${group.label}</button>
              `).join('')}
            </nav>
          </div>

          <div id="ops-subnav" class="ops-subnav" hidden></div>
        </div>
      </section>

      <main class="ops-main">
        <div class="ops-main__inner">
          <section id="module-root" class="module-root"></section>
        </div>
      </main>
    </div>
  `;

  root.querySelectorAll('[data-nav-group]').forEach((button) => {
    button.addEventListener('click', () => {
      const group = NAV_GROUPS[button.dataset.navGroup];
      if (!group) return;

      const activeModule = store.getState().ui.activeModule;
      const groupModules = new Set(group.modules.map((item) => item.module));
      navigateTo(groupModules.has(activeModule) ? activeModule : group.landing);
    });
  });

  root.querySelectorAll('[data-nav-home]').forEach((element) => {
    element.addEventListener('click', () => navigateTo('home'));
  });

  renderConnectionStatus(store.getState().system);
  renderNavigation(store.getState().ui.activeModule, store.getState().auth);

  store.subscribe((state) => {
    renderConnectionStatus(state.system);
    renderNavigation(state.ui.activeModule, state.auth);
  });
}

function navigateTo(moduleName) {
  store.updateState((state) => ({
    ...state,
    ui: { ...state.ui, activeModule: moduleName },
  }));
}

function renderNavigation(activeModule, auth = {}) {
  const activeGroupKey = MODULE_GROUP[activeModule] || 'home';

  document.querySelectorAll('[data-nav-group]').forEach((button) => {
    const active = button.dataset.navGroup === activeGroupKey;
    button.classList.toggle('ops-module-nav__item--active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });

  const subnav = document.querySelector('#ops-subnav');
  if (!subnav) return;

  const group = NAV_GROUPS[activeGroupKey];
  const visibleModules = (group?.modules || []).filter((item) => !item.adminOnly || Boolean(auth?.admin));
  const showSubnav = group && visibleModules.length > 1;
  subnav.hidden = !showSubnav;

  if (!showSubnav) {
    subnav.innerHTML = '';
    return;
  }

  subnav.innerHTML = `
    <div class="ops-subnav__inner">
      <nav class="ops-subnav__items" aria-label="${group.label} 2차 메뉴">
        ${visibleModules.map((item) => `
          <button
            class="ops-subnav__item ${item.module === activeModule ? 'is-active' : ''}"
            type="button"
            data-nav-submodule="${item.module}"
            ${item.module === activeModule ? 'aria-current="page"' : ''}
          >${item.label}</button>
        `).join('')}
      </nav>
    </div>
  `;

  subnav.querySelectorAll('[data-nav-submodule]').forEach((button) => {
    button.addEventListener('click', () => navigateTo(button.dataset.navSubmodule));
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
