import { escapeHtml, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFeeRulesView(state) {
  const { fund } = state;
  const admin = fund.admin;
  const currentFee = Number(fund.summary?.fee ?? 0);
  const period = fund.selectedPeriod;

  return `
    <div class="fund-admin fund-admin--rules-view">
      ${renderPageHeader('요율관리', `현재 주간 공금 ${formatMoney(currentFee)} · 적용 시작 주차를 등록하고 이력을 관리합니다.`)}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="fund-admin-panel fund-admin-panel--form fund-admin-panel--rule-form">
        ${panelHead('공금 금액 변경', '지정한 주차부터 새 금액이 적용됩니다.')}
        <form class="fund-admin-inline-form" data-fee-rule-form>
          <div class="fund-form-grid">
            <label class="fund-field"><span>연도</span><input type="number" name="start_year" min="2020" max="2100" value="${period?.year ?? new Date().getFullYear()}" required /></label>
            <label class="fund-field"><span>월</span><input type="number" name="start_month" min="1" max="12" value="${period?.month ?? new Date().getMonth() + 1}" required /></label>
            <label class="fund-field"><span>주차</span><input type="number" name="start_week" min="1" max="5" value="${period?.week ?? 1}" required /></label>
            <label class="fund-field"><span>주간 금액</span><input type="number" name="weekly_fee" min="1" step="1" value="${currentFee || 20000}" required /></label>
            <label class="fund-field fund-field--wide"><span>메모</span><input name="note" maxlength="200" placeholder="예: 9월부터 20,000원" /></label>
          </div>
          <div class="fund-admin-inline-form__actions"><button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>새 요율 등록</button></div>
        </form>
      </section>

      <section class="fund-admin-panel fund-admin-panel--rule-history">
        ${panelHead('요율 적용 이력', '기본 규칙은 잠겨 있고 추가 규칙은 활성/비활성할 수 있습니다.', `${admin.feeRules.length}개`)}
        <div class="fund-admin-rule-list">${admin.feeRules.length ? admin.feeRules.map(renderRule).join('') : '<div class="fund-empty-state">등록된 요율이 없습니다.</div>'}</div>
      </section>
    </div>
  `;
}

function renderRule(rule) {
  const base = rule.source_key === 'base_weekly_fee';
  return `<article class="fund-admin-rule ${rule.enabled ? '' : 'is-disabled'}"><div><b>${rule.start_year}.${String(rule.start_month).padStart(2, '0')}.${rule.start_week}주</b><span>적용 시작</span></div><div><strong>${formatMoney(rule.weekly_fee)}</strong><span>${escapeHtml(rule.note || '메모 없음')}</span></div><span class="fund-admin-state ${rule.enabled ? 'is-ok' : ''}">${rule.enabled ? '활성' : '비활성'}</span>${base ? '<span class="fund-lock-pill">기본</span>' : `<button class="${rule.enabled ? 'fund-danger-button' : 'fund-secondary-button'} fund-secondary-button--small" type="button" data-toggle-fee-rule="${rule.id}" data-next-enabled="${rule.enabled ? 'false' : 'true'}">${rule.enabled ? '비활성' : '활성'}</button>`}</article>`;
}

function panelHead(title, desc, count = '') {
  return `<div class="fund-admin-panel__head is-row"><div><h3>${title}</h3><p>${desc}</p></div>${count ? `<b>${count}</b>` : ''}</div>`;
}
