import {
  escapeHtml,
  formatMoney,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFeeRulesView(state) {
  const { fund } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;

  return `
    ${renderPageHeader(
      '요율관리',
      '주간 공금 금액과 적용 시작 주차를 관리합니다.',
    )}
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

    <section class="fund-form-card">
      <div class="fund-form-card__head">
        <div>
          <h3>주간 공금 요율</h3>
          <p>현재 선택 주차 기준 ${formatMoney(fund.summary?.fee)}</p>
        </div>
      </div>

      <form class="fund-settings-form" data-fee-rule-form>
        <div class="fund-form-grid fund-form-grid--four">
          <label class="fund-field"><span>시작 연도</span><input type="number" name="start_year" value="${period?.year ?? new Date().getFullYear()}" min="2020" max="2100" required /></label>
          <label class="fund-field"><span>월</span><input type="number" name="start_month" value="${period?.month ?? new Date().getMonth()+1}" min="1" max="12" required /></label>
          <label class="fund-field"><span>주차</span><input type="number" name="start_week" value="${period?.week ?? 1}" min="1" max="5" required /></label>
          <label class="fund-field"><span>금액</span><input type="number" name="weekly_fee" value="${Number(fund.summary?.fee ?? 20000)}" min="0" step="1" required /></label>
          <label class="fund-field fund-field--wide"><span>메모</span><input name="note" maxlength="200" placeholder="변경 사유" /></label>
        </div>
        <div class="fund-info-box">기존 규칙을 덮어쓰지 않고 적용 시작 주차가 다른 새 규칙으로 기록합니다.</div>
        <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>새 요율 적용</button>
      </form>
    </section>

    <section class="fund-legacy-panel">
      <div class="fund-legacy-panel__head">
        <div><h3>요율 이력</h3><p>적용 시작 시점이 최신인 규칙이 우선 적용됩니다.</p></div>
      </div>
      <div class="fund-rule-list">
        ${admin.feeRules.length ? admin.feeRules.map(renderRule).join('') : '<div class="fund-empty-state">등록된 요율이 없습니다.</div>'}
      </div>
    </section>
  `;
}

function renderRule(rule) {
  const base = rule.source_key === 'base_weekly_fee';
  return `
    <article class="fund-rule-item">
      <div>
        <strong>${rule.start_year}년 ${rule.start_month}월 ${rule.start_week}주차부터 · ${formatMoney(rule.weekly_fee)}</strong>
        <span>${escapeHtml(rule.note || '메모 없음')} · ${rule.enabled ? '활성' : '비활성'}</span>
      </div>
      ${base
        ? '<span class="fund-lock-pill">기본</span>'
        : `<button class="${rule.enabled ? 'fund-danger-button' : 'fund-secondary-button'} fund-secondary-button--small" type="button" data-toggle-fee-rule="${rule.id}" data-next-enabled="${rule.enabled ? 'false' : 'true'}">${rule.enabled ? '비활성' : '활성'}</button>`}
    </article>
  `;
}
