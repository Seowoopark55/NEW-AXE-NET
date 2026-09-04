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

  const targetRows = [];
  const excludedRows = [];
  const inactiveRows = [];

  rows.forEach((member) => {
    const setting = settings.get(member.member_key);
    if (member.status !== 'active') inactiveRows.push(member);
    else if ((setting?.enabled ?? true) === false) excludedRows.push(member);
    else targetRows.push(member);
  });

  return `
    <div class="fund-admin fund-admin--members">
      ${renderPageHeader('멤버관리', '공금 대상 여부와 개별 기준만 관리합니다. 회원 원본 정보는 멤버 메뉴에서 관리합니다.', renderPeriodSelect(fund.periods, period))}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <section class="fund-admin-panel fund-admin-panel--members">
        <div class="fund-admin-panel__head fund-member-panel-head">
          <div>
            <h3>공금 대상 설정</h3>
            <p>목록은 간단하게 확인하고, 필요한 멤버만 <b>관리</b>를 열어 기준일과 메모를 수정합니다.</p>
          </div>
          <div class="fund-member-summary" aria-label="멤버 상태 요약">
            <span class="is-target"><small>공금 대상</small><b>${targetRows.length}</b></span>
            <span class="is-excluded"><small>제외</small><b>${excludedRows.length}</b></span>
            <span class="is-inactive"><small>비활성</small><b>${inactiveRows.length}</b></span>
          </div>
        </div>

        ${renderMemberGroup('공금 대상', '현재 공금 납부 대상 멤버', targetRows, settings, statusMap, admin.saving, 'target')}
        ${renderMemberGroup('예외 · 제외', '공금 대상에서 개별 제외된 멤버', excludedRows, settings, statusMap, admin.saving, 'excluded')}
        ${renderMemberGroup('비활성 멤버', '퇴사·비활성 등 현재 공금 대상이 아닌 멤버', inactiveRows, settings, statusMap, admin.saving, 'inactive')}
      </section>
    </div>
  `;
}

function renderMemberGroup(title, description, rows, settings, statusMap, saving, tone) {
  if (!rows.length && tone !== 'target') return '';
  return `
    <section class="fund-member-group fund-member-group--${tone}">
      <div class="fund-member-group__head">
        <div><strong>${title}</strong><small>${description}</small></div>
        <b>${rows.length}명</b>
      </div>
      ${rows.length ? `
        <div class="fund-admin-member__columns" aria-hidden="true">
          <span>멤버</span><span>이번 주</span><span>공금 대상</span><span>적용 기준일</span><span>관리</span>
        </div>
        <div class="fund-admin-member-list">
          ${rows.map((member) => renderMember(member, settings.get(member.member_key), statusMap.get(member.nickname), saving)).join('')}
        </div>
      ` : '<div class="fund-member-group__empty">해당 멤버가 없습니다.</div>'}
    </section>
  `;
}

function renderMember(member, setting, status, saving) {
  const memberActive = member.status === 'active';
  const enabled = setting?.enabled ?? true;
  const effectiveDate = setting?.join_date_override || member.joined_date;
  const hasOverride = Boolean(setting?.join_date_override);
  const hasNote = Boolean(String(setting?.note || '').trim());

  return `
    <form class="fund-admin-member ${!memberActive ? 'is-inactive' : ''} ${memberActive && !enabled ? 'is-excluded' : ''}" data-fund-member-setting-form data-member-key="${escapeAttribute(member.member_key)}" data-nickname="${escapeAttribute(member.nickname)}">
      <div class="fund-admin-member__main">
        <div class="fund-admin-member__identity">
          <div class="fund-admin-member__name-line">
            <strong>${escapeHtml(member.nickname)}</strong>
            <span class="fund-admin-member__connection ${member.discord_user_id ? 'is-on' : 'is-off'}" title="${member.discord_user_id ? 'Discord 연결됨' : 'Discord 미연결'}" aria-label="${member.discord_user_id ? 'Discord 연결됨' : 'Discord 미연결'}"></span>
          </div>
          ${(hasOverride || hasNote) ? `<div class="fund-admin-member__flags">${hasOverride ? '<span>기준일 보정</span>' : ''}${hasNote ? '<span>메모</span>' : ''}</div>` : ''}
        </div>
        <div class="fund-admin-member__status">${status ? renderStatusBadge(status.status) : '<span class="fund-member-status-empty">—</span>'}</div>
        <label class="fund-admin-switch">
          <input type="checkbox" name="enabled" ${enabled ? 'checked' : ''} ${!memberActive ? 'disabled' : ''} />
          <span></span><b>${memberActive ? (enabled ? '대상' : '제외') : '비활성'}</b>
        </label>
        <div class="fund-admin-member__date" title="${hasOverride ? `원 가입일 ${formatDate(member.joined_date)}` : '가입일 기준'}">
          <b>${formatDate(effectiveDate)}</b>
          ${hasOverride ? '<small>보정</small>' : ''}
        </div>
        <div class="fund-admin-member__manage">
          <button class="fund-admin-member__manage-button" type="button" data-fund-member-manage-toggle aria-expanded="false">관리</button>
        </div>
        <div class="fund-admin-member__editor-wrap" data-fund-member-editor hidden>
          <div class="fund-admin-member__editor">
            <div class="fund-admin-member__editor-head">
              <div><strong>${escapeHtml(member.nickname)}</strong><span>개별 공금 설정</span></div>
              <small>기본 가입일 ${formatDate(member.joined_date)}</small>
            </div>
            <label class="fund-field"><span>공금 기준일 보정</span><input type="date" name="join_date_override" value="${escapeAttribute(setting?.join_date_override || '')}" ${!memberActive ? 'disabled' : ''} /><small>비워두면 기본 가입일을 사용합니다.</small></label>
            <label class="fund-field fund-field--member-note"><span>운영 메모</span><input name="note" maxlength="200" value="${escapeAttribute(setting?.note || '')}" placeholder="필요한 경우만 입력" ${!memberActive ? 'disabled' : ''} /></label>
            <button class="fund-secondary-button fund-secondary-button--small" type="submit" ${!memberActive || saving ? 'disabled' : ''}>저장</button>
          </div>
        </div>
      </div>
    </form>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `<label class="fund-settings-period"><span>조회 주차</span><select data-settings-period>${periods.map((item) => { const value = `${item.year}-${item.month}-${item.week}`; return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`; }).join('')}</select></label>`;
}
