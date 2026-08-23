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
    <div class="fund-admin fund-admin--balance">
      ${renderPageHeader('잔액점검', `공용계좌 계산 잔액 ${formatMoney(balance.public)} · 실제 인게임 잔액과 대조합니다.`)}
      ${admin.message ? `<div class="fund-inline-success">${escapeHtml(admin.message)}</div>` : ''}
      ${admin.error ? `<div class="fund-inline-error">${escapeHtml(admin.error)}</div>` : ''}

      <div class="fund-admin-split fund-admin-split--balance">
        <section class="fund-admin-panel fund-admin-panel--form">
          ${panelHead('실제 잔액 확인', '확인한 시점의 인게임 금액을 기록합니다.')}
          <form class="fund-balance-check-form" data-balance-check-form>
            <div class="fund-form-grid fund-form-grid--balance">
              <label class="fund-field fund-field--primary">
                <span>실제 공용계좌</span>
                <input type="number" step="1" name="actual_public" value="${Number(balance.public ?? 0)}" required />
              </label>
              <label class="fund-field fund-field--secondary">
                <span>회사잔고 <small>보조</small></span>
                <input type="number" step="1" name="actual_company" value="${Number(balance.company ?? 0)}" required />
              </label>
              <label class="fund-field fund-field--wide">
                <span>점검 메모</span>
                <input name="note" maxlength="300" placeholder="예: 인게임 공용계좌 확인" />
              </label>
            </div>

            <div class="fund-admin-upload" data-balance-evidence-drop tabindex="0" role="group" aria-label="잔액 증빙 붙여넣기 영역">
              ${preview
                ? `<div class="fund-admin-upload__preview"><img src="${escapeAttribute(preview)}" alt="잔액점검 증빙 미리보기" /></div>`
                : '<div class="fund-admin-upload__empty"><b>잔액 증빙</b><span>영역을 클릭한 뒤 Ctrl+V · 또는 드래그앤드롭</span><small>파일 선택은 아래 파일첨부 버튼 · 증빙은 선택사항입니다.</small></div>'}
            </div>
            <div class="fund-admin-upload__actions">
              <input type="file" accept="image/*" data-balance-evidence-file hidden />
              <button type="button" class="fund-secondary-button fund-secondary-button--small" data-balance-evidence-browse>파일첨부</button>
              ${preview ? '<button type="button" class="fund-secondary-button fund-secondary-button--small" data-balance-evidence-clear>첨부 제거</button>' : ''}
            </div>

            <button class="fund-primary-button fund-primary-button--wide" type="submit" ${admin.saving ? 'disabled' : ''}>잔액점검 기록</button>
          </form>
        </section>

        <section class="fund-admin-panel">
          ${panelHead('최근 대조 결과', latest ? formatDateTime(latest.created_at) : '아직 기록 없음')}
          ${latest ? renderLatest(latest) : '<div class="fund-empty-state">점검을 기록하면 최근 결과가 표시됩니다.</div>'}
        </section>
      </div>

      <section class="fund-admin-panel fund-admin-panel--history">
        ${panelHead('잔액점검 이력', '공용계좌 차이를 우선 표시합니다.', `${admin.balanceChecks.length}건`)}
        <div class="fund-admin-balance-history">
          ${admin.balanceChecks.length ? admin.balanceChecks.map(renderCheck).join('') : '<div class="fund-empty-state">아직 잔액점검 기록이 없습니다.</div>'}
        </div>
      </section>
    </div>
  `;
}

function panelHead(title, desc, count = '') {
  return `<div class="fund-admin-panel__head is-row"><div><h3>${title}</h3><p>${desc}</p></div>${count ? `<b>${count}</b>` : ''}</div>`;
}

function renderLatest(item) {
  return `
    <div class="fund-admin-reconcile">
      <div class="is-primary"><span>공용계좌 차이</span><strong>${formatDiff(item.difference_public)}</strong><small>계산 ${formatMoney(item.computed_public)} · 실제 ${formatMoney(item.actual_public)}</small></div>
      <div><span>회사잔고 차이</span><strong>${formatDiff(item.difference_company)}</strong><small>계산 ${formatMoney(item.computed_company)} · 실제 ${formatMoney(item.actual_company)}</small></div>
      ${item.evidence_url ? `<button type="button" class="fund-admin-evidence" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="잔액점검 증빙">증빙 보기</button>` : ''}
    </div>
  `;
}

function renderCheck(item) {
  return `
    <article class="fund-admin-balance-row">
      <div><strong>${formatDateTime(item.created_at)}</strong><span>${escapeHtml(item.checked_by_name || '관리자')}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span></div>
      <div class="is-primary"><span>공용</span><b>${formatDiff(item.difference_public)}</b></div>
      <div><span>회사</span><b>${formatDiff(item.difference_company)}</b></div>
      <div>${item.evidence_url ? `<button type="button" class="fund-admin-evidence" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="${formatDateTime(item.created_at)} 잔액 증빙">증빙</button>` : '<span class="fund-admin-muted">—</span>'}</div>
    </article>
  `;
}

function formatDiff(value) {
  const number = Number(value ?? 0);
  if (number === 0) return '일치';
  return `${number > 0 ? '+' : ''}${formatMoney(number)}`;
}
