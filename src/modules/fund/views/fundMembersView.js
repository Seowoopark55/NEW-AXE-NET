import {
  escapeAttribute,
  escapeHtml,
  formatDate,
  formatPeriodLabel,
  renderStatusBadge,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFundMembersView(state) {
  const { fund, members } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const settings = new Map((admin.fundMemberSettings ?? []).map((item) => [item.member_key, item]));
  const statusMap = new Map((fund.statusItems ?? []).map((item) => [item.nickname, item]));
  const rows = members.items.slice().sort((a, b) => Number(a.sort_order ?? 9999) - Number(b.sort_order ?? 9999));
  const included = rows.filter((member) => member.status === 'active' && (settings.get(member.member_key)?.enabled ?? true)).length;
  const excluded = rows.filter((member) => member.status === 'active' && !(settings.get(member.member_key)?.enabled ?? true)).length;

  return `
    <div class="fund-admin13-page">
      ${renderPageHeader('멤버관리', '회원 정보는 하나만 유지하고, 공금 대상 여부·공금 기준 가입일·운영 메모만 별도로 관리합니다.', renderPeriodSelect(fund.periods, period))}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin13-stat-grid fund-admin13-stat-grid--three">
        <div class="fund-admin13-stat is-accent"><span>공금 대상</span><strong>${included}명</strong><small>활동 + 공금 포함</small></div>
        <div class="fund-admin13-stat"><span>공금 제외</span><strong>${excluded}명</strong><small>활동 멤버 중 수동 제외</small></div>
        <div class="fund-admin13-stat"><span>선택 주차</span><strong>${period ? `${period.month}월 ${period.week}주차` : '—'}</strong><small>${formatPeriodLabel(period)}</small></div>
      </div>

      <div class="fund-admin13-member-note">
        멤버의 닉네임·퇴사·Discord 연결은 <strong>멤버</strong> 메뉴에서 관리합니다. 여기서는 공금 계산에 필요한 예외 설정만 관리합니다.
      </div>

      <section class="fund-admin13-panel">
        <div class="fund-admin13-panel-head fund-admin13-panel-head--row"><div><span>FUND MEMBERS</span><h3>공금 대상 설정</h3><p>가입일 보정은 실제 회원 가입일을 바꾸지 않고 공금 계산에만 사용됩니다.</p></div><b>${rows.length}명</b></div>
        <div class="fund-admin13-member-list">
          ${rows.map((member) => renderMember(member, settings.get(member.member_key), statusMap.get(member.nickname), period, admin.saving)).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderMember(member, setting, status, period, saving) {
  const memberActive = member.status === 'active';
  const enabled = setting?.enabled ?? true;
  const effectiveDate = setting?.join_date_override || member.joined_date;
  return `
    <form class="fund-admin13-member-row ${!memberActive ? 'is-inactive' : ''} ${memberActive && !enabled ? 'is-excluded' : ''}" data-fund-member-setting-form data-member-key="${escapeAttribute(member.member_key)}" data-nickname="${escapeAttribute(member.nickname)}">
      <div class="fund-admin13-member-ident">
        <strong>${escapeHtml(member.nickname)}</strong>
        <span>${member.discord_user_id ? 'Discord 연결' : 'Discord 미연결'} · 회원 ${memberActive ? '활동' : escapeHtml(member.status || '비활성')}</span>
      </div>
      <label class="fund-admin13-switch">
        <input type="checkbox" name="enabled" ${enabled ? 'checked' : ''} ${!memberActive ? 'disabled' : ''} />
        <span></span><b>${memberActive ? (enabled ? '공금 대상' : '공금 제외') : '회원 비활성'}</b>
      </label>
      <div class="fund-admin13-member-date">
        <span>회원 가입일</span><b>${formatDate(member.joined_date)}</b>
      </div>
      <label class="fund-admin13-member-field"><span>공금 기준일 보정</span><input type="date" name="join_date_override" value="${escapeAttribute(setting?.join_date_override || '')}" ${!memberActive ? 'disabled' : ''} /><small>현재 ${formatDate(effectiveDate)}</small></label>
      <label class="fund-admin13-member-field fund-admin13-member-field--note"><span>운영 메모</span><input name="note" maxlength="200" value="${escapeAttribute(setting?.note || '')}" placeholder="선택" ${!memberActive ? 'disabled' : ''} /></label>
      <div class="fund-admin13-member-status">${status ? renderStatusBadge(status.status) : '<span>—</span>'}<small>${formatPeriodLabel(period)}</small></div>
      <button class="fund-secondary-button fund-secondary-button--small" type="submit" ${!memberActive || saving ? 'disabled' : ''}>저장</button>
    </form>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `<label class="fund-settings-period"><span>조회 주차</span><select data-settings-period>${periods.map((item) => { const value = `${item.year}-${item.month}-${item.week}`; return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`; }).join('')}</select></label>`;
}
