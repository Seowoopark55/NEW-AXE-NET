import './fund.css';
import { store } from '../../state/store.js';
import {
  approveFundRequest,
  createFundBalanceCheck,
  createFundPayment,
  createFundTransaction,
  createFundExemption,
  createFundFeeRule,
  deleteFundLedgerEntry,
  disableFundExemption,
  fetchFundAdminLedger,
  fetchFundBalanceChecks,
  fetchFundExemptions,
  fetchFundFeeRules,
  fetchFundMonthOverview,
  fetchFundPeriodStatus,
  fetchFundPeriods,
  fetchFundRecentLedger,
  fetchFundRequests,
  fetchFundSummary,
  fetchMyFundProfile,
  rejectFundRequest,
  restoreFundLedgerEntry,
  setFundFeeRuleEnabled,
  submitFundRequest,
  updateFundLedgerEntry,
} from './fundService.js';
import { renderFundView } from './fundView.js';

const ADMIN_SECTIONS = new Set(['review', 'history', 'balance', 'settings']);

export async function initFundModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'fund') return;
    renderFundView(root, store.getState(), buildActions());
  };

  store.subscribe(rerender);
  await loadFundBase();
  rerender();
}

function buildActions() {
  return {
    async onSectionChange(section) {
      const state = store.getState();
      if (ADMIN_SECTIONS.has(section) && !state.auth.admin) return;

      store.updateState((current) => ({
        ...current,
        fund: {
          ...current.fund,
          section,
          admin: {
            ...current.fund.admin,
            error: null,
            message: null,
          },
        },
      }));

      if (ADMIN_SECTIONS.has(section)) {
        await ensureAdminWorkspace();
      }
    },

    async onMonthShift(delta) {
      const current = store.getState().fund.selectedMonth;
      if (!current) return;

      const date = new Date(current.year, current.month - 1 + delta, 1);
      const next = { year: date.getFullYear(), month: date.getMonth() + 1 };
      await loadMonth(next);
    },

    async onWeekSelect(period) {
      await loadPeriod(period);
    },

    async onVerifyIdentity(memberKey, discordUserId) {
      await verifyIdentity(memberKey, discordUserId);
    },

    onClearIdentity() {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          identity: {
            verified: false,
            loading: false,
            memberKey: '',
            discordUserId: '',
            profile: null,
            error: null,
          },
          payment: {
            ...state.fund.payment,
            selectedPeriod: null,
            error: null,
            success: null,
          },
        },
      }));
    },

    onPaymentPeriodSelect(period) {
      const profile = store.getState().fund.identity.profile;
      const selected = profile?.periods?.find((item) =>
        item.year === period.year && item.month === period.month && item.week === period.week,
      ) ?? null;

      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          payment: {
            ...state.fund.payment,
            selectedPeriod: selected,
            error: null,
            success: null,
          },
        },
      }));
    },

    async onSubmitPayment(values) {
      await submitPayment(values);
    },

    onRequestFilterChange(filter) {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            requestFilter: filter,
          },
        },
      }));
    },

    async onApproveRequest(id, note) {
      await runAdminMutation(async () => {
        await approveFundRequest(id, note);
        return '공금 제출을 승인하고 납부 완료로 반영했습니다.';
      });
    },

    async onRejectRequest(id, note) {
      await runAdminMutation(async () => {
        await rejectFundRequest(id, note);
        return '공금 제출을 거절했습니다.';
      });
    },

    onOpenEntryCreator(mode) {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            entryCreator: { open: true, mode },
            error: null,
            message: null,
          },
        },
      }));
    },

    onCloseEntryCreator() {
      closeEntryCreator();
    },

    async onCreateDirectPayment(values) {
      const period = store.getState().fund.selectedPeriod;
      if (!period) return;
      const success = await runAdminMutation(async () => {
        if (!values.member_key) throw new Error('멤버를 선택하세요.');
        if (!Number.isInteger(values.amount) || values.amount <= 0) throw new Error('납부 금액은 0원보다 큰 정수로 입력하세요.');
        await createFundPayment({ ...values, ...period });
        return '공금 납부를 직접 등록했습니다.';
      });
      if (success) closeEntryCreator();
    },

    async onCreateDirectTransaction(values) {
      const success = await runAdminMutation(async () => {
        if (!['수입', '지출', '조정'].includes(values.direction)) throw new Error('거래 유형을 선택하세요.');
        if (!Number.isInteger(values.amount) || values.amount === 0) throw new Error('금액은 0이 아닌 정수로 입력하세요.');
        if (['수입', '지출'].includes(values.direction) && values.amount < 0) throw new Error('수입/지출 금액은 양수로 입력하세요.');
        if (!values.category) throw new Error('분류를 입력하세요.');
        await createFundTransaction(values);
        return '수입·지출 내역을 등록했습니다.';
      });
      if (success) closeEntryCreator();
    },

    onHistoryFilterChange(key, value) {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            historyFilters: {
              ...state.fund.admin.historyFilters,
              [key]: value,
            },
          },
        },
      }));
    },

    onOpenLedgerEditor(id) {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            ledgerEditor: { open: true, itemId: id },
          },
        },
      }));
    },

    onCloseLedgerEditor() {
      closeLedgerEditor();
    },

    async onUpdateLedger(values) {
      const success = await runAdminMutation(async () => {
        validateLedgerUpdate(values);
        await updateFundLedgerEntry(values);
        return '공금내역을 수정했습니다.';
      });
      if (success) closeLedgerEditor();
    },

    async onDeleteLedger(id, reason) {
      const success = await runAdminMutation(async () => {
        await deleteFundLedgerEntry(id, reason);
        return '공금내역을 삭제 처리했습니다.';
      });
      if (success) closeLedgerEditor();
    },

    async onRestoreLedger(id) {
      await runAdminMutation(async () => {
        await restoreFundLedgerEntry(id);
        return '삭제된 공금내역을 복구했습니다.';
      });
    },

    async onCreateBalanceCheck(values) {
      await runAdminMutation(async () => {
        await createFundBalanceCheck(values);
        return '잔액점검을 기록했습니다.';
      });
    },

    async onCreateFeeRule(values) {
      await runAdminMutation(async () => {
        await createFundFeeRule(values);
        return '새 공금 금액 설정을 추가했습니다.';
      });
    },

    async onToggleFeeRule(id, enabled) {
      await runAdminMutation(async () => {
        await setFundFeeRuleEnabled(id, enabled);
        return enabled ? '공금 금액 설정을 활성화했습니다.' : '공금 금액 설정을 비활성화했습니다.';
      });
    },

    async onCreateExemption(values) {
      const period = store.getState().fund.selectedPeriod;
      if (!period) return;
      await runAdminMutation(async () => {
        await createFundExemption({ ...values, ...period });
        return '면제를 등록했습니다.';
      });
    },

    async onDisableExemption(id) {
      await runAdminMutation(async () => {
        await disableFundExemption(id);
        return '면제를 해제했습니다.';
      });
    },
  };
}

async function loadFundBase() {
  store.updateState((state) => ({
    ...state,
    fund: { ...state.fund, loading: true, error: null },
  }));

  try {
    const [periods, summary, recentLedger] = await Promise.all([
      fetchFundPeriods(),
      fetchFundSummary(),
      fetchFundRecentLedger(12),
    ]);

    const selectedPeriod = summary?.period ?? periods?.[0] ?? null;
    const selectedMonth = selectedPeriod
      ? { year: selectedPeriod.year, month: selectedPeriod.month }
      : currentMonth();

    const [monthOverview, statusItems] = await Promise.all([
      fetchFundMonthOverview(selectedMonth.year, selectedMonth.month),
      selectedPeriod ? fetchFundPeriodStatus(selectedPeriod) : Promise.resolve([]),
    ]);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        initialized: true,
        loading: false,
        error: null,
        periods: periods ?? [],
        selectedPeriod,
        selectedMonth,
        monthOverview,
        summary,
        statusItems: statusItems ?? [],
        recentLedger: recentLedger ?? [],
      },
    }));

    if (store.getState().auth.admin) {
      void ensureAdminWorkspace();
    }
  } catch (error) {
    console.error('[NEW AXE NET] fund base load failed:', error);
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
}

async function loadMonth(month) {
  setFundBusy(true);
  try {
    const overview = await fetchFundMonthOverview(month.year, month.month);
    const weeks = overview?.weeks ?? [];
    const today = new Date();
    let target = weeks.find((item) => {
      const end = new Date(`${item.period_end}T23:59:59`);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return today >= start && today <= end;
    });
    if (!target) target = weeks.filter((item) => new Date(item.period_end) <= today).at(-1) ?? weeks[0] ?? null;

    if (target) {
      const period = { year: target.year, month: target.month, week: target.week };
      const [summary, statusItems] = await Promise.all([
        fetchFundSummary(period),
        fetchFundPeriodStatus(period),
      ]);
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          loading: false,
          selectedMonth: month,
          selectedPeriod: period,
          monthOverview: overview,
          summary,
          statusItems: statusItems ?? [],
        },
      }));
    } else {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          loading: false,
          selectedMonth: month,
          monthOverview: overview,
          statusItems: [],
        },
      }));
    }
  } catch (error) {
    setFundError(error);
  }
}

async function loadPeriod(period) {
  setFundBusy(true);
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
        selectedPeriod: period,
        summary,
        statusItems: statusItems ?? [],
      },
    }));

    if (store.getState().auth.admin && store.getState().fund.section === 'settings') {
      await refreshExemptionsOnly();
    }
  } catch (error) {
    setFundError(error);
  }
}

async function verifyIdentity(memberKey, discordUserId) {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      identity: {
        ...state.fund.identity,
        loading: true,
        memberKey,
        discordUserId,
        error: null,
      },
    },
  }));

  try {
    if (!memberKey) throw new Error('닉네임을 선택하세요.');
    if (!/^\d+$/.test(discordUserId)) throw new Error('Discord 사용자 ID는 숫자만 입력하세요.');
    const profile = await fetchMyFundProfile(memberKey, discordUserId);
    const selectedPeriod = profile?.periods?.find((item) => item.status === '미납' && item.request_status !== 'pending') ?? null;

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        identity: {
          verified: true,
          loading: false,
          memberKey,
          discordUserId,
          profile,
          error: null,
        },
        payment: {
          ...state.fund.payment,
          selectedPeriod,
          error: null,
          success: null,
        },
      },
    }));
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        identity: {
          ...state.fund.identity,
          verified: false,
          loading: false,
          profile: null,
          error: formatError(error),
        },
      },
    }));
  }
}

async function submitPayment(values) {
  const identity = store.getState().fund.identity;
  if (!identity.verified) return;

  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      payment: {
        ...state.fund.payment,
        submitting: true,
        error: null,
        success: null,
        evidenceUrl: values.evidence_url,
        memo: values.memo,
      },
    },
  }));

  try {
    const requestId = await submitFundRequest({
      member_key: identity.memberKey,
      discord_user_id: identity.discordUserId,
      ...values,
    });
    const profile = await fetchMyFundProfile(identity.memberKey, identity.discordUserId);

    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        identity: { ...state.fund.identity, profile },
        payment: {
          ...state.fund.payment,
          selectedPeriod: null,
          submitting: false,
          error: null,
          success: `제출 #${requestId}이 접수되었습니다. 관리자 검수 후 완료 처리됩니다.`,
          evidenceUrl: '',
          memo: '',
        },
      },
    }));

    if (store.getState().auth.admin) await refreshAdminWorkspace();
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        payment: {
          ...state.fund.payment,
          submitting: false,
          error: formatError(error),
          success: null,
        },
      },
    }));
  }
}

async function ensureAdminWorkspace() {
  const state = store.getState();
  if (!state.auth.admin) return;
  if (state.fund.admin.initialized && !state.fund.admin.error) return;
  await refreshAdminWorkspace();
}

async function refreshAdminWorkspace(message = null) {
  const state = store.getState();
  if (!state.auth.admin) return;
  const period = state.fund.selectedPeriod;

  store.updateState((current) => ({
    ...current,
    fund: {
      ...current.fund,
      admin: {
        ...current.fund.admin,
        loading: true,
        error: null,
        message,
      },
    },
  }));

  try {
    const [requests, ledgerItems, feeRules, exemptions, balanceChecks] = await Promise.all([
      fetchFundRequests(500),
      fetchFundAdminLedger(1000),
      fetchFundFeeRules(),
      period ? fetchFundExemptions(period) : Promise.resolve([]),
      fetchFundBalanceChecks(30),
    ]);

    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        admin: {
          ...current.fund.admin,
          initialized: true,
          loading: false,
          error: null,
          message,
          requests: requests ?? [],
          ledgerItems: ledgerItems ?? [],
          feeRules: feeRules ?? [],
          exemptions: exemptions ?? [],
          balanceChecks: balanceChecks ?? [],
        },
      },
    }));
  } catch (error) {
    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        admin: {
          ...current.fund.admin,
          initialized: true,
          loading: false,
          error: formatError(error),
        },
      },
    }));
  }
}

async function refreshExemptionsOnly() {
  const state = store.getState();
  if (!state.auth.admin || !state.fund.selectedPeriod) return;
  const exemptions = await fetchFundExemptions(state.fund.selectedPeriod);
  store.updateState((current) => ({
    ...current,
    fund: {
      ...current.fund,
      admin: { ...current.fund.admin, exemptions: exemptions ?? [] },
    },
  }));
}

async function runAdminMutation(mutation) {
  if (!store.getState().auth.admin) return false;
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      admin: { ...state.fund.admin, saving: true, error: null, message: null },
    },
  }));

  try {
    const message = await mutation();
    await refreshAllAfterMutation(message);
    return true;
  } catch (error) {
    store.updateState((state) => ({
      ...state,
      fund: {
        ...state.fund,
        admin: {
          ...state.fund.admin,
          saving: false,
          error: formatError(error),
          message: null,
        },
      },
    }));
    return false;
  }
}

async function refreshAllAfterMutation(message) {
  const state = store.getState();
  const period = state.fund.selectedPeriod;
  const month = state.fund.selectedMonth;

  const [summary, statusItems, recentLedger, monthOverview] = await Promise.all([
    fetchFundSummary(period),
    fetchFundPeriodStatus(period),
    fetchFundRecentLedger(12),
    fetchFundMonthOverview(month.year, month.month),
  ]);

  store.updateState((current) => ({
    ...current,
    fund: {
      ...current.fund,
      summary,
      statusItems,
      recentLedger,
      monthOverview,
      admin: { ...current.fund.admin, saving: false },
    },
  }));

  await refreshAdminWorkspace(message);

  const identity = store.getState().fund.identity;
  if (identity.verified) {
    try {
      const profile = await fetchMyFundProfile(identity.memberKey, identity.discordUserId);
      store.updateState((current) => ({
        ...current,
        fund: {
          ...current.fund,
          identity: { ...current.fund.identity, profile },
        },
      }));
    } catch {
      // 관리자 조작 후 본인 조회 갱신 실패는 관리자 작업 자체를 실패시키지 않습니다.
    }
  }
}

function closeLedgerEditor() {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      admin: {
        ...state.fund.admin,
        ledgerEditor: { open: false, itemId: null },
      },
    },
  }));
}

function closeEntryCreator() {
  store.updateState((state) => ({
    ...state,
    fund: {
      ...state.fund,
      admin: {
        ...state.fund.admin,
        entryCreator: { open: false, mode: 'payment' },
      },
    },
  }));
}

function validateLedgerUpdate(values) {
  if (!Number.isInteger(values.amount) || values.amount === 0) throw new Error('금액은 0이 아닌 정수로 입력하세요.');
  if (values.entry_type === 'payment') {
    if (values.amount <= 0) throw new Error('납부 금액은 0원보다 커야 합니다.');
    return;
  }
  if (!['수입', '지출', '조정'].includes(values.direction)) throw new Error('거래 유형을 선택하세요.');
  if (!values.category) throw new Error('분류를 입력하세요.');
  if (['수입', '지출'].includes(values.direction) && values.amount < 0) throw new Error('수입/지출 금액은 양수로 입력하세요.');
}

function setFundBusy(loading) {
  store.updateState((state) => ({
    ...state,
    fund: { ...state.fund, loading, error: null },
  }));
}

function setFundError(error) {
  store.updateState((state) => ({
    ...state,
    fund: { ...state.fund, loading: false, error: formatError(error) },
  }));
}

function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatError(error) {
  const message = error?.message ?? String(error);
  if (message.includes('Discord 사용자 ID')) return message;
  if (message.includes('검토 대기')) return '이미 해당 주차에 검수대기 중인 제출이 있습니다.';
  if (message.includes('납부가 완료') || message.includes('활성 납부 기록')) return '이미 해당 주차의 납부가 완료되어 있습니다.';
  if (message.includes('duplicate key value')) return '이미 같은 조건의 데이터가 존재합니다.';
  if (message.includes('관리자 권한')) return '관리자 권한이 필요합니다.';
  return message;
}
