import { store } from '../../state/store.js';
import {
  cancelFundLedgerEntry,
  createFundExemption,
  createFundFeeRule,
  createFundPayment,
  createFundTransaction,
  disableFundExemption,
  fetchFundAdminLedger,
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

      async onCreatePayment(values) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          validatePayment(values);
          await createFundPayment(values);
          return '주간 공금 납부가 원장에 등록되었습니다.';
        });
      },

      async onCreateTransaction(values) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          validateTransaction(values);
          await createFundTransaction(values);
          return '공금 거래가 원장에 등록되었습니다.';
        });
      },

      async onCancelLedger(ledgerId, reason) {
        if (!store.getState().auth.admin) return;

        await runAdminMutation(async () => {
          await cancelFundLedgerEntry(ledgerId, reason);
          return '원장 기록이 취소 처리되었습니다.';
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
    ledgerItems,
  ] = await Promise.all([
    fetchFundPeriods(),
    fetchFundSummary(period),
    fetchFundPeriodStatus(period),
    fetchFundRecentLedger(12),
    fetchFundFeeRules(),
    fetchFundExemptions(period),
    fetchFundAdminLedger(50),
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
        ledgerItems: ledgerItems ?? [],
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
    const [feeRules, exemptions, ledgerItems] = await Promise.all([
      fetchFundFeeRules(),
      fetchFundExemptions(period),
      fetchFundAdminLedger(50),
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
          ledgerItems: ledgerItems ?? [],
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

function validatePayment(values) {
  const amount = Number(values.amount);

  if (!values.member_key) {
    throw new Error('납부 멤버를 선택하세요.');
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('납부 금액은 0원보다 큰 정수로 입력하세요.');
  }
}

function validateTransaction(values) {
  const amount = Number(values.amount);

  if (!['수입', '지출', '조정'].includes(values.direction)) {
    throw new Error('거래 유형을 선택하세요.');
  }

  if (!values.category.trim()) {
    throw new Error('분류를 입력하세요.');
  }

  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error('금액은 0이 아닌 정수로 입력하세요.');
  }

  if (['수입', '지출'].includes(values.direction) && amount < 0) {
    throw new Error('수입/지출 금액은 양수로 입력하세요.');
  }
}

function formatFundAdminError(error) {
  const message = error?.message ?? String(error);

  if (message.includes('fund_ledger_one_active_payment_idx')) {
    return '이미 해당 멤버의 주차 납부 기록이 있습니다.';
  }

  if (message.includes('활성 납부 기록')) {
    return '이미 해당 멤버의 주차 납부 기록이 있습니다.';
  }

  if (message.includes('duplicate key value')) {
    return '이미 같은 조건의 활성 데이터가 존재합니다.';
  }

  if (message.includes('관리자 권한')) {
    return '관리자 권한이 필요합니다.';
  }

  return message;
}
