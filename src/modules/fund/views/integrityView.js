import { escapeHtml, formatDateTime, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderIntegrityView(state) {
  const report = state.fund.admin.integrityReport;
  const counts = report?.counts ?? {};
  const total = Number(counts.total ?? 0);

  return `
    <div class="fund-admin13-page">
      ${renderPageHeader('정합성점검', '브라우저 추정이 아니라 Supabase 원본에서 신청·원장 연결 상태를 직접 점검합니다.', '<button class="fund-secondary-button" type="button" data-fund-refresh>다시 점검</button>')}

      <div class="fund-admin13-integrity-hero ${total ? 'is-warning' : 'is-ok'}">
        <div><span>DATABASE INTEGRITY</span><strong>${report ? (total ? `${total}건 확인 필요` : '정합성 이상 없음') : '점검 결과 준비 중'}</strong><small>${report?.generated_at ? `점검 ${formatDateTime(report.generated_at)}` : '관리자 데이터를 새로고침하세요.'}</small></div>
        <b>${total}</b>
      </div>

      <div class="fund-admin13-stat-grid">
        ${metric('중복 납부', counts.duplicates)}
        ${metric('승인원장 누락', counts.approved_missing)}
        ${metric('대기+납부 충돌', counts.pending_with_payment)}
        ${metric('연결 신청 없음', counts.orphan_ledgers)}
      </div>

      ${renderSection('중복 활성 납부', '같은 멤버·주차에 활성 납부 원장이 2건 이상입니다.', report?.duplicates ?? [], renderDuplicate)}
      ${renderSection('승인 신청 · 원장 누락', '승인된 신청은 있으나 연결되는 활성 납부 원장이 없습니다.', report?.approved_missing ?? [], renderRequestIssue)}
      ${renderSection('검수대기 · 이미 납부완료', '검수대기 신청과 활성 납부 원장이 동시에 존재합니다.', report?.pending_with_payment ?? [], renderRequestIssue)}
      ${renderSection('원장 · 연결 신청 없음', 'request_id를 가진 활성 원장이지만 연결 대상 신청 행이 없습니다.', report?.orphan_ledgers ?? [], renderOrphan)}
    </div>
  `;
}

function metric(label, value) {
  const number = Number(value ?? 0);
  return `<div class="fund-admin13-stat ${number ? 'is-warning' : ''}"><span>${label}</span><strong>${number}건</strong><small>${number ? '확인 필요' : '정상'}</small></div>`;
}

function renderSection(title, desc, items, renderer) {
  return `
    <section class="fund-admin13-panel fund-admin13-integrity-section">
      <div class="fund-admin13-panel-head fund-admin13-panel-head--row"><div><span>CHECK</span><h3>${title}</h3><p>${desc}</p></div><b>${items.length}건</b></div>
      <div class="fund-admin13-integrity-list">${items.length ? items.map(renderer).join('') : '<div class="fund-admin13-integrity-empty">이상 없음</div>'}</div>
    </section>
  `;
}

function renderDuplicate(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || item.member_key || '멤버')}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>활성 ${Number(item.active_count || 0)}건</b><small>원장 #${(item.ledger_ids || []).join(', #')}</small></article>`;
}

function renderRequestIssue(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>신청 #${item.request_id}</b></article>`;
}

function renderOrphan(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>원장 #${item.ledger_id}</b><small>request #${item.request_id}</small></article>`;
}
