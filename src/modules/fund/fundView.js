import { renderFundNav } from './components/fundNav.js';
import { renderEntryCreatorModal, renderLedgerEditModal } from './components/shared.js';
import { renderOverviewView } from './views/overviewView.js';
import { renderPaymentView } from './views/paymentView.js';
import { renderSubmissionsView } from './views/submissionsView.js';
import { renderReviewView } from './views/reviewView.js';
import { renderHistoryView } from './views/historyView.js';
import { renderBalanceView } from './views/balanceView.js';
import { renderFeeRulesView } from './views/feeRulesView.js';
import { renderExemptionsView } from './views/exemptionsView.js';
import { renderIntegrityView } from './views/integrityView.js';
import { renderFundMembersView } from './views/fundMembersView.js';
import { escapeHtml, formatMoney } from './fundUtils.js';

export function renderFundView(root, state, actions = {}) {
  const { fund, system, auth } = state;

  if (!system.connected) {
    root.innerHTML = renderShellMessage('공금', system.error || 'Supabase 연결을 확인하고 있습니다.', Boolean(system.error));
    return;
  }

  if (!fund.initialized || fund.loading) {
    root.innerHTML = renderShellMessage('공금', '공금 데이터를 준비하고 있습니다.');
    return;
  }

  if (fund.error) {
    root.innerHTML = renderShellMessage('공금', fund.error, true);
    return;
  }

  const isAdmin = Boolean(auth.admin);
  const safeSection = normalizeSection(fund.section, isAdmin);
  const pendingCount = fund.admin.requests.filter((item) => item.status === 'pending').length;

  root.innerHTML = `
    <section class="fund-workspace fund-workspace--axe">
      <div class="fund-page-head fund-page-head--legacy">
        <div>
          <h1>공금관리</h1>
          <p>증빙 제출, 검수, 기간 면제, 공금내역과 잔액 정합성을 통합 관리합니다.</p>
        </div>
        <button class="fund-refresh-button" type="button" data-fund-refresh>새로고침</button>
      </div>

      ${renderLegacySummary(state, pendingCount)}

      ${renderFundNav(safeSection, isAdmin, pendingCount)}

      <div class="fund-workspace__content">
        ${renderSection(safeSection, state)}
      </div>
    </section>

    ${fund.admin.ledgerEditor.open && isAdmin ? renderLedgerEditModal(fund.admin, state.members.items) : ''}
    ${fund.admin.entryCreator?.open && isAdmin ? renderEntryCreatorModal(fund.admin, fund, state.members.items) : ''}
  `;

  bindFundEvents(root, state, actions);
}

function renderLegacySummary(state, pendingCount) {
  const fund = state.fund;
  const balance = fund.summary?.balance ?? {};
  const selectedMonth = fund.selectedMonth;
  const requests = fund.admin.requests ?? [];
  const approvedCount = selectedMonth
    ? requests.filter((item) =>
        item.status === 'approved'
        && Number(item.year) === Number(selectedMonth.year)
        && Number(item.month) === Number(selectedMonth.month)
      ).length
    : 0;
  const exemptionCount = Number(fund.monthOverview?.totals?.exempt ?? 0);

  return `
    <div class="fund-summary-grid fund-summary-grid-premium">
      <div class="fund-summary-card">
        <div class="fund-summary-value gold">${formatMoney(balance.public)}</div>
        <div class="fund-summary-label">공용계좌 계산 잔액</div>
      </div>
      <div class="fund-summary-card">
        <div class="fund-summary-value ${pendingCount ? 'warn' : ''}">${pendingCount}</div>
        <div class="fund-summary-label">전체 검수대기</div>
      </div>
      <div class="fund-summary-card">
        <div class="fund-summary-value">${approvedCount}</div>
        <div class="fund-summary-label">선택월 승인 건</div>
      </div>
      <div class="fund-summary-card">
        <div class="fund-summary-value">${exemptionCount}</div>
        <div class="fund-summary-label">선택월 면제</div>
      </div>
    </div>
  `;
}

function renderSection(section, state) {
  switch (section) {
    case 'payment': return renderPaymentView(state);
    case 'submissions': return renderSubmissionsView(state);
    case 'review': return renderReviewView(state);
    case 'history': return renderHistoryView(state);
    case 'balance': return renderBalanceView(state);
    case 'feeRules': return renderFeeRulesView(state);
    case 'exemptions': return renderExemptionsView(state);
    case 'integrity': return renderIntegrityView(state);
    case 'fundMembers': return renderFundMembersView(state);
    case 'overview':
    default: return renderOverviewView(state);
  }
}

function normalizeSection(section, isAdmin) {
  const publicSections = ['overview', 'payment', 'submissions'];
  const adminSections = ['review', 'history', 'balance', 'feeRules', 'exemptions', 'integrity', 'fundMembers'];
  if (publicSections.includes(section)) return section;
  if (isAdmin && adminSections.includes(section)) return section;
  return 'overview';
}

function bindFundEvents(root, state, actions) {
  root.querySelectorAll('[data-fund-refresh]').forEach((button) => {
    button.addEventListener('click', () => actions.onRefresh?.());
  });

  root.querySelectorAll('[data-fund-section]').forEach((button) => {
    button.addEventListener('click', () => actions.onSectionChange?.(button.dataset.fundSection));
  });

  root.querySelectorAll('[data-fund-month-shift]').forEach((button) => {
    button.addEventListener('click', () => actions.onMonthShift?.(Number(button.dataset.fundMonthShift)));
  });

  root.querySelectorAll('[data-fund-week]').forEach((button) => {
    button.addEventListener('click', () => actions.onWeekSelect?.({
      year: Number(button.dataset.year),
      month: Number(button.dataset.month),
      week: Number(button.dataset.fundWeek),
    }));
  });

  root.querySelector('[data-settings-period]')?.addEventListener('change', (event) => {
    const [year, month, week] = event.target.value.split('-').map(Number);
    actions.onWeekSelect?.({ year, month, week });
  });

  root.querySelectorAll('[data-fund-clear-identity]').forEach((button) => {
    button.addEventListener('click', () => actions.onClearIdentity?.());
  });

  root.querySelector('[data-fund-identity-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onVerifyIdentity?.(
      String(data.get('member_key') || ''),
      String(data.get('discord_user_id') || '').trim(),
    );
  });

  root.querySelectorAll('[data-payment-period]').forEach((button) => {
    button.addEventListener('click', () => {
      const [year, month, week] = button.dataset.paymentPeriod.split('-').map(Number);
      actions.onPaymentPeriodSelect?.({ year, month, week });
    });
  });

  root.querySelector('[data-fund-payment-request-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onSubmitPayment?.({
      year: Number(data.get('year')),
      month: Number(data.get('month')),
      week: Number(data.get('week')),
      amount: Number(data.get('amount')),
      evidence_url: String(data.get('evidence_url') || '').trim(),
      memo: String(data.get('memo') || '').trim(),
    });
  });

  root.querySelectorAll('[data-request-filter]').forEach((button) => {
    button.addEventListener('click', () => actions.onRequestFilterChange?.(button.dataset.requestFilter));
  });

  root.querySelectorAll('[data-approve-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = window.prompt('승인 메모가 있으면 입력하세요.', '');
      if (note === null) return;
      actions.onApproveRequest?.(Number(button.dataset.approveRequest), note.trim());
    });
  });

  root.querySelectorAll('[data-reject-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = window.prompt('거절 사유를 입력하세요.', '');
      if (note === null) return;
      actions.onRejectRequest?.(Number(button.dataset.rejectRequest), note.trim());
    });
  });

  root.querySelectorAll('[data-history-filter]').forEach((input) => {
    const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
    input.addEventListener(eventName, () => actions.onHistoryFilterChange?.(
      input.dataset.historyFilter,
      input.value,
    ));
  });

  root.querySelectorAll('[data-edit-ledger]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenLedgerEditor?.(Number(button.dataset.editLedger)));
  });

  root.querySelectorAll('[data-close-ledger-editor]').forEach((element) => {
    element.addEventListener('click', () => actions.onCloseLedgerEditor?.());
  });

  root.querySelector('[data-ledger-edit-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onUpdateLedger?.({
      ledger_id: Number(data.get('ledger_id')),
      entry_type: String(data.get('entry_type') || ''),
      amount: Number(data.get('amount')),
      account: String(data.get('account') || ''),
      ledger_date: String(data.get('ledger_date') || ''),
      direction: String(data.get('direction') || ''),
      category: String(data.get('category') || '').trim(),
      member_key: String(data.get('member_key') || ''),
      memo: String(data.get('memo') || '').trim(),
    });
  });

  root.querySelectorAll('[data-open-entry-creator]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenEntryCreator?.(button.dataset.openEntryCreator));
  });

  root.querySelectorAll('[data-close-entry-creator]').forEach((element) => {
    element.addEventListener('click', () => actions.onCloseEntryCreator?.());
  });

  root.querySelector('[data-direct-payment-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onCreateDirectPayment?.({
      member_key: String(data.get('member_key') || ''),
      amount: Number(data.get('amount')),
      account: String(data.get('account') || ''),
      ledger_date: String(data.get('ledger_date') || ''),
      memo: String(data.get('memo') || '').trim(),
    });
  });

  root.querySelector('[data-direct-transaction-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onCreateDirectTransaction?.({
      direction: String(data.get('direction') || ''),
      account: String(data.get('account') || ''),
      amount: Number(data.get('amount')),
      ledger_date: String(data.get('ledger_date') || ''),
      member_key: String(data.get('member_key') || ''),
      category: String(data.get('category') || '').trim(),
      memo: String(data.get('memo') || '').trim(),
    });
  });

  root.querySelectorAll('[data-delete-ledger]').forEach((button) => {
    button.addEventListener('click', () => {
      const reason = window.prompt('삭제 사유를 입력하세요. 실제 행은 지우지 않고 삭제 상태로 보존됩니다.', '');
      if (reason === null) return;
      actions.onDeleteLedger?.(Number(button.dataset.deleteLedger), reason.trim());
    });
  });

  root.querySelectorAll('[data-restore-ledger]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!window.confirm('삭제된 공금내역을 복구할까요?')) return;
      actions.onRestoreLedger?.(Number(button.dataset.restoreLedger));
    });
  });

  root.querySelector('[data-balance-check-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onCreateBalanceCheck?.({
      actual_public: Number(data.get('actual_public')),
      actual_company: Number(data.get('actual_company')),
      note: String(data.get('note') || '').trim(),
    });
  });

  root.querySelector('[data-fee-rule-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onCreateFeeRule?.({
      start_year: Number(data.get('start_year')),
      start_month: Number(data.get('start_month')),
      start_week: Number(data.get('start_week')),
      weekly_fee: Number(data.get('weekly_fee')),
      note: String(data.get('note') || '').trim(),
    });
  });

  root.querySelectorAll('[data-toggle-fee-rule]').forEach((button) => {
    button.addEventListener('click', () => actions.onToggleFeeRule?.(
      Number(button.dataset.toggleFeeRule),
      button.dataset.nextEnabled === 'true',
    ));
  });

  root.querySelector('[data-exemption-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onCreateExemption?.({
      member_key: String(data.get('member_key') || ''),
      reason: String(data.get('reason') || '').trim(),
    });
  });

  root.querySelectorAll('[data-disable-exemption]').forEach((button) => {
    button.addEventListener('click', () => actions.onDisableExemption?.(Number(button.dataset.disableExemption)));
  });
}

function renderShellMessage(title, message, error = false) {
  return `
    <section class="panel">
      <div class="panel__header"><div><h2>${escapeHtml(title)}</h2><p>Supabase · new_axe_net</p></div></div>
      <div class="panel__body">
        <div class="notice ${error ? 'notice--error' : ''}">${escapeHtml(message)}</div>
      </div>
    </section>
  `;
}
