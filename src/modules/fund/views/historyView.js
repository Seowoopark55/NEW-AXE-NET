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
  const summary = summarizeLedger(filtered);
  const publicBalance = Number(state.fund.summary?.balance?.public ?? 0);

  return `
    <div class="fund-admin fund-admin--wide">
      ${renderPageHeader(
        '공금내역',
        '공용계좌를 중심으로 납부·수입·지출·조정 기록을 빠르게 확인하고 관리합니다.',
        `
          <div class="fund-page-actions">
            <button class="fund-secondary-button" type="button" data-open-entry-creator="payment">납부 직접등록</button>
            <button class="fund-primary-button" type="button" data-open-entry-creator="transaction">수입·지출 등록</button>
          </div>
        `,
      )}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin-metrics fund-admin-metrics--history">
        ${metric('공용계좌', formatMoney(publicBalance), '현재 계산 잔액', 'primary')}
        ${metric('현재 필터 변동', signedMoney(summary.public), '공용계좌 기준', summary.public < 0 ? 'warning' : '')}
        ${metric('표시 내역', `${filtered.length}건`, `전체 ${admin.ledgerItems.length}건`)}
      </div>

      <section class="fund-admin-panel fund-admin-panel--ledger">
        <div class="fund-admin-toolbar">
          <label class="fund-admin-search">
            <span>⌕</span>
            <input data-history-filter="search" value="${escapeHtml(filters.search)}" placeholder="닉네임 · 분류 · 메모" />
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
            ${option('분할납부', '분할납부', filters.account)}
          </select>
          <select data-history-filter="status">
            ${option('active', '정상 내역', filters.status)}
            ${option('cancelled', '삭제됨', filters.status)}
            ${option('all', '전체 상태', filters.status)}
          </select>
          <select data-history-filter="month">
            ${option('all', '전체 기간', filters.month)}
            ${months.map((month) => option(month, month.replace('-', '년 ') + '월', filters.month)).join('')}
          </select>
        </div>

        <div class="fund-admin-table fund-admin-table--ledger">
          <div class="fund-admin-table__head">
            <span>일자</span><span>내역</span><span>계좌</span><span>금액</span><span>증빙</span><span></span>
          </div>
          <div class="fund-admin-table__body">
            ${filtered.length ? filtered.map(renderLedger).join('') : '<div class="fund-empty-state fund-empty-state--large">조건에 맞는 공금내역이 없습니다.</div>'}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderLedger(item) {
  const deleted = item.status === 'cancelled';
  const evidence = item.evidence_url
    ? `<button class="fund-admin-evidence" type="button" data-evidence-preview="${escapeHtml(item.evidence_url)}" data-evidence-label="${escapeHtml(item.category || '공금')} 증빙">보기</button>`
    : '<span class="fund-admin-muted">—</span>';
  const detail = [item.nickname || '공용', item.year && item.week ? `${item.month}월 ${item.week}주차` : '', item.memo || '']
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');

  return `
    <article class="fund-admin-table__row ${deleted ? 'is-deleted' : ''}">
      <time>${formatDate(item.ledger_date)}</time>
      <div class="fund-admin-ledger-main">
        <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
        <span>${detail || '—'}</span>
      </div>
      <div class="fund-admin-ledger-account">
        <b>${shortAccount(item.account)}</b>
        <span>${typeLabel(item)}${deleted ? ' · 삭제' : ''}</span>
      </div>
      <b class="fund-admin-ledger-amount fund-money--${ledgerAmountType(item)}">${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}</b>
      <div>${evidence}</div>
      <div class="fund-admin-ledger-action">
        ${deleted
          ? `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-restore-ledger="${item.id}">복구</button>`
          : `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-edit-ledger="${item.id}">상세</button>`}
      </div>
    </article>
  `;
}

function summarizeLedger(items) {
  return items.reduce((sum, item) => {
    if (item.status !== 'active') return sum;
    const sign = item.direction === '지출' ? -1 : 1;
    sum.public += sign * Number(item.public_amount ?? (item.account === '공용계좌' ? item.amount : 0));
    sum.company += sign * Number(item.company_amount ?? (item.account === '회사잔고' ? item.amount : 0));
    return sum;
  }, { public: 0, company: 0 });
}

function metric(label, value, note, tone = '') {
  return `<div class="fund-admin-metric ${tone ? `is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`;
}

function signedMoney(value) {
  const number = Number(value ?? 0);
  return `${number > 0 ? '+' : ''}${formatMoney(number)}`;
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
        .filter(Boolean).join(' ').toLowerCase();
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
  if (item.entry_type === 'payment') return '공금';
  if (item.direction === '수입') return '수입';
  if (item.direction === '지출') return '지출';
  return '조정';
}

function shortAccount(account) {
  if (account === '공용계좌') return '공용';
  if (account === '회사잔고') return '잔고';
  if (account === '분할납부') return '분할';
  return account || '—';
}

function option(value, label, selected) {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`;
}
