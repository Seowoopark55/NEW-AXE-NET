import { renderFundNav } from './components/fundNav.js';
import { evidenceFromClipboard, evidenceFromDrop } from './evidence.js';
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
  const pendingCount = fund.admin.requests.filter((item) => item.status === 'pending' || item.status === 'hold').length;

  root.innerHTML = `
    <section class="ops-fund">
      <header class="ops-fund__header">
        <div>
          <span class="ops-fund__kicker">FUND MANAGEMENT</span>
          <h1>공금관리</h1>
          <p>납부 현황부터 검수와 원장 관리까지 한 흐름으로 확인합니다.</p>
        </div>
        <button class="ops-quiet-button" type="button" data-fund-refresh><span aria-hidden="true">↻</span> 새로고침</button>
      </header>

      ${renderOpsSummary(state, pendingCount)}
      ${renderFundNav(safeSection, isAdmin, pendingCount)}

      <div class="ops-fund__content">
        ${renderSection(safeSection, state)}
      </div>
    </section>

    ${fund.admin.ledgerEditor.open && isAdmin ? renderLedgerEditModal(fund.admin, state.members.items) : ''}
    ${fund.admin.entryCreator?.open && isAdmin ? renderEntryCreatorModal(fund.admin, fund, state.members.items) : ''}
  `;

  bindFundEvents(root, state, actions);
}

function renderOpsSummary(state, pendingCount) {
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
  const exemptionCount = countActiveExemptionGroups(fund.admin.exemptions ?? []) || Number(fund.monthOverview?.totals?.exempt || 0);

  return `
    <section class="ops-fund-summary" aria-label="공금 요약">
      <div class="ops-fund-summary__balance">
        <span>공용계좌 잔액</span>
        <strong>${formatMoney(balance.public)}</strong>
      </div>
      <div class="ops-fund-summary__metrics">
        <div class="${pendingCount ? 'is-alert' : ''}">
          <span>검수대기·보류</span>
          <strong>${pendingCount}</strong>
        </div>
        <div>
          <span>선택월 승인</span>
          <strong>${approvedCount}</strong>
        </div>
        <div>
          <span>활성 면제</span>
          <strong>${exemptionCount}</strong>
        </div>
      </div>
    </section>
  `;
}

function countActiveExemptionGroups(rows) {
  const keys = new Set();
  (rows ?? []).forEach((item) => {
    if (!item?.enabled) return;
    keys.add(item.range_key || `legacy:${item.id}`);
  });
  return keys.size;
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

  root.querySelector('[data-fund-month-select]')?.addEventListener('change', (event) => {
    const [year, month] = String(event.target.value).split('-').map(Number);
    if (!year || !month) return;
    actions.onMonthSelect?.({ year, month });
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

  root.querySelectorAll('[data-fund-open-login]').forEach((button) => {
    button.addEventListener('click', () => actions.onOpenLogin?.());
  });

  root.querySelectorAll('[data-payment-period]').forEach((button) => {
    button.addEventListener('click', () => {
      const [year, month, week] = button.dataset.paymentPeriod.split('-').map(Number);
      actions.onPaymentPeriodSelect?.({ year, month, week });
    });
  });

  root.querySelector('[data-fund-proxy-member]')?.addEventListener('change', (event) => {
    actions.onProxyMemberSelect?.(String(event.target.value || ''));
  });

  root.querySelector('[data-payment-mode]')?.addEventListener('change', (event) => {
    actions.onPaymentModeChange?.(String(event.target.value || '공용계좌'));
  });

  root.querySelectorAll('[data-payment-draft]').forEach((input) => {
    input.addEventListener('change', () => {
      actions.onPaymentDraftChange?.(input.dataset.paymentDraft, input.value);
    });
  });

  const evidenceInput = root.querySelector('[data-evidence-file]');
  root.querySelector('[data-evidence-browse]')?.addEventListener('click', () => evidenceInput?.click());
  evidenceInput?.addEventListener('change', () => actions.onEvidenceFile?.(evidenceInput.files?.[0] || null));
  root.querySelector('[data-evidence-clear]')?.addEventListener('click', () => actions.onEvidenceClear?.());

  const evidenceDrop = root.querySelector('[data-evidence-drop]');
  evidenceDrop?.addEventListener('click', () => evidenceInput?.click());
  evidenceDrop?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); evidenceInput?.click(); }
  });
  evidenceDrop?.addEventListener('paste', (event) => {
    const file = evidenceFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    actions.onEvidenceFile?.(file);
  });
  evidenceDrop?.addEventListener('dragover', (event) => { event.preventDefault(); evidenceDrop.classList.add('is-dragging'); });
  evidenceDrop?.addEventListener('dragleave', () => evidenceDrop.classList.remove('is-dragging'));
  evidenceDrop?.addEventListener('drop', (event) => {
    event.preventDefault();
    evidenceDrop.classList.remove('is-dragging');
    const file = evidenceFromDrop(event);
    if (file) actions.onEvidenceFile?.(file);
  });

  root.querySelector('[data-fund-payment-request-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    actions.onSubmitPayment?.({
      year: Number(data.get('year')),
      month: Number(data.get('month')),
      week: Number(data.get('week')),
      amount: Number(data.get('amount')),
      payment_mode: String(data.get('payment_mode') || '공용계좌'),
      public_amount: Number(data.get('public_amount') || 0),
      company_amount: Number(data.get('company_amount') || 0),
      memo: String(data.get('memo') || '').trim(),
    });
  });

  root.querySelectorAll('[data-evidence-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      openEvidencePreview(
        String(button.dataset.evidencePreview || ''),
        String(button.dataset.evidenceLabel || '공금 증빙'),
      );
    });
  });

  root.querySelectorAll('[data-request-filter]').forEach((button) => {
    button.addEventListener('click', () => actions.onRequestFilterChange?.(button.dataset.requestFilter));
  });

  const updateReviewSelectionUi = () => {
    const boxes = [...root.querySelectorAll('[data-review-select]')];
    const selected = boxes.filter((box) => box.checked);
    const count = root.querySelector('[data-review-selected-count]');
    const bulkButton = root.querySelector('[data-review-bulk-approve]');
    const selectAll = root.querySelector('[data-review-select-all]');
    if (count) count.textContent = String(selected.length);
    if (bulkButton) bulkButton.disabled = selected.length === 0;
    if (selectAll) {
      selectAll.checked = boxes.length > 0 && selected.length === boxes.length;
      selectAll.indeterminate = selected.length > 0 && selected.length < boxes.length;
    }
  };

  root.querySelectorAll('[data-review-select]').forEach((checkbox) => {
    checkbox.addEventListener('change', updateReviewSelectionUi);
  });

  root.querySelector('[data-review-select-all]')?.addEventListener('change', (event) => {
    root.querySelectorAll('[data-review-select]').forEach((checkbox) => {
      checkbox.checked = Boolean(event.target.checked);
    });
    updateReviewSelectionUi();
  });

  root.querySelector('[data-review-bulk-approve]')?.addEventListener('click', () => {
    const ids = [...root.querySelectorAll('[data-review-select]:checked')]
      .map((checkbox) => Number(checkbox.dataset.reviewSelect))
      .filter(Number.isInteger);
    if (!ids.length) return;
    actions.onApproveSelectedRequests?.(ids);
  });

  const reviewNote = (id) => String(root.querySelector(`[data-review-note="${id}"]`)?.value || '').trim();

  root.querySelectorAll('[data-approve-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.approveRequest);
      actions.onApproveRequest?.(id, reviewNote(id));
    });
  });

  root.querySelectorAll('[data-hold-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.holdRequest);
      actions.onHoldRequest?.(id, reviewNote(id));
    });
  });

  root.querySelectorAll('[data-reject-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.rejectRequest);
      actions.onRejectRequest?.(id, reviewNote(id));
    });
  });

  root.querySelectorAll('[data-history-filter]').forEach((input) => {
    input.addEventListener('change', () => actions.onHistoryFilterChange?.(
      input.dataset.historyFilter,
      input.value,
    ));
  });

  root.querySelector('[data-history-filter-reset]')?.addEventListener('click', () => {
    actions.onHistoryFilterReset?.();
  });

  root.querySelector('[data-history-status-toggle]')?.addEventListener('click', (event) => {
    actions.onHistoryFilterChange?.('status', event.currentTarget.dataset.historyStatusToggle || 'active');
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

  bindEvidenceDropzone(root, {
    fileSelector: '[data-admin-entry-evidence-file]',
    browseSelector: '[data-admin-entry-evidence-browse]',
    clearSelector: '[data-admin-entry-evidence-clear]',
    dropSelector: '[data-admin-entry-evidence-drop]',
    onFile: (file) => actions.onEntryEvidenceFile?.(file),
    onClear: () => actions.onEntryEvidenceClear?.(),
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

  bindEvidenceDropzone(root, {
    fileSelector: '[data-balance-evidence-file]',
    browseSelector: '[data-balance-evidence-browse]',
    clearSelector: '[data-balance-evidence-clear]',
    dropSelector: '[data-balance-evidence-drop]',
    onFile: (file) => actions.onBalanceEvidenceFile?.(file),
    onClear: () => actions.onBalanceEvidenceClear?.(),
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

  const exemptionForm = root.querySelector('[data-exemption-form]');
  if (exemptionForm) {
    const startMonth = exemptionForm.querySelector('[data-exemption-start-month]');
    const startWeek = exemptionForm.querySelector('[data-exemption-start-week]');
    const endMonth = exemptionForm.querySelector('[data-exemption-end-month]');
    const endWeek = exemptionForm.querySelector('[data-exemption-end-week]');
    startMonth?.addEventListener('change', () => syncExemptionWeekOptions(startMonth, startWeek, false));
    endMonth?.addEventListener('change', () => syncExemptionWeekOptions(endMonth, endWeek, true));
    exemptionForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      actions.onCreateExemption?.({
        member_key: String(data.get('member_key') || ''),
        start_period: makeExemptionPeriodValue(data.get('start_month'), data.get('start_week')),
        end_period: makeExemptionPeriodValue(data.get('end_month'), data.get('end_week')),
        reason: String(data.get('reason') || '').trim(),
      });
    });
  }

  root.querySelectorAll('[data-disable-exemption]').forEach((button) => {
    button.addEventListener('click', () => actions.onDisableExemption?.(Number(button.dataset.disableExemption)));
  });

  root.querySelectorAll('[data-disable-exemption-range]').forEach((button) => {
    button.addEventListener('click', () => actions.onDisableExemptionRange?.(button.dataset.disableExemptionRange));
  });

  root.querySelectorAll('[data-fund-member-setting-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      actions.onSaveFundMemberSetting?.({
        member_key: String(form.dataset.memberKey || ''),
        nickname: String(form.dataset.nickname || ''),
        enabled: data.get('enabled') === 'on',
        join_date_override: String(data.get('join_date_override') || ''),
        note: String(data.get('note') || '').trim(),
      });
    });
  });
}


function makeExemptionPeriodValue(monthValue, weekValue) {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  const week = Number(weekValue || 0);
  return `${year}-${month}-${week}`;
}

function syncExemptionWeekOptions(monthInput, weekSelect, preferLast) {
  if (!monthInput || !weekSelect) return;
  const [year, month] = String(monthInput.value || '').split('-').map(Number);
  if (!year || !month) return;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6) count += 1;
  }
  const previous = Number(weekSelect.value || 1);
  const selected = preferLast ? count : Math.min(previous, count);
  weekSelect.innerHTML = Array.from({ length: Math.max(count, 1) }, (_, index) => index + 1)
    .map((week) => `<option value="${week}" ${week === selected ? 'selected' : ''}>${week}주차</option>`)
    .join('');
}

function bindEvidenceDropzone(root, options) {
  const input = root.querySelector(options.fileSelector);
  const drop = root.querySelector(options.dropSelector);
  root.querySelector(options.browseSelector)?.addEventListener('click', () => input?.click());
  root.querySelector(options.clearSelector)?.addEventListener('click', () => options.onClear?.());
  input?.addEventListener('change', () => options.onFile?.(input.files?.[0] || null));
  drop?.addEventListener('click', () => input?.click());
  drop?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input?.click();
    }
  });
  drop?.addEventListener('paste', (event) => {
    const file = evidenceFromClipboard(event);
    if (!file) return;
    event.preventDefault();
    options.onFile?.(file);
  });
  drop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-dragging');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-dragging'));
  drop?.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragging');
    const file = evidenceFromDrop(event);
    if (file) options.onFile?.(file);
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


function openEvidencePreview(src, label = '공금 증빙') {
  if (!src) return;

  document.querySelector('[data-evidence-lightbox]')?.remove();

  const safeLabel = escapeHtml(label);
  const safeSrc = escapeHtml(src);
  const overlay = document.createElement('div');
  overlay.className = 'fund-evidence-lightbox';
  overlay.dataset.evidenceLightbox = '';
  overlay.innerHTML = `
    <div class="fund-evidence-lightbox__backdrop" data-evidence-lightbox-close></div>
    <section class="fund-evidence-lightbox__panel" role="dialog" aria-modal="true" aria-label="${safeLabel}">
      <header class="fund-evidence-lightbox__header">
        <div>
          <span>EVIDENCE PREVIEW</span>
          <strong>${safeLabel}</strong>
          <p>증빙 이미지는 원본 비율로 표시됩니다.</p>
        </div>
        <button class="fund-evidence-lightbox__close" type="button" aria-label="닫기" data-evidence-lightbox-close>×</button>
      </header>
      <div class="fund-evidence-lightbox__stage">
        <div class="fund-evidence-lightbox__image-wrap">
          <img src="${safeSrc}" alt="${safeLabel}" />
        </div>
      </div>
      <footer class="fund-evidence-lightbox__footer">
        <span>ESC 또는 바깥 영역을 눌러 닫을 수 있습니다.</span>
        <a href="${safeSrc}" target="_blank" rel="noopener noreferrer">원본 열기</a>
      </footer>
    </section>
  `;

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  overlay.querySelectorAll('[data-evidence-lightbox-close]').forEach((element) => {
    element.addEventListener('click', close);
  });

  const onKey = (event) => {
    if (event.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}


