import {
  escapeAttribute,
  escapeHtml,
  formatDateTime,
  formatMoney,
  formatPeriodLabel,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderSettingsView(state) {
  const { fund, members } = state;
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = members.items.filter((member) => member.status === 'active');

  return `
    ${renderPageHeader(
      '공금설정',
      '주간 공금 금액과 면제 등 운영 규칙을 관리합니다.',
      renderSettingsPeriodSelect(fund.periods, period),
    )}
    ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
    ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

    <div class="fund-settings-grid">
      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div><span>WEEKLY FEE</span><h3>주간 공금 설정</h3></div>
          <p>현재 ${formatMoney(fund.summary?.fee)}</p>
        </div>

        <form class="fund-settings-form" data-fee-rule-form>
          <div class="fund-form-grid fund-form-grid--four">
            <label class="fund-field"><span>시작 연도</span><input type="number" name="start_year" value="${period?.year ?? new Date().getFullYear()}" min="2020" max="2100" required /></label>
            <label class="fund-field"><span>월</span><input type="number" name="start_month" value="${period?.month ?? new Date().getMonth()+1}" min="1" max="12" required /></label>
            <label class="fund-field"><span>주차</span><input type="number" name="start_week" value="${period?.week ?? 1}" min="1" max="5" required /></label>
            <label class="fund-field"><span>금액</span><input type="number" name="weekly_fee" value="${Number(fund.summary?.fee ?? 20000)}" min="0" step="1" required /></label>
            <label class="fund-field fund-field--wide"><span>메모</span><input name="note" maxlength="200" placeholder="변경 사유" /></label>
          </div>
          <div class="fund-info-box">기존 값을 덮어쓰지 않고 적용 시작 주차가 다른 새 규칙으로 기록합니다.</div>
          <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>새 공금 금액 적용</button>
        </form>

        <div class="fund-rule-list">
          ${admin.feeRules.length ? admin.feeRules.map(renderRule).join('') : '<div class="fund-empty-state">등록된 규칙이 없습니다.</div>'}
        </div>
      </section>

      <section class="fund-section-card">
        <div class="fund-section-card__header">
          <div><span>EXEMPTION</span><h3>면제관리</h3></div>
          <p>${formatPeriodLabel(period)}</p>
        </div>

        <form class="fund-settings-form" data-exemption-form>
          <label class="fund-field">
            <span>멤버</span>
            <select name="member_key" required>
              <option value="">선택</option>
              ${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}
            </select>
          </label>
          <label class="fund-field"><span>사유</span><input name="reason" maxlength="200" placeholder="면제 사유" /></label>
          <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>이 주차 면제 등록</button>
        </form>

        <div class="fund-exemption-list">
          ${admin.exemptions.length ? admin.exemptions.map(renderExemption).join('') : '<div class="fund-empty-state">이 주차에 활성 면제가 없습니다.</div>'}
        </div>
      </section>
    </div>

    <section class="fund-section-card">
      <div class="fund-section-card__header">
        <div><span>TARGET</span><h3>납부 대상 기준</h3></div>
      </div>
      <div class="fund-setting-explain">
        <div><strong>활동 멤버</strong><span>멤버 상태가 활동인 사람을 기본 대상으로 사용합니다.</span></div>
        <div><strong>가입일</strong><span>가입일보다 이전 주차는 자동으로 가입 전 처리합니다.</span></div>
        <div><strong>면제</strong><span>특정 주차에 면제를 등록하면 해당 주차는 면제로 계산합니다.</span></div>
      </div>
    </section>
  `;
}

function renderRule(rule) {
  const base = rule.source_key === 'base_weekly_fee';
  return `
    <article class="fund-rule-item">
      <div>
        <strong>${rule.start_year}년 ${rule.start_month}월 ${rule.start_week}주차부터 · ${formatMoney(rule.weekly_fee)}</strong>
        <span>${escapeHtml(rule.note || '메모 없음')} · ${rule.enabled ? '활성' : '비활성'}</span>
      </div>
      ${base
        ? '<span class="fund-lock-pill">기본</span>'
        : `<button class="${rule.enabled ? 'fund-danger-button' : 'fund-secondary-button'} fund-secondary-button--small" type="button" data-toggle-fee-rule="${rule.id}" data-next-enabled="${rule.enabled ? 'false' : 'true'}">${rule.enabled ? '비활성' : '활성'}</button>`}
    </article>
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


function renderSettingsPeriodSelect(periods, selected) {
  const selectedValue = selected ? `${selected.year}-${selected.month}-${selected.week}` : '';
  return `
    <label class="fund-settings-period">
      <span>면제 관리 주차</span>
      <select data-settings-period>
        ${periods.map((item) => {
          const value = `${item.year}-${item.month}-${item.week}`;
          return `<option value="${value}" ${value === selectedValue ? 'selected' : ''}>${item.year}년 ${item.month}월 ${item.week}주차</option>`;
        }).join('')}
      </select>
    </label>
  `;
}
