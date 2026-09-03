const ROUTE_TABS = {
  notice: new Set(['general', 'patch', 'operations']),
  info: new Set(['craft', 'quest', 'process', 'modbook', 'preset', 'skill']),
  assets: new Set(['accounts', 'company', 'returns']),
  outlaw: new Set(['stats', 'guide', 'map']),
  fund: new Set(['overview', 'payment', 'submissions', 'review', 'history', 'balance', 'feeRules', 'exemptions', 'integrity', 'fundMembers']),
  ai: new Set(['dashboard', 'knowledge', 'unknown', 'logs']),
};

const MODULES = new Set(['home', 'notice', 'info', 'outlaw', 'fund', 'assets', 'members', 'ai']);
const DEFAULT_TABS = {
  notice: 'general',
  info: 'craft',
  assets: 'accounts',
  outlaw: 'stats',
  fund: 'overview',
  ai: 'dashboard',
};

let installed = false;
let applyingLocation = false;
let lastRoute = null;
let storeRef = null;

export function installHistoryRouter(store) {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  storeRef = store;

  const initial = parseRoute(window.location.hash);
  if (initial) {
    applyRouteToStore(store, initial);
  } else {
    const route = routeFromState(store.getState());
    replaceRoute(route);
  }

  lastRoute = routeFromState(store.getState());

  store.subscribe((state) => {
    if (applyingLocation) return;

    const next = routeFromState(state);
    if (routeKey(next) === routeKey(lastRoute)) return;

    const previous = lastRoute;
    lastRoute = next;

    // 저장 완료처럼 같은 화면에서 모달만 닫힌 경우에는 현재 모달 기록을
    // 일반 화면으로 교체해 뒤로가기로 저장 전 모달이 다시 열리지 않게 합니다.
    if (
      previous?.modal
      && !next.modal
      && baseRouteKey(previous) === baseRouteKey(next)
    ) {
      replaceRoute(next);
      return;
    }

    pushRoute(next);
  });

  const applyLocation = () => {
    const route = parseRoute(window.location.hash) || { module: 'home' };
    applyingLocation = true;
    applyRouteToStore(store, route);
    lastRoute = routeFromState(store.getState());
    queueMicrotask(() => { applyingLocation = false; });
  };

  window.addEventListener('popstate', applyLocation);
}

export function closeRouteModal(kind) {
  if (typeof window === 'undefined') return false;
  const current = window.history.state?.axeRoute;
  if (!current?.modal || current.modal !== kind) return false;
  window.history.back();
  return true;
}

export function currentRoute() {
  if (!storeRef) return null;
  return routeFromState(storeRef.getState());
}

export function routeFromState(state) {
  const module = MODULES.has(state?.ui?.activeModule) ? state.ui.activeModule : 'home';
  const route = { module };

  const tab = getModuleTab(state, module);
  if (tab) route.tab = tab;

  if (module === 'info' && tab === 'preset') {
    const postId = Number(state.info?.selectedModbookPresetId);
    if (Number.isInteger(postId) && postId > 0) route.postId = postId;
  }

  if (module === 'info') {
    const modal = infoModalFromState(state.info);
    if (modal) Object.assign(route, modal);
  }

  return route;
}

export function parseRoute(hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  if (!raw) return null;

  const [pathPart, queryPart = ''] = raw.split('?');
  const parts = pathPart.split('/').map((part) => decodeURIComponent(part)).filter(Boolean);
  const module = MODULES.has(parts[0]) ? parts[0] : 'home';
  const route = { module };

  if (ROUTE_TABS[module]) {
    const candidate = parts[1];
    route.tab = ROUTE_TABS[module].has(candidate) ? candidate : DEFAULT_TABS[module];
  }

  if (module === 'info' && route.tab === 'preset' && parts[2] === 'post') {
    const postId = Number(parts[3]);
    if (Number.isInteger(postId) && postId > 0) route.postId = postId;
  }

  const params = new URLSearchParams(queryPart);
  const modal = params.get('modal');
  if (module === 'info' && ['request', 'adminRequests', 'editor', 'price', 'presetEditor'].includes(modal)) {
    route.modal = modal;
    const id = Number(params.get('id'));
    if (Number.isInteger(id) && id > 0) route.modalId = id;
    const cloneId = Number(params.get('clone'));
    if (Number.isInteger(cloneId) && cloneId > 0) route.cloneId = cloneId;
  }

  return route;
}

function applyRouteToStore(store, route) {
  store.updateState((state) => {
    const module = MODULES.has(route.module) ? route.module : 'home';
    let next = {
      ...state,
      ui: { ...state.ui, activeModule: module },
    };

    if (module === 'notice' && route.tab) {
      next.notice = { ...state.notice, tab: safeTab('notice', route.tab) };
    }
    if (module === 'info' && route.tab) {
      next.info = {
        ...state.info,
        tab: safeTab('info', route.tab),
        selectedModbookPresetId: route.tab === 'preset' && route.postId ? Number(route.postId) : null,
      };
    }
    if (module === 'assets' && route.tab) {
      next.assets = { ...state.assets, tab: safeTab('assets', route.tab) };
    }
    if (module === 'outlaw' && route.tab) {
      next.outlaw = { ...state.outlaw, tab: safeTab('outlaw', route.tab) };
    }
    if (module === 'fund' && route.tab) {
      next.fund = { ...state.fund, section: safeTab('fund', route.tab) };
    }
    if (module === 'ai' && route.tab) {
      next.ai = { ...state.ai, tab: safeTab('ai', route.tab) };
    }

    if (module === 'info') {
      next.info = applyInfoModalRoute(next.info || state.info, route);
    }

    return next;
  });
}

function getModuleTab(state, module) {
  const value = module === 'fund' ? state?.fund?.section : state?.[module]?.tab;
  if (!ROUTE_TABS[module]) return null;
  return safeTab(module, value);
}

function safeTab(module, value) {
  return ROUTE_TABS[module]?.has(value) ? value : DEFAULT_TABS[module];
}

function infoModalFromState(info = {}) {
  if (info.presetEditor?.open) {
    const result = { modal: 'presetEditor' };
    const postId = Number(info.presetEditor.postId);
    const cloneId = Number(info.presetEditor.cloneFromId);
    if (Number.isInteger(postId) && postId > 0) result.modalId = postId;
    if (Number.isInteger(cloneId) && cloneId > 0) result.cloneId = cloneId;
    return result;
  }
  if (info.modbookRequest?.open) return { modal: 'request' };
  if (info.admin?.requestsOpen) return { modal: 'adminRequests' };
  if (info.admin?.editorOpen) {
    const id = Number(info.admin.editorId);
    return { modal: 'editor', ...(Number.isInteger(id) && id > 0 ? { modalId: id } : {}) };
  }
  if (info.admin?.priceOpen) {
    const id = Number(info.admin.priceId);
    return { modal: 'price', ...(Number.isInteger(id) && id > 0 ? { modalId: id } : {}) };
  }
  return null;
}

function applyInfoModalRoute(info, route) {
  const modal = route.modal || null;
  const modalId = Number(route.modalId);
  const cloneId = Number(route.cloneId);

  return {
    ...info,
    modbookRequest: {
      ...info.modbookRequest,
      open: modal === 'request',
      ...(modal === 'request' ? {} : { error: null, message: null }),
    },
    admin: {
      ...info.admin,
      requestsOpen: modal === 'adminRequests',
      editorOpen: modal === 'editor',
      editorId: modal === 'editor' && Number.isInteger(modalId) && modalId > 0 ? modalId : null,
      priceOpen: modal === 'price',
      priceId: modal === 'price' && Number.isInteger(modalId) && modalId > 0 ? modalId : null,
      ...(modal ? {} : { error: null }),
    },
    presetEditor: modal === 'presetEditor'
      ? {
          ...info.presetEditor,
          open: true,
          postId: Number.isInteger(modalId) && modalId > 0 ? modalId : null,
          cloneFromId: Number.isInteger(cloneId) && cloneId > 0 ? cloneId : null,
          error: null,
        }
      : {
          ...info.presetEditor,
          open: false,
          postId: null,
          cloneFromId: null,
          saving: false,
          error: null,
        },
  };
}

function routeToHash(route) {
  const parts = [route.module || 'home'];
  if (route.tab) parts.push(route.tab);
  if (route.module === 'info' && route.tab === 'preset' && route.postId) {
    parts.push('post', String(route.postId));
  }

  const params = new URLSearchParams();
  if (route.modal) params.set('modal', route.modal);
  if (route.modalId) params.set('id', String(route.modalId));
  if (route.cloneId) params.set('clone', String(route.cloneId));
  const query = params.toString();
  return `#/${parts.map((part) => encodeURIComponent(part)).join('/')}${query ? `?${query}` : ''}`;
}

function pushRoute(route) {
  window.history.pushState({ axeRoute: route }, '', routeToHash(route));
}

function replaceRoute(route) {
  window.history.replaceState({ axeRoute: route }, '', routeToHash(route));
}

function routeKey(route) {
  return JSON.stringify(route || {});
}

function baseRouteKey(route) {
  if (!route) return '';
  const { modal, modalId, cloneId, ...base } = route;
  return JSON.stringify(base);
}
