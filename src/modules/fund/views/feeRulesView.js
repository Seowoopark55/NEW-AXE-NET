import { escapeHtml, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFeeRulesView(state) {
  const { fund } = state;
  const admin = fund.admin;
  const currentFee = Number(fund.summary?.fee ?? 0);
  const period = fund.selectedPeriod;
  const activeRules = admin.feeRules.filter((rule) => rule.enabled);

  return `
    <div class="fund-admin">
      ${renderPageHeader('요율관리', '주간 공금 금액의 적용 시작 시점을 등록하고 이력을 관리합니다.')}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin-metrics">
        ${metric('현재 주간 공금', formatMoney(currentFee), period ? `${period.month}월 ${period.week}주차 기준` : '현재 기준', 'primary')}
        ${metric('활성 규칙', `${activeRules.length}개`, '최신 적용 시작일 우선')}
        ${metric('전체 규칙', `${admin.feeRules.length}개`, '비활성 이력 포함')}
      </div>

      <div class="fund-admin-split">
        <section class="fund-admin-panel fund-admin-panel--form">
          ${panelHead('NEW RATE', '공금 금액 변경 예약', '지정한 주차부터 새 금액이 적용됩니다.')}
          <form class="fund-settings-form" data-fee-rule-form>
            <div class="fund-form-grid">
              <label class="fund-field"><span>연도</span><input type="number" name="start_year" min="2020" max="2100" value="${period?.year ?? new Date().getFullYear()}" required /></label>
              <label class="fund-field"><span>월</span><input type="number" name="start_month" min="1" max="12" value="${period?.month ?? new Date().getMonth() + 1}" required /></label>
              <label class="fund-field"><span>주차</span><input type="number" name="start_week" min="1" max="5" value="${period?.week ?? 1}" required /></label>
              <label class="fund-field"><span>주간 금액</span><input type="number" name="weekly_fee" min="1" step="1" value="${currentFee || 20000}" required /></label>
              <label class="fund-field fund-field--wide"><span>메모</span><input name="note" maxlength="200" placeholder="예: 9월부터 20,000원" /></label>
            </div>
            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>새 요율 등록</button>
          </form>
        </section>
        <section class="fund-admin-panel">
          ${panelHead('RULES', '요율 적용 이력', '기본 규칙은 잠겨 있고 추가 규칙은 활성/비활성할 수 있습니다.')}
          <div class="fund-admin-rule-list">${admin.feeRules.length ? admin.feeRules.map(renderRule).join('') : '<div class="fund-empty-state">등록된 요율이 없습니다.</div>'}</div>
        </section>
      </div>
    </div>
  `;
}

function renderRule(rule) {
  const base = rule.source_key === 'base_weekly_fee';
  return `<article class="fund-admin-rule ${rule.enabled ? '' : 'is-disabled'}"><div><b>${rule.start_year}.${String(rule.start_month).padStart(2, '0')}.${rule.start_week}주</b><span>적용 시작</span></div><div><strong>${formatMoney(rule.weekly_fee)}</strong><span>${escapeHtml(rule.note || '메모 없음')}</span></div><span class="fund-admin-state ${rule.enabled ? 'is-ok' : ''}">${rule.enabled ? '활성' : '비활성'}</span>${base ? '<span class="fund-lock-pill">기본</span>' : `<button class="${rule.enabled ? 'fund-danger-button' : 'fund-secondary-button'} fund-secondary-button--small" type="button" data-toggle-fee-rule="${rule.id}" data-next-enabled="${rule.enabled ? 'false' : 'true'}">${rule.enabled ? '비활성' : '활성'}</button>`}</article>`;
}
function metric(label, value, note, tone=''){ return `<div class="fund-admin-metric ${tone ? `is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`; }
function panelHead(overline,title,desc){ return `<div class="fund-admin-panel__head"><div><span>${overline}</span><h3>${title}</h3><p>${desc}</p></div></div>`; }
