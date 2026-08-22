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
    editingMemberKey: null,
    saving: false,
    saveError: null,
    saveSuccess: null,

    create: {
      open: false,
      creating: false,
      error: null,
    },

    audit: {
      memberKey: null,
      items: [],
      loading: false,
      error: null,
    },
  },

  fund: {
    initialized: false,
    loading: false,
    error: null,

    section: 'overview',
    periods: [],
    selectedPeriod: null,
    selectedMonth: null,
    monthOverview: null,
    monthMatrix: null,
    summary: null,
    statusItems: [],
    recentLedger: [],

    identity: {
      verified: false,
      loading: false,
      memberKey: '',
      discordUserId: '',
      profile: null,
      error: null,
    },

    payment: {
      selectedPeriod: null,
      submitting: false,
      error: null,
      success: null,
      evidenceUrl: '',
      memo: '',
    },

    admin: {
      initialized: false,
      loading: false,
      saving: false,
      error: null,
      message: null,

      requests: [],
      requestFilter: 'pending',

      ledgerItems: [],
      historyFilters: {
        search: '',
        type: 'all',
        account: 'all',
        status: 'active',
        month: 'all',
      },

      ledgerEditor: {
        open: false,
        itemId: null,
      },

      entryCreator: {
        open: false,
        mode: 'payment',
      },

      exemptions: [],
      feeRules: [],
      balanceChecks: [],
    },
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
