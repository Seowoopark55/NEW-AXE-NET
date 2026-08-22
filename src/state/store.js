const initialState = {
  app: {
    ready: false,
  },

  user: null,

  members: {
    items: [],
    loading: false,
    error: null,
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

  for (const listener of listeners) {
    listener(state);
  }
}

function updateState(updater) {
  const nextState = updater(state);

  if (!nextState) {
    return;
  }

  state = nextState;

  for (const listener of listeners) {
    listener(state);
  }
}

function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export const store = {
  getState,
  setState,
  updateState,
  subscribe,
};
