import {
  escapeHtml,
  formatDate,
  formatMoney,
  ledgerAmountType,
  ledgerSign,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderHistoryView(state) {
  const admin = state.fund.admin;
  const filters = admin.historyFilters;
  const filtered = filterLedger(admin.ledgerItems, filters);
  const months = getMonths(admin.ledgerItems);

  return `
    ${renderPageHeader(
      '공금내역',
      '납부·수입·지출·조정 기록을 검색하고 상세에서 수정·삭제·복구합니다.',
      `
        <div class="fund-page-actions">
          <button class="fund-secondary-button" type="button" data-open-entry-creator="payment">납부 직접등록</button>
          <button class="fund-primary-button" type="button" data-open-entry-creator="transaction">수입·지출 등록</button>
        </div>
      `,
    )}
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

    <div class="fund-history-toolbar">
      <label class="fund-search-field">
        <span>⌕</span>
        <input data-history-filter="search" value="${escapeHtml(filters.search)}" placeholder="닉네임 · 분류 · 메모 검색" />
      </label>

      <select data-history-filter="type">
        ${option('all', '전체 유형', filters.type)}
        ${option('payment', '공금납부', filters.type)}
        ${option('income', '수입', filters.type)}
        ${option('expense', '지출', filters.type)}
        ${option('adjustment', '조정', filters.type)}
      </select>

      <select data-history-filter="account">
        ${option('all', '전체 계좌', filters.account)}
        ${option('공용계좌', '공용계좌', filters.account)}
        ${option('회사잔고', '회사잔고', filters.account)}
      </select>

      <select data-history-filter="status">
        ${option('active', '정상 내역', filters.status)}
        ${option('cancelled', '삭제된 내역', filters.status)}
        ${option('all', '전체 상태', filters.status)}
      </select>

      <select data-history-filter="month">
        ${option('all', '전체 기간', filters.month)}
        ${months.map((month) => option(month, month.replace('-', '년 ') + '월', filters.month)).join('')}
      </select>
    </div>

    <div class="fund-history-summary">
      <span>표시 <b>${filtered.length}</b>건</span>
      <span>전체 <b>${admin.ledgerItems.length}</b>건</span>
    </div>

    <div class="fund-history-list">
      ${filtered.length ? filtered.map(renderLedger).join('') : '<div class="fund-empty-state fund-empty-state--large">조건에 맞는 공금내역이 없습니다.</div>'}
    </div>
  `;
}

function renderLedger(item) {
  const deleted = item.status === 'cancelled';
  return `
    <article class="fund-history-item ${deleted ? 'fund-history-item--deleted' : ''}">
      <div class="fund-history-item__date">${formatDate(item.ledger_date)}</div>
      <div class="fund-history-item__body">
        <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
        <span>${escapeHtml(item.nickname || '공용')} · ${escapeHtml(item.account || '')}${item.year && item.week ? ` · ${item.month}월 ${item.week}주차` : ''}</span>
        ${item.memo ? `<small>${escapeHtml(item.memo)}</small>` : ''}
      </div>
      <span class="fund-history-item__type">${typeLabel(item)}</span>
      <b class="fund-money--${ledgerAmountType(item)}">${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}</b>
      <div class="fund-history-item__actions">
        ${deleted
          ? `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-restore-ledger="${item.id}">복구</button>`
          : `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-edit-ledger="${item.id}">상세</button>`}
      </div>
    </article>
  `;
}

function filterLedger(items, filters) {
  const search = filters.search.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.account !== 'all' && item.account !== filters.account) return false;
    if (filters.type !== 'all' && item.entry_type !== filters.type) return false;
    if (filters.month !== 'all') {
      const date = new Date(item.ledger_date);
      const key = Number.isNaN(date.getTime()) ? String(item.ledger_date).slice(0, 7) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (key !== filters.month) return false;
    }
    if (search) {
      const haystack = [item.nickname, item.category, item.memo, item.account, item.ledger_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function getMonths(items) {
  return [...new Set(items.map((item) => {
    const date = new Date(item.ledger_date);
    if (Number.isNaN(date.getTime())) return String(item.ledger_date).slice(0, 7);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))].sort().reverse();
}

function typeLabel(item) {
  if (item.entry_type === 'payment') return '공금납부';
  if (item.direction === '수입') return '수입';
  if (item.direction === '지출') return '지출';
  return '조정';
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
}
