import {
  escapeHtml,
  formatDate,
  formatPeriodLabel,
  renderStatusBadge,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderFundMembersView(state) {
  const { fund, members } = state;
  const period = fund.selectedPeriod;
  const active = members.items.filter((member) => member.status === 'active');
  const statusMap = new Map((fund.statusItems ?? []).map((item) => [item.nickname, item]));

  return `
    ${renderPageHeader(
      '멤버관리',
      '공금 대상 멤버와 가입일·Discord 연결·선택 주차 상태를 확인합니다.',
      renderPeriodSelect(fund.periods, period),
    )}

    <div class="fund-info-box">
      NEW AXE NET에서는 현재 멤버 상태가 <strong>활동</strong>인 사람을 공금 기본 대상으로 사용합니다.
      멤버 추가·퇴사·Discord 연결 정보 자체는 멤버 모듈에서 관리합니다.
    </div>

    <section class="fund-legacy-panel">
      <div class="fund-legacy-panel__head">
        <div><h3>공금 대상 멤버</h3><p>${active.length}명 · ${formatPeriodLabel(period)}</p></div>
      </div>

      <div class="fund-member-admin-table-wrap">
        <table class="fund-member-admin-table">
          <thead>
            <tr>
              <th>순번</th>
              <th class="left">닉네임</th>
              <th>가입일</th>
              <th>Discord</th>
              <th>현재 상태</th>
            </tr>
          </thead>
          <tbody>
            ${active.map((member, index) => {
              const status = statusMap.get(member.nickname);
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td class="left"><strong>${escapeHtml(member.nickname)}</strong></td>
                  <td>${formatDate(member.joined_date)}</td>
                  <td>${member.discord_user_id ? '연결' : '미연결'}</td>
                  <td>${status ? renderStatusBadge(status.status) : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `
    <label class="fund-settings-period">
      <span>조회 주차</span>
      <select data-settings-period>
        ${periods.map((item) => {
          const value = `${item.year}-${item.month}-${item.week}`;
          return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`;
        }).join('')}
      </select>
    </label>
  `;
}
