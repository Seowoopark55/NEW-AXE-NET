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
    member: null,
    memberSessionExpiresAt: null,
    loginMode: 'member',
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

  notice: {
    initialized: false,
    loading: false,
    error: null,
    tab: 'general',
    notices: [],
    operations: [],
    selectedNoticeId: null,
    selectedOperationId: null,
    operationCategory: 'all',
    editor: {
      open: false,
      kind: 'notice',
      itemId: null,
      saving: false,
      error: null,
    },
  },

  info: {
    initialized: false,
    loading: false,
    error: null,
    tab: 'craft',
    crafts: [],
    materials: [],
    materialRecipes: [],
    quests: [],
    processes: [],
    modbooks: [],
    skillRanks: [],
    selectedCraftId: null,
    selectedModbookId: null,
    filters: {
      craftCategory: 'all',
      craftSearch: '',
      questJob: 'all',
      questSearch: '',
      processJob: 'all',
      processSearch: '',
      modbookType: 'all',
      modbookCategory: 'all',
      modbookPart: 'all',
      modbookSearch: '',
      skill: 'all',
      skillSearch: '',
    },
    modbookRequest: {
      open: false,
      loading: false,
      saving: false,
      error: null,
      message: null,
      myRequests: [],
    },
    admin: {
      requestsOpen: false,
      requests: [],
      loading: false,
      error: null,
      editorOpen: false,
      editorId: null,
      priceOpen: false,
      priceId: null,
      saving: false,
    },
  },

  assets: {
    initialized: false,
    loading: false,
    error: null,
    message: null,
    tab: 'accounts',
    accounts: [],
    ownRequests: [],
    companyAssets: [],
    returns: [],
    adminRequests: [],
    filters: {
      accountSearch: '',
      assetSearch: '',
      assetCategory: 'all',
      assetStatus: 'all',
      returnSearch: '',
      returnStatus: 'all',
    },
    modal: {
      type: null,
      itemId: null,
      saving: false,
      error: null,
    },
  },

  outlaw: {
    initialized: false,
    loading: false,
    error: null,
    tab: 'stats',
    stats: [],
    guideLocations: [],
    guideSteps: [],
    maps: [],
    selectedMemberKey: null,
    selectedLocationKey: null,
    selectedMapKey: null,
    history: [],
    historyLoading: false,
    historyError: null,
    filters: {
      statSearch: '',
      statStatus: 'active',
      guideSearch: '',
      mapSearch: '',
    },
    message: null,
    modal: {
      type: null,
      itemId: null,
      saving: false,
      error: null,
    },
  },

  tube: {
    initialized: false,
    loading: false,
    error: null,
    message: null,
    messageType: 'info',
    videos: [],
    selectedTubeId: null,
    myReactions: {},
    reactionSavingTubeId: null,
    editor: {
      open: false,
      tubeId: null,
      saving: false,
      error: null,
      confirmDelete: false,
      draft: null,
    },
    filters: {
      search: '',
      category: 'all',
      sort: 'recent',
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
      source: null,
      memberKey: '',
      profile: null,
      error: null,
    },

    payment: {
      selectedPeriod: null,
      submitting: false,
      error: null,
      success: null,
      paymentMode: '공용계좌',
      amount: '',
      publicAmount: '',
      companyAmount: '',
      proxyMemberKey: '',
      proxyProfile: null,
      proxyLoading: false,
      evidence: null,
      evidencePreview: '',
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
        person: 'all',
        type: 'all',
        account: 'all',
        status: 'active',
      },

      ledgerEditor: {
        open: false,
        itemId: null,
      },

      entryCreator: {
        open: false,
        mode: 'payment',
        evidence: null,
        evidencePreview: '',
      },

      exemptions: [],
      feeRules: [],
      balanceChecks: [],
      balanceEvidence: null,
      balanceEvidencePreview: '',
      fundMemberSettings: [],
      integrityReport: null,
    },
  },

  ui: {
    activeModule: 'home',
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
