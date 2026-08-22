import {
  escapeAttribute,
  escapeHtml,
  formatDateTime,
  formatMoney,
} from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderBalanceView(state) {
  const admin = state.fund.admin;
  const balance = state.fund.summary?.balance ?? {};
  const preview = admin.balanceEvidencePreview || '';
  const latest = admin.balanceChecks?.[0] || null;

  return `
    <div class="fund-admin13-page">
      ${renderPageHeader('잔액점검', '사이트 계산 잔액과 인게임 실제 잔액을 증빙과 함께 대조·기록합니다.')}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin13-stat-grid">
        ${balanceStat('공용계좌', balance.public, latest?.difference_public)}
        ${balanceStat('회사잔고', balance.company, latest?.difference_company)}
        ${balanceStat('총 계산잔액', balance.total, latest ? Number(latest.difference_public) + Number(latest.difference_company) : null, true)}
      </div>

      <div class="fund-admin13-balance-layout">
        <section class="fund-admin13-panel fund-admin13-panel--form">
          <div class="fund-admin13-panel-head">
            <div><span>BALANCE CHECK</span><h3>실제 잔액 확인</h3><p>인게임 계좌를 확인한 시점의 금액을 입력합니다.</p></div>
          </div>
          <form class="fund-balance-check-form" data-balance-check-form>
            <div class="fund-form-grid">
              <label class="fund-field">
                <span>실제 공용계좌</span>
                <input type="number" step="1" name="actual_public" value="${Number(balance.public ?? 0)}" required />
              </label>
              <label class="fund-field">
                <span>실제 회사잔고</span>
                <input type="number" step="1" name="actual_company" value="${Number(balance.company ?? 0)}" required />
              </label>
              <label class="fund-field fund-field--wide">
                <span>점검 메모</span>
                <input name="note" maxlength="300" placeholder="예: 인게임 공용계좌 확인" />
              </label>
            </div>

            <div class="fund-admin13-upload" data-balance-evidence-drop tabindex="0" role="button">
              ${preview
                ? `<div class="fund-admin13-upload__preview"><img src="${escapeAttribute(preview)}" alt="잔액점검 증빙 미리보기" /></div>`
                : '<div class="fund-admin13-upload__empty"><b>잔액 증빙 스크린샷</b><span>클릭 · Ctrl+V · 드래그앤드롭으로 첨부</span><small>선택 사항이지만 실제 잔액 대조 시 첨부를 권장합니다.</small></div>'}
            </div>
            <div class="fund-admin13-upload__actions">
              <input type="file" accept="image/*" data-balance-evidence-file hidden />
              <button type="button" class="fund-secondary-button fund-secondary-button--small" data-balance-evidence-browse>파일첨부</button>
              ${preview ? '<button type="button" class="fund-secondary-button fund-secondary-button--small" data-balance-evidence-clear>첨부 제거</button>' : ''}
            </div>

            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>잔액점검 기록</button>
          </form>
        </section>

        <section class="fund-admin13-panel">
          <div class="fund-admin13-panel-head">
            <div><span>LAST CHECK</span><h3>최근 대조 결과</h3><p>${latest ? formatDateTime(latest.created_at) : '아직 기록 없음'}</p></div>
          </div>
          ${latest ? renderLatest(latest) : '<div class="fund-empty-state">잔액점검을 기록하면 최근 결과가 표시됩니다.</div>'}
        </section>
      </div>

      <section class="fund-admin13-panel">
        <div class="fund-admin13-panel-head fund-admin13-panel-head--row">
          <div><span>HISTORY</span><h3>잔액점검 이력</h3></div><b>${admin.balanceChecks.length}건</b>
        </div>
        <div class="fund-admin13-balance-history">
          ${admin.balanceChecks.length ? admin.balanceChecks.map(renderCheck).join('') : '<div class="fund-empty-state">아직 잔액점검 기록이 없습니다.</div>'}
        </div>
      </section>
    </div>
  `;
}

function balanceStat(label, value, diff, accent = false) {
  const note = diff == null ? '최근 점검 없음' : `최근 차이 ${formatDiff(diff)}`;
  return `<div class="fund-admin13-stat ${accent ? 'is-accent' : ''}"><span>${label}</span><strong>${formatMoney(value)}</strong><small>${note}</small></div>`;
}

function renderLatest(item) {
  const totalDiff = Number(item.difference_public) + Number(item.difference_company);
  return `
    <div class="fund-admin13-reconcile">
      <div><span>공용계좌</span><strong>${formatDiff(item.difference_public)}</strong><small>계산 ${formatMoney(item.computed_public)} · 실제 ${formatMoney(item.actual_public)}</small></div>
      <div><span>회사잔고</span><strong>${formatDiff(item.difference_company)}</strong><small>계산 ${formatMoney(item.computed_company)} · 실제 ${formatMoney(item.actual_company)}</small></div>
      <div class="${totalDiff === 0 ? 'is-ok' : 'is-warning'}"><span>총 차이</span><strong>${formatDiff(totalDiff)}</strong><small>${escapeHtml(item.checked_by_name || '관리자')}</small></div>
      ${item.evidence_url ? `<button type="button" class="fund-admin13-evidence-button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="잔액점검 증빙">증빙 보기</button>` : ''}
    </div>
  `;
}

function renderCheck(item) {
  const diffTotal = Number(item.difference_public) + Number(item.difference_company);
  return `
    <article class="fund-admin13-balance-row">
      <div><strong>${formatDateTime(item.created_at)}</strong><span>${escapeHtml(item.checked_by_name || '관리자')}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div>
      <div><span>공용</span><b>${formatDiff(item.difference_public)}</b></div>
      <div><span>회사</span><b>${formatDiff(item.difference_company)}</b></div>
      <div class="${diffTotal === 0 ? 'is-ok' : 'is-warning'}"><span>합계</span><b>${formatDiff(diffTotal)}</b></div>
      <div>${item.evidence_url ? `<button type="button" class="fund-admin13-evidence-button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="${formatDateTime(item.created_at)} 잔액 증빙">증빙</button>` : '<span class="fund-admin13-muted">—</span>'}</div>
    </article>
  `;
}

function formatDiff(value) {
  const number = Number(value ?? 0);
  if (number === 0) return '일치';
  return `${number > 0 ? '+' : ''}${formatMoney(number)}`;
}
