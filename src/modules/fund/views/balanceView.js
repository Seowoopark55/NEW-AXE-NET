import {
  escapeAttribute,
  escapeHtml,
  formatDateTime,
  formatMoney,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderBalanceView(state) {
  const admin = state.fund.admin;
  const balance = state.fund.summary?.balance ?? {};

  return `
    ${renderPageHeader('잔액점검', '시스템이 계산한 잔액과 실제 보유액을 비교해 차이를 기록합니다.')}
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

    <div class="fund-balance-check-grid">
      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div><span>SYSTEM</span><h3>시스템 계산 잔액</h3></div>
        </div>
        <div class="fund-balance-check-values">
          <div><span>공용계좌</span><strong>${formatMoney(balance.public)}</strong></div>
          <div><span>회사잔고</span><strong>${formatMoney(balance.company)}</strong></div>
          <div class="is-total"><span>합계</span><strong>${formatMoney(balance.total)}</strong></div>
        </div>
      </section>

      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div><span>CHECK</span><h3>실제 잔액 입력</h3></div>
        </div>
        <form class="fund-balance-check-form" data-balance-check-form>
          <div class="fund-form-grid">
            <label class="fund-field">
              <span>실제 공용계좌</span>
              <input type="number" step="1" name="actual_public" value="${Number(balance.public ?? 0)}" required />
            </label>
            <label class="fund-field">
              <span>실제 회사잔고</span>
              <input type="number" step="1" name="actual_company" value="${Number(balance.company ?? 0)}" required />
            </label>
            <label class="fund-field fund-field--wide">
              <span>점검 메모</span>
              <input name="note" maxlength="300" placeholder="예: 인게임 계좌 확인" />
            </label>
          </div>
          <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>잔액점검 기록</button>
        </form>
      </section>
    </div>

    <section class="fund-section-card">
      <div class="fund-section-card__header">
        <div><span>HISTORY</span><h3>점검 이력</h3></div>
        <p>최근 ${admin.balanceChecks.length}건</p>
      </div>
      <div class="fund-balance-check-list">
        ${admin.balanceChecks.length ? admin.balanceChecks.map(renderCheck).join('') : '<div class="fund-empty-state">아직 잔액점검 기록이 없습니다.</div>'}
      </div>
    </section>
  `;
}

function renderCheck(item) {
  const diffTotal = Number(item.difference_public) + Number(item.difference_company);
  return `
    <article class="fund-balance-check-item">
      <div>
        <strong>${formatDateTime(item.created_at)}</strong>
        <span>${escapeHtml(item.checked_by_name || '관리자')}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span>
      </div>
      <div class="fund-balance-check-item__numbers">
        <span>공용 ${formatDiff(item.difference_public)}</span>
        <span>회사 ${formatDiff(item.difference_company)}</span>
        <b class="${diffTotal === 0 ? 'is-match' : 'is-diff'}">합계 ${formatDiff(diffTotal)}</b>
      </div>
    </article>
  `;
}

function formatDiff(value) {
  const number = Number(value ?? 0);
  if (number === 0) return '일치';
  return `${number > 0 ? '+' : ''}${formatMoney(number)}`;
}
