const initialState = {
  app: {
    ready: false,
  },

  system: {
    checking: false,
    connected: false,
    message: null,
    error: null,
  },

  auth: {
    initialized: false,
    loading: false,
    user: null,
    admin: null,
    error: null,
    loginOpen: false,
  },

  members: {
    items: [],
    loading: false,
    error: null,
    filter: 'all',
    search: '',
    selectedMemberKey: null,
  },

  ui: {
    activeModule: 'members',
  },
};

let state = structuredClone(initialState);
const listeners = new Set();

function getState() {
  return state;
}

function setState(patch) {
  state = {
    ...state,
    ...patch,
  };
  notify();
}

function updateState(updater) {
  const nextState = updater(state);
  if (!nextState) return;

  state = nextState;
  notify();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) {
    listener(state);
  }
}

export const store = {
  getState,
  setState,
  updateState,
  subscribe,
};
