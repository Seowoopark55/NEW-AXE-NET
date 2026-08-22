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
    ${renderPageHeader(
      '면제관리',
      '선택한 주차의 공금 면제를 등록·해제합니다.',
      renderPeriodSelect(fund.periods, period),
    )}
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

    <section class="fund-form-card">
      <div class="fund-form-card__head">
        <div><h3>${formatPeriodLabel(period)} 면제 등록</h3><p>면제는 해당 주차에만 적용됩니다.</p></div>
      </div>
      <form class="fund-settings-form" data-exemption-form>
        <div class="fund-form-grid">
          <label class="fund-field">
            <span>멤버</span>
            <select name="member_key" required>
              <option value="">선택</option>
              ${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}
            </select>
          </label>
          <label class="fund-field"><span>사유</span><input name="reason" maxlength="200" placeholder="면제 사유" /></label>
        </div>
        <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>면제 등록</button>
      </form>
    </section>

    <section class="fund-legacy-panel">
      <div class="fund-legacy-panel__head">
        <div><h3>현재 면제 목록</h3><p>${formatPeriodLabel(period)}</p></div>
      </div>
      <div class="fund-exemption-list">
        ${admin.exemptions.length ? admin.exemptions.map(renderExemption).join('') : '<div class="fund-empty-state">이 주차에 활성 면제가 없습니다.</div>'}
      </div>
    </section>
  `;
}

function renderExemption(item) {
  return `
    <article class="fund-exemption-item">
      <div>
        <strong>${escapeHtml(item.nickname || '멤버')}</strong>
        <span>${escapeHtml(item.reason || '사유 없음')} · ${escapeHtml(item.created_by || '관리자')} · ${formatDateTime(item.created_at)}</span>
      </div>
      <button class="fund-danger-button fund-secondary-button--small" type="button" data-disable-exemption="${item.id}">면제 해제</button>
    </article>
  `;
}

function renderPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `
    <label class="fund-settings-period">
      <span>관리 주차</span>
      <select data-settings-period>
        ${periods.map((item) => {
          const value = `${item.year}-${item.month}-${item.week}`;
          return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`;
        }).join('')}
      </select>
    </label>
  `;
}
