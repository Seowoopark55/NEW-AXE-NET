import { escapeHtml, formatDateTime, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderIntegrityView(state) {
  const report = state.fund.admin.integrityReport;
  const counts = report?.counts ?? {};
  const total = Number(counts.total ?? 0);
  const groups = [
    ['중복 납부기록', '같은 멤버·주차에 활성 납부기록이 2건 이상입니다. 신규 등록은 DB에서 차단되며, 이전 데이터만 확인합니다.', report?.duplicates ?? [], renderDuplicate],
    ['승인 신청 · 납부기록 누락', '승인된 신청은 있으나 반영된 납부기록이 없습니다. 신청 내용을 기준으로 안전하게 복구할 수 있습니다.', report?.approved_missing ?? [], renderApprovedMissing],
    ['신청 · 납부기록 금액 불일치', '승인 신청 금액과 실제 반영된 납부기록 금액이 다릅니다. 기준액에 가까운 쪽을 우선 추천합니다.', report?.amount_mismatch ?? [], renderAmountMismatch],
    ['검수대기 · 이미 납부완료', '처리 중인 신청과 기존 납부기록이 동시에 있습니다. 기존 기록을 유지하고 충돌 신청만 반려할 수 있습니다.', report?.pending_with_payment ?? [], renderPendingCollision],
    ['공금기록 · 연결 신청 없음', '공금기록에 연결된 신청 정보가 없습니다. 자동 수정하지 않고 기록 번호만 확인용으로 표시합니다.', report?.orphan_ledgers ?? [], renderOrphan],
  ];

  return `
    <div class="fund-admin fund-admin--integrity-view">
      ${renderPageHeader('정합성점검', '공금 신청과 실제 반영 기록을 비교해 문제가 있는 항목만 확인하고 안전하게 복구합니다.', '<button class="fund-secondary-button" type="button" data-fund-refresh>다시 점검</button>')}

      ${state.fund.admin.message ? `<div class="fund-inline-success">${escapeHtml(state.fund.admin.message)}</div>` : ''}
      ${state.fund.admin.error ? `<div class="fund-inline-error">${escapeHtml(state.fund.admin.error)}</div>` : ''}

      <div class="fund-integrity-summary-line ${total ? 'is-warning' : 'is-ok'}">
        <strong>${report ? (total ? `${total}건 확인 필요` : '정합성 이상 없음') : '점검 결과 준비 중'}</strong>
        <span>${report?.generated_at ? formatDateTime(report.generated_at) : '관리자 데이터를 새로고침하세요.'}</span>
      </div>

      <div class="fund-integrity-quick">
        ${quick('중복 납부', counts.duplicates)}
        ${quick('납부기록 누락', counts.approved_missing)}
        ${quick('금액 불일치', counts.amount_mismatch)}
        ${quick('대기·납부 충돌', counts.pending_with_payment)}
        ${quick('연결정보 없음', counts.orphan_ledgers)}
      </div>

      <div class="fund-admin-integrity-sections">
        ${groups.map(([title, desc, items, renderer]) => renderSection(title, desc, items, renderer)).join('')}
      </div>
    </div>
  `;
}

function quick(label, value) {
  const number = Number(value ?? 0);
  return `<div class="fund-integrity-quick__item ${number ? 'has-issue' : ''}"><span>${label}</span><b>${number}</b></div>`;
}

function renderSection(title, desc, items, renderer) {
  if (!items.length) {
    return `
      <section class="fund-admin-panel fund-admin-panel--integrity fund-admin-integrity-section is-clean">
        <div class="fund-admin-integrity-clean-head"><div><h3>${title}</h3><p>${desc}</p></div><span>이상 없음</span></div>
      </section>
    `;
  }

  return `
    <details class="fund-admin-panel fund-admin-panel--integrity fund-admin-integrity-section has-issues">
      <summary class="fund-admin-integrity-section__summary">
        <div><h3>${title}</h3><p>${desc}</p></div>
        <span class="fund-admin-integrity-section__count">${items.length}건</span>
        <i aria-hidden="true"></i>
      </summary>
      <div class="fund-admin-integrity-list">${items.map(renderer).join('')}</div>
    </details>
  `;
}

function renderDuplicate(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || item.member_key || '멤버')}</strong><span>${periodLabel(item)}</span></div><b>활성 ${Number(item.active_count || 0)}건</b><details class="fund-admin-integrity-detail"><summary>기록 번호 보기</summary><small>#${(item.ledger_ids || []).join(', #')}</small></details></article>`;
}

function renderApprovedMissing(item) {
  return `
    <article class="fund-integrity-row--action">
      <div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${periodLabel(item)}</span></div>
      <b>신청 #${item.request_id}</b>
      <div class="fund-integrity-actions"><button class="fund-secondary-button fund-secondary-button--small" type="button" data-integrity-repair-request="${item.request_id}">납부기록 복구</button></div>
    </article>
  `;
}

function renderAmountMismatch(item) {
  const recommendation = String(item.recommended_direction || 'manual');
  const buttons = recommendation === 'ledger_to_request'
    ? alignButton(item.request_id, 'ledger_to_request', '신청 금액 맞추기')
    : recommendation === 'request_to_ledger'
      ? alignButton(item.request_id, 'request_to_ledger', '기록 금액 맞추기')
      : `${alignButton(item.request_id, 'ledger_to_request', '신청←기록')}${alignButton(item.request_id, 'request_to_ledger', '기록←신청')}`;

  return `
    <article class="fund-integrity-row--action fund-integrity-row--mismatch">
      <div class="fund-integrity-mismatch-main">
        <strong>${escapeHtml(item.nickname || '멤버')} · ${periodLabel(item)}</strong>
        <span>신청 ${formatMoney(item.expected_total)} · 기록 ${formatMoney(item.actual_total)} · 기준 ${formatMoney(item.policy_fee)}</span>
      </div>
      <b>${recommendationLabel(recommendation)}</b>
      <div class="fund-integrity-actions">${buttons}</div>
      <details class="fund-admin-integrity-detail fund-integrity-detail--wide">
        <summary>금액 상세 보기</summary>
        <small>신청: 공용 ${formatMoney(item.expected_public)} + 잔고 ${formatMoney(item.expected_company)} · 납부기록: 공용 ${formatMoney(item.actual_public)} + 잔고 ${formatMoney(item.actual_company)} · 신청 #${item.request_id} / 기록 #${item.ledger_id}</small>
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
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${periodLabel(item)}</span></div><b>기록 #${item.ledger_id}</b><small>신청 #${item.request_id}</small></article>`;
}

function alignButton(requestId, direction, label) {
  return `<button class="fund-secondary-button fund-secondary-button--small" type="button" data-integrity-align="${requestId}" data-integrity-direction="${direction}">${label}</button>`;
}

function recommendationLabel(direction) {
  if (direction === 'ledger_to_request') return '기록 기준 추천';
  if (direction === 'request_to_ledger') return '신청 기준 추천';
  return '수동 판단';
}

function periodLabel(item) {
  return `${Number(item.year || 0)}년 ${Number(item.month || 0)}월 ${Number(item.week || 0)}주차`;
}
