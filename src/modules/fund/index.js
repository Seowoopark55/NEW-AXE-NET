import { store } from '../../state/store.js';
import {
  createFundExemption,
  createFundFeeRule,
  disableFundExemption,
  fetchFundExemptions,
  fetchFundFeeRules,
  fetchFundPeriods,
  fetchFundPeriodStatus,
  fetchFundRecentLedger,
  fetchFundSummary,
  setFundFeeRuleEnabled,
} from './fundService.js';
import { renderFundView } from './fundView.js';

export async function initFundModule() {
  const root = document.querySelector('#module-root');

  if (!root) {
    throw new Error('#module-root element not found.');
  }

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'fund') {
      return;
    }

    renderFundView(root, store.getState(), {
      async onPeriodChange(period) {
        await loadFundPeriod(period);

        if (store.getState().fund.admin.open && store.getState().auth.admin) {
          await loadFundAdminData(period);
        }
      },

      async onOpenAdmin() {
        if (!store.getState().auth.admin) return;

        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              open: true,
              error: null,
              message: null,
            },
          },
        }));

        await loadFundAdminData(store.getState().fund.selectedPeriod);
      },

      onCloseAdmin() {
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              open: false,
              error: null,
              message: null,
            },
          },
        }));
      },

      onAdminTabChange(tab) {
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              tab,
              error: null,
              message: null,
            },
          },
        }));
      },

      async onCreateExemption(values) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          await createFundExemption(values);
          return '면제가 등록되었습니다.';
        });
      },

      async onDisableExemption(exemptionId) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          await disableFundExemption(exemptionId);
          return '면제가 해제되었습니다.';
        });
      },

      async onCreateFeeRule(values) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          await createFundFeeRule(values);
          return '새 회비 규칙이 추가되었습니다.';
        });
      },

      async onToggleFeeRule(ruleId, enabled) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          await setFundFeeRuleEnabled(ruleId, enabled);
          return enabled
            ? '회비 규칙이 활성화되었습니다.'
            : '회비 규칙이 비활성화되었습니다.';
        });
      },
    });
  };

  store.subscribe(rerender);

  try {
    const [periods, summary, recentLedger] = await Promise.all([
      fetchFundPeriods(),
      fetchFundSummary(),
      fetchFundRecentLedger(12),
    ]);

    const selectedPeriod = summary?.period ?? periods?.[0] ?? null;
    const statusItems = selectedPeriod
      ? await fetchFundPeriodStatus(selectedPeriod)
      : [];

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        initialized: true,
        loading: false,
        error: null,
        periods: periods ?? [],
        selectedPeriod,
        summary,
        statusItems,
        recentLedger: recentLedger ?? [],
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] fund load failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        initialized: true,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }

  rerender();
}

async function runAdminMutation(mutation) {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      admin: {
        ...state.fund.admin,
        saving: true,
        error: null,
        message: null,
      },
    },
  }));

  try {
    const message = await mutation();
    await refreshFundAfterAdminChange(message);
  } catch (error) {
    console.error('[NEW AXE NET] fund admin mutation failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        admin: {
          ...state.fund.admin,
          saving: false,
          error: formatFundAdminError(error),
          message: null,
        },
      },
    }));
  }
}

async function refreshFundAfterAdminChange(message) {
  const period = store.getState().fund.selectedPeriod;

  const [
    periods,
    summary,
    statusItems,
    recentLedger,
    feeRules,
    exemptions,
  ] = await Promise.all([
    fetchFundPeriods(),
    fetchFundSummary(period),
    fetchFundPeriodStatus(period),
    fetchFundRecentLedger(12),
    fetchFundFeeRules(),
    fetchFundExemptions(period),
  ]);

  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      periods: periods ?? [],
      summary,
      statusItems: statusItems ?? [],
      recentLedger: recentLedger ?? [],
      admin: {
        ...state.fund.admin,
        saving: false,
        loading: false,
        error: null,
        message,
        feeRules: feeRules ?? [],
        exemptions: exemptions ?? [],
      },
    },
  }));
}

async function loadFundAdminData(period) {
  if (!period || !store.getState().auth.admin) return;

  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      admin: {
        ...state.fund.admin,
        loading: true,
        error: null,
      },
    },
  }));

  try {
    const [feeRules, exemptions] = await Promise.all([
      fetchFundFeeRules(),
      fetchFundExemptions(period),
    ]);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        admin: {
          ...state.fund.admin,
          loading: false,
          error: null,
          feeRules: feeRules ?? [],
          exemptions: exemptions ?? [],
        },
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] fund admin load failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        admin: {
          ...state.fund.admin,
          loading: false,
          error: formatFundAdminError(error),
        },
      },
    }));
  }
}

async function loadFundPeriod(period) {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      loading: true,
      error: null,
      selectedPeriod: period,
    },
  }));

  try {
    const [summary, statusItems] = await Promise.all([
      fetchFundSummary(period),
      fetchFundPeriodStatus(period),
    ]);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        loading: false,
        error: null,
        selectedPeriod: period,
        summary,
        statusItems: statusItems ?? [],
      },
    }));
  } catch (error) {
    console.error('[NEW AXE NET] fund period load failed:', error);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        loading: false,
        error: error?.message ?? String(error),
      },
    }));
  }
}

function formatFundAdminError(error) {
  const message = error?.message ?? String(error);

  if (message.includes('duplicate key value')) {
    return '이미 같은 조건의 활성 설정이 존재합니다.';
  }

  if (message.includes('관리자 권한')) {
    return '관리자 권한이 필요합니다.';
  }

  return message;
}
