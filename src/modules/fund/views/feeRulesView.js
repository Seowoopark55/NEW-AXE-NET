import { escapeHtml, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFeeRulesView(state) {
  const { fund } = state;
  const admin = fund.admin;
  const currentFee = Number(fund.summary?.fee ?? 0);
  const period = fund.selectedPeriod;
  const activeRules = admin.feeRules.filter((rule) => rule.enabled);

  return `
    <div class="fund-admin13-page">
      ${renderPageHeader('요율관리', '주간 공금 금액의 적용 시작 시점을 등록하고 운영 이력을 관리합니다.')}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin13-stat-grid fund-admin13-stat-grid--three">
        <div class="fund-admin13-stat is-accent"><span>현재 주간 공금</span><strong>${formatMoney(currentFee)}</strong><small>${period ? `${period.year}년 ${period.month}월 ${period.week}주차 기준` : '현재 기준'}</small></div>
        <div class="fund-admin13-stat"><span>활성 규칙</span><strong>${activeRules.length}개</strong><small>적용 시작일 최신 우선</small></div>
        <div class="fund-admin13-stat"><span>전체 규칙</span><strong>${admin.feeRules.length}개</strong><small>비활성 이력 포함</small></div>
      </div>

      <div class="fund-admin13-split">
        <section class="fund-admin13-panel fund-admin13-panel--form">
          <div class="fund-admin13-panel-head"><div><span>NEW RATE</span><h3>공금 금액 변경 예약</h3><p>지정한 주차부터 새 금액이 적용됩니다.</p></div></div>
          <form class="fund-settings-form" data-fee-rule-form>
            <div class="fund-form-grid">
              <label class="fund-field"><span>시작 연도</span><input type="number" name="start_year" min="2020" max="2100" value="${period?.year ?? new Date().getFullYear()}" required /></label>
              <label class="fund-field"><span>시작 월</span><input type="number" name="start_month" min="1" max="12" value="${period?.month ?? new Date().getMonth() + 1}" required /></label>
              <label class="fund-field"><span>시작 주차</span><input type="number" name="start_week" min="1" max="5" value="${period?.week ?? 1}" required /></label>
              <label class="fund-field"><span>주간 금액</span><input type="number" name="weekly_fee" min="1" step="1" value="${currentFee || 20000}" required /></label>
              <label class="fund-field fund-field--wide"><span>메모</span><input name="note" maxlength="200" placeholder="예: 9월부터 20,000원" /></label>
            </div>
            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>새 요율 등록</button>
          </form>
        </section>

        <section class="fund-admin13-panel">
          <div class="fund-admin13-panel-head"><div><span>RULES</span><h3>요율 적용 이력</h3><p>기본 규칙은 잠겨 있고 추가 규칙은 활성/비활성할 수 있습니다.</p></div></div>
          <div class="fund-admin13-rule-list">
            ${admin.feeRules.length ? admin.feeRules.map(renderRule).join('') : '<div class="fund-empty-state">등록된 요율이 없습니다.</div>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderRule(rule) {
  const base = rule.source_key === 'base_weekly_fee';
  return `
    <article class="fund-admin13-rule ${rule.enabled ? 'is-enabled' : 'is-disabled'}">
      <div class="fund-admin13-rule__date"><b>${rule.start_year}.${String(rule.start_month).padStart(2, '0')}.${rule.start_week}주</b><span>적용 시작</span></div>
      <div class="fund-admin13-rule__body"><strong>${formatMoney(rule.weekly_fee)}</strong><span>${escapeHtml(rule.note || '메모 없음')}</span></div>
      <span class="fund-admin13-state-pill ${rule.enabled ? 'is-ok' : ''}">${rule.enabled ? '활성' : '비활성'}</span>
      ${base
        ? '<span class="fund-lock-pill">기본</span>'
        : `<button class="${rule.enabled ? 'fund-danger-button' : 'fund-secondary-button'} fund-secondary-button--small" type="button" data-toggle-fee-rule="${rule.id}" data-next-enabled="${rule.enabled ? 'false' : 'true'}">${rule.enabled ? '비활성' : '활성'}</button>`}
    </article>
  `;
}
