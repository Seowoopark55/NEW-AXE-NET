import { escapeHtml, formatDateTime, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderIntegrityView(state) {
  const report = state.fund.admin.integrityReport;
  const counts = report?.counts ?? {};
  const total = Number(counts.total ?? 0);
  const groups = [
    ['중복 활성 납부', '같은 멤버·주차에 활성 납부 원장이 2건 이상입니다. 신규 등록은 DB에서 차단되며, 레거시 잔존 데이터만 점검합니다.', report?.duplicates ?? [], renderDuplicate],
    ['승인 신청 · 원장 누락', '승인 신청은 있으나 활성 납부 원장이 없습니다. 신청 원본을 기준으로 안전하게 원장을 복구할 수 있습니다.', report?.approved_missing ?? [], renderApprovedMissing],
    ['신청 · 원장 금액 불일치', '승인 신청의 공용/잔고 금액과 실제 활성 원장이 다릅니다. 기준액에 맞는 쪽을 우선 추천합니다.', report?.amount_mismatch ?? [], renderAmountMismatch],
    ['검수대기 · 이미 납부완료', '처리 중인 신청과 활성 납부 원장이 동시에 있습니다. 기존 납부 원장을 유지하고 충돌 신청을 반려할 수 있습니다.', report?.pending_with_payment ?? [], renderPendingCollision],
    ['원장 · 연결 신청 없음', 'request_id가 가리키는 신청 행이 없습니다. 자동 수정하지 않고 원장 ID를 확인용으로 표시합니다.', report?.orphan_ledgers ?? [], renderOrphan],
  ];

  return `
    <div class="fund-admin fund-admin--medium">
      ${renderPageHeader('정합성점검', 'Supabase 원본에서 신청·원장 연결과 금액 불일치를 확인하고 안전한 항목만 복구합니다.', '<button class="fund-secondary-button" type="button" data-fund-refresh>다시 점검</button>')}

      ${state.fund.admin.message ? `<div class="fund-inline-success">${escapeHtml(state.fund.admin.message)}</div>` : ''}
      ${state.fund.admin.error ? `<div class="fund-inline-error">${escapeHtml(state.fund.admin.error)}</div>` : ''}

      <div class="fund-integrity-summary-line ${total ? 'is-warning' : 'is-ok'}">
        <strong>${report ? (total ? `${total}건 확인 필요` : '정합성 이상 없음') : '점검 결과 준비 중'}</strong>
        <span>${report?.generated_at ? formatDateTime(report.generated_at) : '관리자 데이터를 새로고침하세요.'}</span>
      </div>

      <div class="fund-integrity-quick">
        ${quick('중복 납부', counts.duplicates)}
        ${quick('승인원장 누락', counts.approved_missing)}
        ${quick('금액 불일치', counts.amount_mismatch)}
        ${quick('대기+납부 충돌', counts.pending_with_payment)}
        ${quick('연결 신청 없음', counts.orphan_ledgers)}
      </div>

      <div class="fund-admin-integrity-sections">
        ${groups.map(([title, desc, items, renderer]) => renderSection(title, desc, items, renderer)).join('')}
      </div>
    </div>
  `;
}

function quick(label, value) {
  const number = Number(value ?? 0);
  return `<span class="fund-integrity-quick__item ${number ? 'has-issue' : ''}"><b>${number}</b>${label}</span>`;
}

function renderSection(title, desc, items, renderer) {
  return `
    <section class="fund-admin-panel fund-admin-panel--integrity fund-admin-integrity-section ${items.length ? 'has-issues' : 'is-clean'}">
      <div class="fund-admin-panel__head is-row"><div><h3>${title}</h3><p>${desc}</p></div><b>${items.length}건</b></div>
      ${items.length ? `<div class="fund-admin-integrity-list">${items.map(renderer).join('')}</div>` : '<div class="fund-admin-integrity-empty">이상 없음</div>'}
    </section>
  `;
}

function renderDuplicate(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || item.member_key || '멤버')}</strong><span>${periodLabel(item)}</span></div><b>활성 ${Number(item.active_count || 0)}건</b><details class="fund-admin-integrity-detail"><summary>원장 ID 보기</summary><small>#${(item.ledger_ids || []).join(', #')}</small></details></article>`;
}

function renderApprovedMissing(item) {
  return `
    <article class="fund-integrity-row--action">
      <div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${periodLabel(item)}</span></div>
      <b>신청 #${item.request_id}</b>
      <div class="fund-integrity-actions"><button class="fund-secondary-button fund-secondary-button--small" type="button" data-integrity-repair-request="${item.request_id}">원장 복구</button></div>
    </article>
  `;
}

function renderAmountMismatch(item) {
  const recommendation = String(item.recommended_direction || 'manual');
  const buttons = recommendation === 'ledger_to_request'
    ? alignButton(item.request_id, 'ledger_to_request', '신청 금액 맞추기')
    : recommendation === 'request_to_ledger'
      ? alignButton(item.request_id, 'request_to_ledger', '원장 금액 맞추기')
      : `${alignButton(item.request_id, 'ledger_to_request', '신청←원장')}${alignButton(item.request_id, 'request_to_ledger', '원장←신청')}`;

  return `
    <article class="fund-integrity-row--action fund-integrity-row--mismatch">
      <div class="fund-integrity-mismatch-main">
        <strong>${escapeHtml(item.nickname || '멤버')} · ${periodLabel(item)}</strong>
        <span>신청 ${formatMoney(item.expected_total)} · 원장 ${formatMoney(item.actual_total)} · 기준 ${formatMoney(item.policy_fee)}</span>
      </div>
      <b>${recommendationLabel(recommendation)}</b>
      <div class="fund-integrity-actions">${buttons}</div>
      <details class="fund-admin-integrity-detail fund-integrity-detail--wide">
        <summary>공용/잔고 상세</summary>
        <small>신청: 공용 ${formatMoney(item.expected_public)} + 잔고 ${formatMoney(item.expected_company)} · 원장: 공용 ${formatMoney(item.actual_public)} + 잔고 ${formatMoney(item.actual_company)} · 신청 #${item.request_id} / 원장 #${item.ledger_id}</small>
      </details>
    </article>
  `;
}

function renderPendingCollision(item) {
  return `
    <article class="fund-integrity-row--action">
      <div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${periodLabel(item)}</span></div>
      <b>신청 #${item.request_id}</b>
      <div class="fund-integrity-actions"><button class="ops-danger-button" type="button" data-integrity-reject-conflict="${item.request_id}">충돌 신청 반려</button></div>
    </article>
  `;
}

function renderOrphan(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${periodLabel(item)}</span></div><b>원장 #${item.ledger_id}</b><small>request #${item.request_id}</small></article>`;
}

function alignButton(requestId, direction, label) {
  return `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-integrity-align="${requestId}" data-integrity-direction="${direction}">${label}</button>`;
}

function recommendationLabel(direction) {
  if (direction === 'ledger_to_request') return '원장 기준 추천';
  if (direction === 'request_to_ledger') return '신청 기준 추천';
  return '수동 판단';
}

function periodLabel(item) {
  return `${Number(item.year || 0)}년 ${Number(item.month || 0)}월 ${Number(item.week || 0)}주차`;
}
