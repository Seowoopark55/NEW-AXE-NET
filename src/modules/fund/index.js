import './fund.css';
import './views/admin.css';
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
  fetchFundIntegrityReport,
  fetchFundMemberSettings,
  fetchFundMonthOverview,
  fetchFundMonthMatrix,
  fetchFundPeriodStatus,
  fetchFundPeriods,
  fetchFundRecentLedger,
  fetchFundRequests,
  fetchFundSummary,
  fetchAdminFundProfile,
  fetchSessionFundProfile,
  rejectFundRequest,
  restoreFundLedgerEntry,
  setFundFeeRuleEnabled,
  setFundMemberSetting,
  submitAdminFundRequest,
  submitSessionFundRequest,
  updateFundLedgerEntry,
} from './fundService.js';
import { renderFundView } from './fundView.js';
import { prepareEvidenceFile } from './evidence.js';

const ADMIN_SECTIONS = new Set(['review', 'history', 'balance', 'feeRules', 'exemptions', 'integrity', 'fundMembers']);

let lastFundAuthSignature = '';
let fundIdentitySyncing = false;

export async function initFundModule() {
  const root = document.querySelector('#module-root');
  if (!root) throw new Error('#module-root element not found.');

  const rerender = () => {
    if (store.getState().ui.activeModule !== 'fund') return;
    renderFundView(root, store.getState(), buildActions());
  };

  store.subscribe((state) => {
    rerender();
    const signature = getFundAuthSignature(state.auth);
    if (signature !== lastFundAuthSignature) {
      lastFundAuthSignature = signature;
      void syncFundIdentityFromAuth();
    }
  });

  await loadFundBase();
  lastFundAuthSignature = getFundAuthSignature(store.getState().auth);
  await syncFundIdentityFromAuth();
  rerender();
}

function buildActions() {
  return {
    async onRefresh() {
      await refreshCurrentWorkspace();
    },

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

    async onMonthSelect(month) {
      if (!month?.year || !month?.month) return;
      await loadMonth({
        year: Number(month.year),
        month: Number(month.month),
      });
    },

    async onWeekSelect(period) {
      await loadPeriod(period);
    },

    onOpenLogin() {
      store.updateState((state) => ({
        ...state,
        auth: {
          ...state.auth,
          loginOpen: true,
          loginMode: state.auth.admin ? 'admin' : 'member',
          error: null,
        },
      }));
    },

    onPaymentPeriodSelect(period) {
      const state = store.getState();
      const profile = state.auth.admin && state.fund.payment.proxyProfile
        ? state.fund.payment.proxyProfile
        : state.fund.identity.profile;
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
            amount: selected?.weekly_fee ? String(selected.weekly_fee) : '',
            error: null,
            success: null,
          },
        },
      }));
    },

    async onProxyMemberSelect(memberKey) {
      if (!store.getState().auth.admin || !memberKey) return;
      store.updateState((state) => ({
        ...state,
        fund: { ...state.fund, payment: { ...state.fund.payment, proxyMemberKey: memberKey, proxyLoading: true, proxyProfile: null, selectedPeriod: null, error: null, success: null } },
      }));
      try {
        const profile = await fetchAdminFundProfile(memberKey);
        const selectedPeriod = profile?.periods?.find((item) => item.status === '미납' && item.request_status !== 'pending') ?? null;
        store.updateState((state) => ({
          ...state,
          fund: { ...state.fund, payment: { ...state.fund.payment, proxyLoading: false, proxyProfile: profile, selectedPeriod, amount: selectedPeriod?.weekly_fee ? String(selectedPeriod.weekly_fee) : '', publicAmount: '', companyAmount: '' } },
        }));
      } catch (error) {
        store.updateState((state) => ({ ...state, fund: { ...state.fund, payment: { ...state.fund.payment, proxyLoading: false, error: formatError(error) } } }));
      }
    },

    onPaymentModeChange(mode) {
      store.updateState((state) => ({
        ...state,
        fund: { ...state.fund, payment: { ...state.fund.payment, paymentMode: mode, publicAmount: '', companyAmount: '', error: null } },
      }));
    },

    onPaymentDraftChange(key, value) {
      const allowed = new Set(['amount', 'publicAmount', 'companyAmount', 'memo']);
      if (!allowed.has(key)) return;
      store.updateState((state) => ({
        ...state,
        fund: { ...state.fund, payment: { ...state.fund.payment, [key]: value } },
      }));
    },

    async onEvidenceFile(file) {
      if (!file) return;
      try {
        const evidence = await prepareEvidenceFile(file);
        store.updateState((state) => ({ ...state, fund: { ...state.fund, payment: { ...state.fund.payment, evidence, evidencePreview: evidence.dataUrl, error: null } } }));
      } catch (error) {
        store.updateState((state) => ({ ...state, fund: { ...state.fund, payment: { ...state.fund.payment, evidence: null, evidencePreview: '', error: formatError(error) } } }));
      }
    },

    onEvidenceClear() {
      store.updateState((state) => ({ ...state, fund: { ...state.fund, payment: { ...state.fund.payment, evidence: null, evidencePreview: '', error: null } } }));
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
            entryCreator: { open: true, mode, evidence: null, evidencePreview: '' },
            error: null,
            message: null,
          },
        },
      }));
    },

    onCloseEntryCreator() {
      closeEntryCreator();
    },

    async onEntryEvidenceFile(file) {
      if (!file) return;
      try {
        const evidence = await prepareEvidenceFile(file);
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              entryCreator: {
                ...state.fund.admin.entryCreator,
                evidence,
                evidencePreview: evidence.dataUrl,
              },
              error: null,
            },
          },
        }));
      } catch (error) {
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              entryCreator: {
                ...state.fund.admin.entryCreator,
                evidence: null,
                evidencePreview: '',
              },
              error: formatError(error),
            },
          },
        }));
      }
    },

    onEntryEvidenceClear() {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            entryCreator: {
              ...state.fund.admin.entryCreator,
              evidence: null,
              evidencePreview: '',
            },
          },
        },
      }));
    },

    async onCreateDirectPayment(values) {
      const period = store.getState().fund.selectedPeriod;
      if (!period) return;
      const success = await runAdminMutation(async () => {
        if (!values.member_key) throw new Error('멤버를 선택하세요.');
        if (!Number.isInteger(values.amount) || values.amount <= 0) throw new Error('납부 금액은 0원보다 큰 정수로 입력하세요.');
        const evidence = store.getState().fund.admin.entryCreator.evidence;
        await createFundPayment({ ...values, ...period, evidence });
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
        const evidence = store.getState().fund.admin.entryCreator.evidence;
        await createFundTransaction({ ...values, evidence });
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

    async onBalanceEvidenceFile(file) {
      if (!file) return;
      try {
        const evidence = await prepareEvidenceFile(file);
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              balanceEvidence: evidence,
              balanceEvidencePreview: evidence.dataUrl,
              error: null,
            },
          },
        }));
      } catch (error) {
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              balanceEvidence: null,
              balanceEvidencePreview: '',
              error: formatError(error),
            },
          },
        }));
      }
    },

    onBalanceEvidenceClear() {
      store.updateState((state) => ({
        ...state,
        fund: {
          ...state.fund,
          admin: {
            ...state.fund.admin,
            balanceEvidence: null,
            balanceEvidencePreview: '',
          },
        },
      }));
    },

    async onCreateBalanceCheck(values) {
      const evidence = store.getState().fund.admin.balanceEvidence;
      const success = await runAdminMutation(async () => {
        await createFundBalanceCheck({ ...values, evidence });
        return '잔액점검을 기록했습니다.';
      });
      if (success) {
        store.updateState((state) => ({
          ...state,
          fund: {
            ...state.fund,
            admin: {
              ...state.fund.admin,
              balanceEvidence: null,
              balanceEvidencePreview: '',
            },
          },
        }));
      }
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

    async onSaveFundMemberSetting(values) {
      await runAdminMutation(async () => {
        await setFundMemberSetting(values);
        return `${values.nickname || '멤버'} 공금 대상 설정을 저장했습니다.`;
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

    const [monthOverview, monthMatrix, statusItems] = await Promise.all([
      fetchFundMonthOverview(selectedMonth.year, selectedMonth.month),
      fetchFundMonthMatrix(selectedMonth.year, selectedMonth.month),
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
        monthMatrix,
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
    const [overview, monthMatrix] = await Promise.all([
      fetchFundMonthOverview(month.year, month.month),
      fetchFundMonthMatrix(month.year, month.month),
    ]);
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
          monthMatrix,
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
          monthMatrix,
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

    if (store.getState().auth.admin && store.getState().fund.section === 'exemptions') {
      await refreshExemptionsOnly();
    }
  } catch (error) {
    setFundError(error);
  }
}

function getFundAuthSignature(auth) {
  if (auth?.admin?.member_key) return `admin:${auth.admin.member_key}`;
  if (auth?.member?.member_key) return `member:${auth.member.member_key}`;
  return 'guest';
}

async function fetchProfileForIdentity(identity) {
  if (!identity?.memberKey) throw new Error('로그인 멤버 정보가 없습니다.');
  if (identity.source === 'admin') return fetchAdminFundProfile(identity.memberKey);
  if (identity.source === 'member') return fetchSessionFundProfile();
  throw new Error('로그인이 필요합니다.');
}

async function syncFundIdentityFromAuth() {
  if (fundIdentitySyncing) return;
  fundIdentitySyncing = true;

  try {
    const state = store.getState();
    const auth = state.auth;
    const source = auth.admin?.member_key ? 'admin' : auth.member?.member_key ? 'member' : null;
    const memberKey = auth.admin?.member_key || auth.member?.member_key || '';

    if (!source || !memberKey) {
      store.updateState((current) => ({
        ...current,
        fund: {
          ...current.fund,
          identity: {
            verified: false,
            loading: false,
            source: null,
            memberKey: '',
            profile: null,
            error: null,
          },
          payment: {
            ...current.fund.payment,
            selectedPeriod: null,
            proxyMemberKey: '',
            proxyProfile: null,
            proxyLoading: false,
            evidence: null,
            evidencePreview: '',
            error: null,
            success: null,
          },
        },
      }));
      return;
    }

    const existing = state.fund.identity;
    if (existing.verified && existing.memberKey === memberKey && existing.source === source && existing.profile) {
      return;
    }

    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        identity: {
          ...current.fund.identity,
          verified: false,
          loading: true,
          source,
          memberKey,
          profile: null,
          error: null,
        },
      },
    }));

    const profile = await fetchProfileForIdentity({ source, memberKey });
    const selectedPeriod = profile?.periods?.find(
      (item) => item.status === '미납' && item.request_status !== 'pending',
    ) ?? null;

    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        identity: {
          verified: true,
          loading: false,
          source,
          memberKey,
          profile,
          error: null,
        },
        payment: {
          ...current.fund.payment,
          selectedPeriod,
          amount: selectedPeriod?.weekly_fee ? String(selectedPeriod.weekly_fee) : '',
          error: null,
          success: null,
        },
      },
    }));
  } catch (error) {
    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        identity: {
          ...current.fund.identity,
          verified: false,
          loading: false,
          profile: null,
          error: formatError(error),
        },
      },
    }));
  } finally {
    fundIdentitySyncing = false;
  }
}

async function submitPayment(values) {
  const state = store.getState();
  const identity = state.fund.identity;
  const paymentState = state.fund.payment;
  if (!identity.verified || !identity.memberKey) return;

  const isAdmin = Boolean(state.auth.admin);
  const targetMemberKey = isAdmin
    ? (paymentState.proxyMemberKey || paymentState.proxyProfile?.member?.member_key || identity.memberKey)
    : identity.memberKey;
  const targetProfile = isAdmin && paymentState.proxyProfile ? paymentState.proxyProfile : identity.profile;

  const mode = values.payment_mode || '공용계좌';
  let publicAmount = Number(values.public_amount || 0);
  let companyAmount = Number(values.company_amount || 0);
  if (mode === '공용계좌') { publicAmount = values.amount; companyAmount = 0; }
  if (mode === '회사잔고') { publicAmount = 0; companyAmount = values.amount; }

  if (!paymentState.evidence?.dataUrl) {
    store.updateState((current) => ({ ...current, fund: { ...current.fund, payment: { ...current.fund.payment, error: '증빙 스크린샷을 먼저 첨부하세요.', success: null } } }));
    return;
  }
  if (mode === '분할납부' && (publicAmount <= 0 || companyAmount <= 0 || publicAmount + companyAmount !== values.amount)) {
    store.updateState((current) => ({ ...current, fund: { ...current.fund, payment: { ...current.fund.payment, error: '분할납부 합계가 총 납부금액과 일치하도록 입력하세요.', success: null } } }));
    return;
  }

  store.updateState((current) => ({
    ...current,
    fund: { ...current.fund, payment: { ...current.fund.payment, submitting: true, error: null, success: null, paymentMode: mode, amount: String(values.amount || ''), publicAmount: String(publicAmount || ''), companyAmount: String(companyAmount || ''), memo: values.memo } },
  }));

  try {
    const payload = {
      member_key: targetMemberKey,
      year: values.year,
      month: values.month,
      week: values.week,
      amount: values.amount,
      payment_mode: mode,
      public_amount: publicAmount,
      company_amount: companyAmount,
      evidence: paymentState.evidence,
      memo: values.memo || null,
      proxy_admin_name: isAdmin && targetMemberKey !== identity.memberKey ? state.auth.admin.nickname : null,
    };

    const requestId = isAdmin
      ? await submitAdminFundRequest(payload)
      : await submitSessionFundRequest(payload);

    const profile = isAdmin
      ? await fetchAdminFundProfile(targetMemberKey)
      : await fetchProfileForIdentity(identity);

    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        identity: isAdmin && targetMemberKey !== identity.memberKey ? current.fund.identity : { ...current.fund.identity, profile },
        payment: {
          ...current.fund.payment,
          proxyProfile: isAdmin ? profile : current.fund.payment.proxyProfile,
          selectedPeriod: null,
          submitting: false,
          error: null,
          success: `제출 #${requestId}이 검수대기로 접수되었습니다.`,
          paymentMode: '공용계좌',
          amount: '',
          publicAmount: '',
          companyAmount: '',
          evidence: null,
          evidencePreview: '',
          memo: '',
        },
      },
    }));

    if (isAdmin) await refreshAdminWorkspace();
  } catch (error) {
    store.updateState((current) => ({ ...current, fund: { ...current.fund, payment: { ...current.fund.payment, submitting: false, error: formatError(error), success: null } } }));
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
    const [requests, ledgerItems, feeRules, exemptions, balanceChecks, fundMemberSettings, integrityReport] = await Promise.all([
      fetchFundRequests(500),
      fetchFundAdminLedger(1000),
      fetchFundFeeRules(),
      period ? fetchFundExemptions(period) : Promise.resolve([]),
      fetchFundBalanceChecks(30),
      fetchFundMemberSettings(),
      fetchFundIntegrityReport(),
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
          fundMemberSettings: fundMemberSettings ?? [],
          integrityReport: integrityReport ?? null,
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

let fundAdminMutationInFlight = false;

async function runAdminMutation(mutation) {
  if (!store.getState().auth.admin || fundAdminMutationInFlight) return false;
  fundAdminMutationInFlight = true;
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
  } finally {
    fundAdminMutationInFlight = false;
  }
}

async function refreshAllAfterMutation(message) {
  const state = store.getState();
  const period = state.fund.selectedPeriod;
  const month = state.fund.selectedMonth;

  const [summary, statusItems, recentLedger, monthOverview, monthMatrix] = await Promise.all([
    fetchFundSummary(period),
    fetchFundPeriodStatus(period),
    fetchFundRecentLedger(12),
    fetchFundMonthOverview(month.year, month.month),
    fetchFundMonthMatrix(month.year, month.month),
  ]);

  store.updateState((current) => ({
    ...current,
    fund: {
      ...current.fund,
      summary,
      statusItems,
      recentLedger,
      monthOverview,
      monthMatrix,
      admin: { ...current.fund.admin, saving: false },
    },
  }));

  await refreshAdminWorkspace(message);

  const identity = store.getState().fund.identity;
  if (identity.verified) {
    try {
      const profile = await fetchProfileForIdentity(identity);
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


async function refreshCurrentWorkspace() {
  const state = store.getState();
  const month = state.fund.selectedMonth;
  const period = state.fund.selectedPeriod;

  setFundBusy(true);

  try {
    const [periods, summary, statusItems, recentLedger, monthOverview, monthMatrix] = await Promise.all([
      fetchFundPeriods(),
      fetchFundSummary(period),
      period ? fetchFundPeriodStatus(period) : Promise.resolve([]),
      fetchFundRecentLedger(12),
      fetchFundMonthOverview(month.year, month.month),
      fetchFundMonthMatrix(month.year, month.month),
    ]);

    store.updateState((current) => ({
      ...current,
      fund: {
        ...current.fund,
        loading: false,
        error: null,
        periods: periods ?? [],
        summary,
        statusItems: statusItems ?? [],
        recentLedger: recentLedger ?? [],
        monthOverview,
        monthMatrix,
      },
    }));

    if (store.getState().auth.admin) {
      await refreshAdminWorkspace();
    }
  } catch (error) {
    setFundError(error);
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
        entryCreator: { open: false, mode: 'payment', evidence: null, evidencePreview: '' },
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
