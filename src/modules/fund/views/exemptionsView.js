import { escapeAttribute, escapeHtml, formatDateTime, formatPeriodLabel } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderExemptionsView(state) {
  const { fund, members } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = members.items.filter((member) => member.status === 'active');

  return `
    <div class="fund-admin">
      ${renderPageHeader('면제관리', '특정 멤버의 특정 주차만 납부 대상에서 제외합니다.', renderPeriodSelect(fund.periods, period))}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin-metrics">
        ${metric('관리 주차', period ? `${period.month}월 ${period.week}주차` : '—', period ? `${period.year}년` : '', 'primary')}
        ${metric('현재 면제', `${admin.exemptions.length}명`, '선택 주차 기준')}
        ${metric('활동 멤버', `${activeMembers.length}명`, '멤버 목록 기준')}
      </div>

      <div class="fund-admin-split fund-admin-split--narrow-left">
        <section class="fund-admin-panel fund-admin-panel--form">
          ${panelHead('ADD EXEMPTION', `${formatPeriodLabel(period)} 면제`, '등록 즉시 월별현황과 미납 판정에 반영됩니다.')}
          <form class="fund-settings-form" data-exemption-form>
            <label class="fund-field"><span>멤버</span><select name="member_key" required><option value="">선택</option>${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}</select></label>
            <label class="fund-field"><span>사유</span><input name="reason" maxlength="200" placeholder="예: 장기 부재" /></label>
            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>면제 등록</button>
          </form>
        </section>
        <section class="fund-admin-panel">
          ${panelHead('ACTIVE', '현재 면제 목록', `${admin.exemptions.length}명`, true)}
          <div class="fund-admin-exemption-list">${admin.exemptions.length ? admin.exemptions.map(renderExemption).join('') : '<div class="fund-empty-state">이 주차에 활성 면제가 없습니다.</div>'}</div>
        </section>
      </div>
    </div>
  `;
}
function renderExemption(item){ return `<article class="fund-admin-exemption"><div><strong>${escapeHtml(item.nickname || '멤버')}</strong><span>${escapeHtml(item.reason || '사유 없음')}</span></div><small>${escapeHtml(item.created_by || '관리자')} · ${formatDateTime(item.created_at)}</small><button class="fund-danger-button fund-secondary-button--small" type="button" data-disable-exemption="${item.id}">면제 해제</button></article>`; }
function metric(label,value,note,tone=''){ return `<div class="fund-admin-metric ${tone ? `is-${tone}` : ''}"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`; }
function panelHead(overline,title,desc,countMode=false){ return `<div class="fund-admin-panel__head ${countMode ? 'is-row' : ''}"><div><span>${overline}</span><h3>${title}</h3>${countMode ? '' : `<p>${desc}</p>`}</div>${countMode ? `<b>${desc}</b>` : ''}</div>`; }
function renderPeriodSelect(periods, selected){ const selectedValue=selected?`${selected.year}-${selected.month}-${selected.week}`:''; return `<label class="fund-settings-period"><span>관리 주차</span><select data-settings-period>${periods.map((item)=>{const value=`${item.year}-${item.month}-${item.week}`;return `<option value="${value}" ${value===selectedValue?'selected':''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`;}).join('')}</select></label>`; }
