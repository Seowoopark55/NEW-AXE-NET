import {
  escapeHtml,
  formatDate,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderHistoryView(state) {
  const fund = state.fund;
  const admin = fund.admin;
  const filters = admin.historyFilters;
  const selectedMonth = fund.selectedMonth;
  const activeRows = filterLedger(admin.ledgerItems, filters, selectedMonth);
  const baseRows = filterByMonth(
    admin.ledgerItems.filter((item) => item.status !== 'cancelled'),
    selectedMonth,
  );
  const deletedCount = filterByMonth(
    admin.ledgerItems.filter((item) => item.status === 'cancelled'),
    selectedMonth,
  ).length;
  const personOptions = getPersonOptions(baseRows);
  const showingDeleted = filters.status === 'cancelled';

  return `
    <div class="fund-admin fund-admin--ledger-wide">
      ${renderPageHeader(
        '공금내역',
        '월별 공금 수입·지출·납부 반영 내역을 확인하고 관리합니다.',
        `
          <div class="fund-page-actions fund-ledger-page-actions">
            ${renderMonthPicker(selectedMonth, fund.periods)}
            <button class="fund-primary-button" type="button" data-open-entry-creator="transaction">지출/수입 등록</button>
          </div>
        `,
      )}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="fund-ledger-shell">
        <div class="fund-ledger-filter-panel">
          <div class="fund-ledger-filter-head">
            <div>
              <strong>공금내역 필터</strong>
              <span>이름, 구분, 계좌를 선택해 월별 내역을 확인합니다.</span>
            </div>
            ${deletedCount ? `
              <button class="fund-ledger-deleted-toggle ${showingDeleted ? 'is-active' : ''}" type="button" data-history-status-toggle="${showingDeleted ? 'active' : 'cancelled'}">
                ${showingDeleted ? '정상 내역으로' : `삭제 내역 ${deletedCount}건`}
              </button>
            ` : ''}
          </div>
          <div class="fund-ledger-filter-grid">
            <label class="fund-ledger-filter-field fund-ledger-filter-field--name">
              <span>이름</span>
              <select data-history-filter="person" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.person)}
                ${personOptions.map((name) => option(name, name, filters.person)).join('')}
              </select>
            </label>
            <label class="fund-ledger-filter-field fund-ledger-filter-field--kind">
              <span>구분</span>
              <select data-history-filter="type" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.type)}
                ${option('payment', '승인반영', filters.type)}
                ${option('manual', '직접기입', filters.type)}
                ${option('income', '수입', filters.type)}
                ${option('expense', '지출', filters.type)}
                ${option('adjust', '잔액조정', filters.type)}
              </select>
            </label>
            <label class="fund-ledger-filter-field fund-ledger-filter-field--account">
              <span>계좌</span>
              <select data-history-filter="account" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.account)}
                ${option('공용계좌', '공용계좌', filters.account)}
                ${option('회사잔고', '회사잔고', filters.account)}
                ${option('분할납부', '분할납부', filters.account)}
              </select>
            </label>
            <div class="fund-ledger-filter-field fund-ledger-filter-field--reset">
              <span>초기화</span>
              <button class="fund-secondary-button fund-ledger-filter-reset" type="button" data-history-filter-reset ${showingDeleted ? 'disabled' : ''}>필터 초기화</button>
            </div>
          </div>
          <div class="fund-ledger-filter-summary">
            ${showingDeleted
              ? `선택월 삭제 내역 ${activeRows.length}건 표시`
              : `선택월 전체 ${baseRows.length}건 중 ${activeRows.length}건 표시`}
          </div>
        </div>

        <div class="fund-ledger-table-wrap">
          <table class="fund-ledger-table">
            <colgroup>
              <col class="fund-ledger-col-date" />
              <col class="fund-ledger-col-type" />
              <col class="fund-ledger-col-category" />
              <col class="fund-ledger-col-person" />
              <col class="fund-ledger-col-period" />
              <col class="fund-ledger-col-amount" />
              <col class="fund-ledger-col-direction" />
              <col class="fund-ledger-col-account" />
              <col class="fund-ledger-col-evidence" />
              <col class="fund-ledger-col-memo" />
              <col class="fund-ledger-col-manage" />
            </colgroup>
            <thead>
              <tr>
                <th>날짜</th>
                <th>구분</th>
                <th>항목</th>
                <th>관련자</th>
                <th>월/주차</th>
                <th>금액</th>
                <th>방향</th>
                <th>계좌</th>
                <th>증빙</th>
                <th class="is-left">메모</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              ${activeRows.length
                ? activeRows.map(renderLedgerRow).join('')
                : '<tr><td colspan="11"><div class="fund-empty-state fund-ledger-empty">조건에 맞는 공금내역이 없습니다.</div></td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderLedgerRow(item) {
  const deleted = item.status === 'cancelled';
  const type = item.ledger_type || entryTypeLabel(item);
  const category = item.category || '기타';
  const nickname = item.nickname || '';
  const period = item.year && item.month
    ? `${Number(item.month)}월${item.week ? ` ${Number(item.week)}주차` : ''}`
    : '—';
  const evidence = item.evidence_url
    ? `<button class="fund-ledger-evidence" type="button" data-evidence-preview="${escapeHtml(item.evidence_url)}" data-evidence-label="${escapeHtml(category)} 증빙">보기</button>`
    : '<span class="fund-ledger-muted">—</span>';

  return `
    <tr class="${deleted ? 'is-deleted' : ''}">
      <td>${formatDate(item.ledger_date)}</td>
      <td class="fund-ledger-type-cell">
        <span>${escapeHtml(type)}</span>
        ${ledgerKindBadge(item)}
      </td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(nickname || '—')}</td>
      <td>${escapeHtml(period)}</td>
      <td class="fund-ledger-money fund-money--${ledgerAmountType(item)}">${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}</td>
      <td>${escapeHtml(item.direction || '—')}</td>
      <td>${escapeHtml(item.account || '—')}</td>
      <td>${evidence}</td>
      <td class="is-left fund-ledger-memo" title="${escapeHtml(item.memo || '')}">${escapeHtml(item.memo || '') || '—'}</td>
      <td>
        ${deleted
          ? `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-restore-ledger="${item.id}">복구</button>`
          : `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-edit-ledger="${item.id}">수정</button>`}
      </td>
    </tr>`;
}

function filterLedger(items, filters, selectedMonth) {
  const showingDeleted = filters.status === 'cancelled';
  return filterByMonth(items, selectedMonth)
    .filter((item) => showingDeleted ? item.status === 'cancelled' : item.status !== 'cancelled')
    .filter((item) => {
      if (showingDeleted) return true;
      if (filters.person !== 'all' && String(item.nickname || '') !== filters.person) return false;
      if (filters.account !== 'all' && item.account !== filters.account) return false;
      if (!passType(item, filters.type)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.ledger_date || b.created_at || 0) - new Date(a.ledger_date || a.created_at || 0));
}

function filterByMonth(items, month) {
  if (!month?.year || !month?.month) return [...items];
  return items.filter((item) => {
    if (Number(item.year) === Number(month.year) && Number(item.month) === Number(month.month)) return true;
    if (item.year || item.month) return false;
    const date = new Date(item.ledger_date || item.created_at || 0);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === Number(month.year)
      && date.getMonth() + 1 === Number(month.month);
  });
}

function passType(item, type) {
  if (!type || type === 'all') return true;
  if (type === 'payment') return isApprovalLedger(item);
  if (type === 'manual') return isManualLedger(item);
  if (type === 'income') return item.direction === '수입';
  if (type === 'expense') return item.direction === '지출';
  if (type === 'adjust') return item.direction === '조정' || item.entry_type === 'adjustment' || item.ledger_type === '조정';
  return true;
}

function isManualLedger(item) {
  return !item.request_id;
}

function isApprovalLedger(item) {
  return Boolean(item.request_id) || (item.entry_type === 'payment' && !isManualLedger(item));
}

function ledgerKindBadge(item) {
  if (isManualLedger(item)) return '<span class="fund-ledger-kind-badge is-manual">직접기입</span>';
  if (isApprovalLedger(item)) return '<span class="fund-ledger-kind-badge is-payment">승인반영</span>';
  return '';
}

function entryTypeLabel(item) {
  if (item.entry_type === 'payment') return '공금납부';
  if (item.direction === '수입') return '수입';
  if (item.direction === '지출') return '지출';
  if (item.direction === '조정') return '조정';
  return '기타';
}

function getPersonOptions(items) {
  return [...new Set(items.map((item) => String(item.nickname || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

function renderMonthPicker(month, periods = []) {
  if (!month) return '';
  const months = uniqueMonths(periods);
  const value = `${month.year}-${String(month.month).padStart(2, '0')}`;
  if (!months.some((item) => item.value === value)) {
    months.push({ value, label: `${month.year}년 ${month.month}월`, year: month.year, month: month.month });
    months.sort((a, b) => b.year - a.year || b.month - a.month);
  }
  return `
    <label class="fund-ledger-month-select">
      <select data-fund-month-select>
        ${months.map((item) => option(item.value, item.label, value)).join('')}
      </select>
    </label>`;
}

function uniqueMonths(periods) {
  const map = new Map();
  for (const item of periods ?? []) {
    const year = Number(item.year);
    const month = Number(item.month);
    if (!year || !month) continue;
    const value = `${year}-${String(month).padStart(2, '0')}`;
    if (!map.has(value)) map.set(value, { value, label: `${year}년 ${month}월`, year, month });
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.month - a.month);
}

function option(value, label, selected) {
  return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}
