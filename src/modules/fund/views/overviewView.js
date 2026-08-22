import {
  escapeHtml,
  formatDate,
  formatMoney,
  formatMonthLabel,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderOverviewView(state) {
  const fund = state.fund;
  const matrix = fund.monthMatrix ?? { weeks: [], members: [] };
  const weeks = matrix.weeks ?? [];
  const members = matrix.members ?? [];

  return `
    ${renderPageHeader(
      '월별현황',
      '월별 공금표에서 멤버별 납부·검수·면제 상태를 한 번에 확인합니다.',
      renderMonthPicker(fund.selectedMonth),
    )}

    <section class="fund-legacy-panel">
      <div class="fund-legacy-panel__head">
        <div>
          <h3>${formatMonthLabel(fund.selectedMonth)} 공금 현황</h3>
          <p>회차는 일요일~토요일 기준이며 토요일이 속한 달을 표시 월로 사용합니다.</p>
        </div>
        <div class="fund-status-legend">
          <span><i class="done"></i>완료</span>
          <span><i class="pending"></i>검수대기</span>
          <span><i class="unpaid"></i>미납</span>
          <span><i class="exempt"></i>면제</span>
        </div>
      </div>

      <div class="fund-matrix-wrap">
        <table class="fund-matrix">
          <thead>
            <tr>
              <th class="left">멤버</th>
              ${weeks.map((week) => `
                <th>
                  <strong>${week.week}주차</strong>
                  <small>${shortRange(week.period_start, week.period_end)}</small>
                </th>
              `).join('')}
              <th>미납</th>
            </tr>
          </thead>
          <tbody>
            ${members.length
              ? members.map((member) => renderMemberRow(member, weeks)).join('')
              : `<tr><td colspan="${weeks.length + 2}" class="fund-empty-state">공금 대상 멤버가 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderMemberRow(member, weeks) {
  const cellMap = new Map((member.cells ?? []).map((cell) => [Number(cell.week), cell]));
  return `
    <tr>
      <td class="left">
        <strong>${escapeHtml(member.nickname)}</strong>
        <small>${member.join_date ? `가입 ${formatDate(member.join_date)}` : ''}</small>
      </td>
      ${weeks.map((week) => {
        const cell = cellMap.get(Number(week.week));
        return `<td>${renderMatrixStatus(cell)}</td>`;
      }).join('')}
      <td class="fund-matrix__unpaid">
        <strong>${Number(member.unpaid_count ?? 0)}</strong>
      </td>
    </tr>
  `;
}

function renderMatrixStatus(cell) {
  if (!cell) return '<span class="fund-matrix-status muted">—</span>';
  const cls = statusClass(cell.status);
  const amount = ['미납', '검수대기'].includes(cell.status)
    ? `<small>${formatMoney(cell.weekly_fee ?? cell.amount)}</small>`
    : '';
  return `
    <span class="fund-matrix-status ${cls}">
      <b>${escapeHtml(cell.status)}</b>
      ${amount}
    </span>
  `;
}

function statusClass(status) {
  if (status === '완료') return 'done';
  if (status === '검수대기') return 'pending';
  if (status === '미납') return 'unpaid';
  if (status === '면제') return 'exempt';
  if (status === '예정') return 'future';
  return 'muted';
}

function renderMonthPicker(month) {
  if (!month) return '';
  return `
    <div class="fund-month-toolbar">
      <button type="button" data-fund-month-shift="-1">‹</button>
      <strong>${month.year}년 ${month.month}월</strong>
      <button type="button" data-fund-month-shift="1">›</button>
    </div>
  `;
}

function shortRange(start, end) {
  if (!start || !end) return '';
  return `${String(start).slice(5).replace('-', '.')}~${String(end).slice(5).replace('-', '.')}`;
}
