import {
  escapeAttribute,
  escapeHtml,
  formatDate,
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

  return `
    <div class="fund-admin fund-admin--medium">
      ${renderPageHeader('멤버관리', '공금 대상 여부와 예외 기준만 관리합니다. 회원 원본 정보는 멤버 메뉴에서 관리합니다.', renderPeriodSelect(fund.periods, period))}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="fund-admin-panel fund-admin-panel--members">
        <div class="fund-admin-panel__head is-row"><div><h3>공금 대상 설정</h3><p>예외가 필요한 멤버만 설정을 펼쳐 기준일과 메모를 수정합니다.</p></div><b>${rows.length}명</b></div>
        <div class="fund-admin-member-list">
          ${rows.map((member) => renderMember(member, settings.get(member.member_key), statusMap.get(member.nickname), admin.saving)).join('')}
        </div>
      </section>
    </div>
  `;
}

function renderMember(member, setting, status, saving) {
  const memberActive = member.status === 'active';
  const enabled = setting?.enabled ?? true;
  const effectiveDate = setting?.join_date_override || member.joined_date;
  const needsAttention = Boolean(setting?.join_date_override || setting?.note || !enabled);
  return `
    <form class="fund-admin-member ${!memberActive ? 'is-inactive' : ''} ${memberActive && !enabled ? 'is-excluded' : ''}" data-fund-member-setting-form data-member-key="${escapeAttribute(member.member_key)}" data-nickname="${escapeAttribute(member.nickname)}">
      <div class="fund-admin-member__main">
        <div class="fund-admin-member__identity">
          <strong>${escapeHtml(member.nickname)}</strong>
          <span>${member.discord_user_id ? 'Discord 연결' : 'Discord 미연결'}</span>
        </div>
        <label class="fund-admin-switch">
          <input type="checkbox" name="enabled" ${enabled ? 'checked' : ''} ${!memberActive ? 'disabled' : ''} />
          <span></span><b>${memberActive ? (enabled ? '대상' : '제외') : '비활성'}</b>
        </label>
        <div class="fund-admin-member__date"><span>가입일</span><b>${formatDate(member.joined_date)}</b></div>
        <div class="fund-admin-member__status">${status ? renderStatusBadge(status.status) : '<span>—</span>'}</div>
        <details class="fund-admin-member__details" ${needsAttention ? 'open' : ''}>
          <summary>설정</summary>
          <div class="fund-admin-member__editor">
            <label class="fund-field"><span>공금 기준일 보정</span><input type="date" name="join_date_override" value="${escapeAttribute(setting?.join_date_override || '')}" ${!memberActive ? 'disabled' : ''} /><small>현재 적용 ${formatDate(effectiveDate)}</small></label>
            <label class="fund-field"><span>운영 메모</span><input name="note" maxlength="200" value="${escapeAttribute(setting?.note || '')}" placeholder="선택" ${!memberActive ? 'disabled' : ''} /></label>
            <button class="fund-secondary-button fund-secondary-button--small" type="submit" ${!memberActive || saving ? 'disabled' : ''}>저장</button>
          </div>
        </details>
      </div>
    </form>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `<label class="fund-settings-period"><span>조회 주차</span><select data-settings-period>${periods.map((item) => { const value = `${item.year}-${item.month}-${item.week}`; return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`; }).join('')}</select></label>`;
}
