import { escapeHtml, formatDateTime, formatMoney } from '../fundUtils.js';
import { renderPageHeader } from '../components/shared.js';

export function renderIntegrityView(state) {
  const report = state.fund.admin.integrityReport;
  const counts = report?.counts ?? {};
  const total = Number(counts.total ?? 0);
  const groups = [
    ['중복 활성 납부', '같은 멤버·주차에 활성 납부 원장이 2건 이상입니다.', report?.duplicates ?? [], renderDuplicate],
    ['승인 신청 · 원장 누락', '승인 신청은 있으나 활성 납부 원장이 없습니다.', report?.approved_missing ?? [], renderRequestIssue],
    ['검수대기 · 이미 납부완료', '검수대기와 활성 납부 원장이 동시에 있습니다.', report?.pending_with_payment ?? [], renderRequestIssue],
    ['원장 · 연결 신청 없음', 'request_id가 가리키는 신청 행이 없습니다.', report?.orphan_ledgers ?? [], renderOrphan],
  ];

  return `
    <div class="fund-admin fund-admin--medium">
      ${renderPageHeader('정합성점검', 'Supabase 원본에서 신청·원장 연결 오류를 확인합니다.', '<button class="fund-secondary-button" type="button" data-fund-refresh>다시 점검</button>')}

      <div class="fund-integrity-summary-line ${total ? 'is-warning' : 'is-ok'}">
        <strong>${report ? (total ? `${total}건 확인 필요` : '정합성 이상 없음') : '점검 결과 준비 중'}</strong>
        <span>${report?.generated_at ? formatDateTime(report.generated_at) : '관리자 데이터를 새로고침하세요.'}</span>
      </div>

      <div class="fund-integrity-quick">
        ${quick('중복 납부', counts.duplicates)}
        ${quick('승인원장 누락', counts.approved_missing)}
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
  return `<article><div><strong>${escapeHtml(item.nickname || item.member_key || '멤버')}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>활성 ${Number(item.active_count || 0)}건</b><details class="fund-admin-integrity-detail"><summary>원장 ID 보기</summary><small>#${(item.ledger_ids || []).join(', #')}</small></details></article>`;
}

function renderRequestIssue(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>신청 #${item.request_id}</b></article>`;
}

function renderOrphan(item) {
  return `<article><div><strong>${escapeHtml(item.nickname || '멤버')} · ${formatMoney(item.amount)}</strong><span>${item.year}년 ${item.month}월 ${item.week}주차</span></div><b>원장 #${item.ledger_id}</b><small>request #${item.request_id}</small></article>`;
}
