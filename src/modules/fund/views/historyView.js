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
  const groups = groupLedgerRows(activeRows);

  return `
    <div class="ops-ledger">
      <header class="ops-view-head ops-view-head--ledger">
        <div>
          <h2>공금내역</h2>
          <p>필요한 정보만 빠르게 확인하고, 상세 작업은 행에서 바로 처리합니다.</p>
        </div>
        <div class="ops-view-actions">
          ${renderMonthPicker(selectedMonth, fund.periods)}
          <button class="ops-primary-button" type="button" data-open-entry-creator="transaction">수입·지출 등록</button>
        </div>
      </header>

      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="ops-ledger-board">
        <div class="ops-ledger-toolbar">
          <div class="ops-ledger-toolbar__filters">
            <label class="ops-ledger-filter">
              <select class="ops-select" aria-label="이름 필터" data-history-filter="person" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체 이름', filters.person)}
                ${personOptions.map((name) => option(name, name, filters.person)).join('')}
              </select>
            </label>
            <label class="ops-ledger-filter">
              <select class="ops-select" aria-label="구분 필터" data-history-filter="type" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체 구분', filters.type)}
                ${option('payment', '승인반영', filters.type)}
                ${option('manual', '직접기입', filters.type)}
                ${option('income', '수입', filters.type)}
                ${option('expense', '지출', filters.type)}
                ${option('adjust', '잔액조정', filters.type)}
              </select>
            </label>
            <label class="ops-ledger-filter">
              <select class="ops-select" aria-label="계좌 필터" data-history-filter="account" ${showingDeleted ? 'disabled' : ''}>
                ${option('all', '전체 계좌', filters.account)}
                ${option('공용계좌', '공용계좌', filters.account)}
                ${option('회사잔고', '회사잔고', filters.account)}
                ${option('분할납부', '분할납부', filters.account)}
              </select>
            </label>
            <button class="ops-text-button ops-ledger-reset" type="button" data-history-filter-reset ${showingDeleted ? 'disabled' : ''}>필터 초기화</button>
          </div>
          <div class="ops-ledger-toolbar__meta">
            <span>${showingDeleted ? `삭제 ${activeRows.length}건` : `${activeRows.length}건 표시`}</span>
            ${deletedCount ? `
              <button class="ops-text-button ${showingDeleted ? 'is-active' : ''}" type="button" data-history-status-toggle="${showingDeleted ? 'active' : 'cancelled'}">
                ${showingDeleted ? '정상 내역 보기' : `삭제 내역 ${deletedCount}`}
              </button>
            ` : ''}
          </div>
        </div>

        <div class="ops-ledger-list" role="list">
          ${groups.length
            ? groups.map(renderLedgerDay).join('')
            : '<div class="ops-ledger-empty">조건에 맞는 공금내역이 없습니다.</div>'}
        </div>
      </section>
    </div>
  `;
}

function renderLedgerDay(group) {
  const [year = '', month = '', day = ''] = String(group.date || '').match(/\d+/g) ?? [];
  return `
    <section class="ops-ledger-day" role="listitem">
      <div class="ops-ledger-day__date" aria-label="${escapeHtml(group.date)}">
        <strong>${escapeHtml(month && day ? `${month}.${day}` : group.date)}</strong>
        <span>${escapeHtml(year || '')}</span>
      </div>
      <div class="ops-ledger-day__rows">
        ${group.rows.map(renderLedgerRow).join('')}
      </div>
    </section>
  `;
}

function renderLedgerRow(item) {
  const deleted = item.status === 'cancelled';
  const type = item.ledger_type || entryTypeLabel(item);
  const category = item.category || '기타';
  const nickname = item.nickname || '—';
  const period = item.year && item.month
    ? `${Number(item.month)}월${item.week ? ` ${Number(item.week)}주차` : ''}`
    : '';
  const memo = String(item.memo || '').trim();
  const sub = [type, item.direction || '', memo].filter(Boolean).join(' · ');
  const isOut = ledgerAmountType(item) === 'out';
  const account = item.account || '—';
  const meta = [period, account].filter(Boolean).join(' · ');
  const evidenceLabel = [category, nickname !== '—' ? nickname : '', period].filter(Boolean).join(' · ');

  return `
    <article class="ops-ledger-row ${deleted ? 'is-deleted' : ''}">
      <div class="ops-ledger-row__entry" title="${escapeHtml(sub)}">
        <div class="ops-ledger-row__title">
          <strong>${escapeHtml(category)}</strong>
          ${ledgerKindBadge(item)}
        </div>
        <span>${escapeHtml(sub || '—')}</span>
      </div>

      <div class="ops-ledger-row__who">
        <strong>${escapeHtml(nickname)}</strong>
        <span>${escapeHtml(meta || account)}</span>
      </div>

      <div class="ops-ledger-row__money ${isOut ? 'is-out' : ''}">
        ${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}
      </div>

      <div class="ops-ledger-row__actions">
        ${item.evidence_url
          ? `<button class="ops-row-button ops-row-button--evidence" type="button" data-evidence-preview="${escapeHtml(item.evidence_url)}" data-evidence-label="${escapeHtml(evidenceLabel || '공금 증빙')}">증빙</button>`
          : '<span class="ops-ledger-row__no-evidence">—</span>'}
        ${deleted
          ? `<button class="ops-row-button" type="button" data-restore-ledger="${item.id}">복구</button>`
          : `<button class="ops-row-button ops-row-button--edit" type="button" data-edit-ledger="${item.id}" aria-label="내역 수정">수정</button>`}
      </div>
    </article>
  `;
}

function groupLedgerRows(rows) {
  const groups = [];
  const byDate = new Map();

  rows.forEach((item) => {
    const date = formatDate(item.ledger_date || item.created_at);
    if (!byDate.has(date)) {
      const group = { date, rows: [] };
      byDate.set(date, group);
      groups.push(group);
    }
    byDate.get(date).rows.push(item);
  });

  return groups;
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
    <select class="ops-select ops-select--month" data-fund-month-select aria-label="월 선택">
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
