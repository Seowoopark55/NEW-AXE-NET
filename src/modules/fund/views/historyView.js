import {
  escapeHtml,
  formatDate,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fundUtils.js';

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
    <div class="ops-ledger">
      <header class="ops-view-head">
        <div>
          <h2>공금내역</h2>
          <p>월별 원장을 조회하고 직접 수입·지출을 등록하거나 기존 내역을 수정합니다.</p>
        </div>
        <div class="ops-view-actions">
          ${renderMonthPicker(selectedMonth, fund.periods)}
          <button class="ops-primary-button" type="button" data-open-entry-creator="transaction">지출/수입 등록</button>
        </div>
      </header>

      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="ops-surface">
        <div class="ops-toolbar">
          <div class="ops-toolbar__group">
            <label class="ops-filter-label">이름
              <select class="ops-select" data-history-filter="person" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.person)}
                ${personOptions.map((name) => option(name, name, filters.person)).join('')}
              </select>
            </label>
            <label class="ops-filter-label">구분
              <select class="ops-select" data-history-filter="type" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.type)}
                ${option('payment', '승인반영', filters.type)}
                ${option('manual', '직접기입', filters.type)}
                ${option('income', '수입', filters.type)}
                ${option('expense', '지출', filters.type)}
                ${option('adjust', '잔액조정', filters.type)}
              </select>
            </label>
            <label class="ops-filter-label">계좌
              <select class="ops-select" data-history-filter="account" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체', filters.account)}
                ${option('공용계좌', '공용계좌', filters.account)}
                ${option('회사잔고', '회사잔고', filters.account)}
                ${option('분할납부', '분할납부', filters.account)}
              </select>
            </label>
            <button class="ops-secondary-button" type="button" data-history-filter-reset ${showingDeleted ? 'disabled' : ''}>초기화</button>
          </div>
          <div class="ops-toolbar__group">
            <span class="ops-toolbar__summary">
              ${showingDeleted ? `삭제 ${activeRows.length}건` : `${baseRows.length}건 중 ${activeRows.length}건 표시`}
            </span>
            ${deletedCount ? `
              <button class="ops-icon-button ${showingDeleted ? 'is-gold' : ''}" type="button" data-history-status-toggle="${showingDeleted ? 'active' : 'cancelled'}">
                ${showingDeleted ? '정상내역' : `삭제 ${deletedCount}`}
              </button>
            ` : ''}
          </div>
        </div>

        <div class="ops-ledger__table-wrap">
          <table class="ops-ledger__table">
            <thead>
              <tr>
                <th class="ops-ledger__date">날짜</th>
                <th class="ops-ledger__entry">내역</th>
                <th class="ops-ledger__person">관련자 / 주차</th>
                <th class="ops-ledger__account">계좌</th>
                <th class="ops-ledger__amount">금액</th>
                <th class="ops-ledger__evidence">증빙</th>
                <th class="ops-ledger__manage">관리</th>
              </tr>
            </thead>
            <tbody>
              ${activeRows.length
                ? activeRows.map(renderLedgerRow).join('')
                : '<tr><td colspan="7" class="ops-empty-cell">조건에 맞는 공금내역이 없습니다.</td></tr>'}
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
  const nickname = item.nickname || '—';
  const period = item.year && item.month
    ? `${Number(item.month)}월${item.week ? ` ${Number(item.week)}주차` : ''}`
    : '—';
  const memo = String(item.memo || '').trim();
  const sub = [type, item.direction || '', memo].filter(Boolean).join(' · ');
  const isOut = ledgerAmountType(item) === 'out';

  return `
    <tr class="${deleted ? 'is-deleted' : ''}">
      <td class="ops-ledger__date">${formatDate(item.ledger_date)}</td>
      <td class="ops-ledger__entry" title="${escapeHtml(sub)}">
        <div class="ops-ledger__main">
          <span>${escapeHtml(category)}</span>
          ${ledgerKindBadge(item)}
        </div>
        <div class="ops-ledger__sub">${escapeHtml(sub || '—')}</div>
      </td>
      <td class="ops-ledger__person">
        <strong>${escapeHtml(nickname)}</strong>
        <span>${escapeHtml(period)}</span>
      </td>
      <td class="ops-ledger__account"><span>${escapeHtml(item.account || '—')}</span></td>
      <td class="ops-ledger__amount"><span class="ops-ledger__money ${isOut ? 'is-out' : ''}">${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}</span></td>
      <td class="ops-ledger__evidence">
        ${item.evidence_url
          ? `<button class="ops-icon-button is-gold" type="button" data-evidence-preview="${escapeHtml(item.evidence_url)}" data-evidence-label="${escapeHtml(category)} 증빙">보기</button>`
          : '<span class="ops-toolbar__summary">—</span>'}
      </td>
      <td class="ops-ledger__manage">
        ${deleted
          ? `<button class="ops-icon-button" type="button" data-restore-ledger="${item.id}">복구</button>`
          : `<button class="ops-icon-button" type="button" data-edit-ledger="${item.id}">수정</button>`}
      </td>
    </tr>
  `;
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

function isManualLedger(item) { return !item.request_id; }
function isApprovalLedger(item) { return Boolean(item.request_id) || (item.entry_type === 'payment' && !isManualLedger(item)); }

function ledgerKindBadge(item) {
  if (isManualLedger(item)) return '<span class="ops-kind ops-kind--manual">직접</span>';
  if (isApprovalLedger(item)) return '<span class="ops-kind ops-kind--payment">승인</span>';
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
    <select class="ops-select" data-fund-month-select aria-label="월 선택">
      ${months.map((item) => option(item.value, item.label, value)).join('')}
    </select>
  `;
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
