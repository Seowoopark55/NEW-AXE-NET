import {
  escapeAttribute,
  escapeHtml,
  formatDateTime,
  formatPeriodLabel,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderExemptionsView(state) {
  const { fund, members } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = members.items.filter((member) => member.status === 'active');

  return `
    <div class="fund-admin13-page">
      ${renderPageHeader('면제관리', '특정 멤버의 특정 주차만 납부 대상에서 제외합니다.', renderPeriodSelect(fund.periods, period))}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin13-stat-grid fund-admin13-stat-grid--three">
        <div class="fund-admin13-stat is-accent"><span>관리 주차</span><strong>${period ? `${period.month}월 ${period.week}주차` : '—'}</strong><small>${period ? period.year : ''}</small></div>
        <div class="fund-admin13-stat"><span>현재 면제</span><strong>${admin.exemptions.length}명</strong><small>선택 주차 활성 기준</small></div>
        <div class="fund-admin13-stat"><span>활동 멤버</span><strong>${activeMembers.length}명</strong><small>멤버 목록 기준</small></div>
      </div>

      <div class="fund-admin13-split fund-admin13-split--compact-left">
        <section class="fund-admin13-panel fund-admin13-panel--form">
          <div class="fund-admin13-panel-head"><div><span>ADD EXEMPTION</span><h3>${formatPeriodLabel(period)} 면제</h3><p>등록 즉시 월별현황과 미납 판정에 반영됩니다.</p></div></div>
          <form class="fund-settings-form" data-exemption-form>
            <label class="fund-field"><span>멤버</span><select name="member_key" required><option value="">선택</option>${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}</select></label>
            <label class="fund-field"><span>사유</span><input name="reason" maxlength="200" placeholder="예: 장기 부재" /></label>
            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>면제 등록</button>
          </form>
        </section>

        <section class="fund-admin13-panel">
          <div class="fund-admin13-panel-head fund-admin13-panel-head--row"><div><span>ACTIVE</span><h3>현재 면제 목록</h3></div><b>${admin.exemptions.length}명</b></div>
          <div class="fund-admin13-exemption-list">
            ${admin.exemptions.length ? admin.exemptions.map(renderExemption).join('') : '<div class="fund-empty-state">이 주차에 활성 면제가 없습니다.</div>'}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderExemption(item) {
  return `
    <article class="fund-admin13-exemption-row">
      <div><strong>${escapeHtml(item.nickname || '멤버')}</strong><span>${escapeHtml(item.reason || '사유 없음')}</span></div>
      <small>${escapeHtml(item.created_by || '관리자')} · ${formatDateTime(item.created_at)}</small>
      <button class="fund-danger-button fund-secondary-button--small" type="button" data-disable-exemption="${item.id}">면제 해제</button>
    </article>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `<label class="fund-settings-period"><span>관리 주차</span><select data-settings-period>${periods.map((item) => { const value = `${item.year}-${item.month}-${item.week}`; return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`; }).join('')}</select></label>`;
}
