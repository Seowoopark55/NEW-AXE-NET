export function renderFundView(root, state, actions = {}) {
  const { fund, system, auth, members } = state;

  if (!system.connected) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>데이터 연결 대기</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice ${system.error ? 'notice--error' : ''}">
            ${system.error ? escapeHtml(system.error) : 'Supabase 연결을 확인하고 있습니다.'}
          </div>
        </div>
      </section>
    `;
    return;
  }

  if (!fund.initialized) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__body">
          <div class="notice">공금 데이터를 준비하고 있습니다.</div>
        </div>
      </section>
    `;
    return;
  }

  if (fund.error) {
    root.innerHTML = `
      <section class="panel">
        <div class="panel__header">
          <div>
            <h2>공금</h2>
            <p>Supabase · new_axe_net.fund_*</p>
          </div>
        </div>
        <div class="panel__body">
          <div class="notice notice--error">
            <strong>공금 데이터 로드 실패</strong>
            <span>${escapeHtml(fund.error)}</span>
          </div>
        </div>
      </section>
    `;
    return;
  }

  const summary = fund.summary ?? {};
  const period = summary.period ?? fund.selectedPeriod;
  const balance = summary.balance ?? {};
  const counts = summary.counts ?? {};
  const amounts = summary.amounts ?? {};

  root.innerHTML = `
    <section class="panel fund-panel">
      <div class="panel__header fund-header">
        <div>
          <h2>공금</h2>
          <p>원장 · 주간 현황 · 신청/승인 · 면제/회비 규칙</p>
        </div>

        <div class="fund-header-actions">
          <button class="fund-request-button" type="button" data-open-fund-request>
            납부 신청
          </button>

          ${
            auth.admin
              ? `
                <button class="fund-admin-button" type="button" data-open-fund-admin>
                  공금 관리
                </button>
              `
              : ''
          }

          <label class="fund-period-select">
            <span>조회 기간</span>
            <select data-fund-period ${fund.loading ? 'disabled' : ''}>
              ${renderPeriodOptions(fund.periods, period)}
            </select>
          </label>
        </div>
      </div>

      <div class="panel__body">
        ${fund.loading ? '<div class="notice">선택한 기간을 불러오는 중입니다.</div>' : ''}

        <div class="fund-balance-grid">
          ${renderKpi('전체 잔액', formatMoney(balance.total), '현재 active 원장 기준')}
          ${renderKpi('공용계좌', formatMoney(balance.public), '수입 - 지출 + 조정')}
          ${renderKpi('회사잔고', formatMoney(balance.company), '회사잔고 배정분')}
          ${renderKpi('주간 공금', formatMoney(summary.fee), formatPeriodLabel(period))}
        </div>

        <div class="fund-period-summary">
          <div class="fund-period-summary__head">
            <div>
              <span>WEEKLY STATUS</span>
              <h3>${formatPeriodLabel(period)}</h3>
            </div>
            <div class="fund-period-summary__amount">
              <span>납부 대상</span>
              <strong>${formatMoney(amounts.expected)}</strong>
            </div>
          </div>

          <div class="fund-status-cards">
            ${renderStatusCard('완료', counts.completed, amounts.paid, 'done')}
            ${renderStatusCard('미납', counts.unpaid, amounts.unpaid, 'unpaid')}
            ${renderStatusCard('면제', counts.exempt, amounts.exempt, 'exempt')}
            ${renderStatusCard('예정', counts.scheduled, 0, 'scheduled')}
          </div>
        </div>

        <div class="fund-content-grid">
          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>주간 멤버 현황</h3>
                <p>${Number(counts.members ?? 0).toLocaleString('ko-KR')}명 기준</p>
              </div>
            </div>

            <div class="fund-status-table-wrap">
              <table class="fund-status-table">
                <thead>
                  <tr>
                    <th>순번</th>
                    <th>닉네임</th>
                    <th>상태</th>
                    <th class="fund-number">금액</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    fund.statusItems.length
                      ? fund.statusItems.map((item, index) => renderStatusRow(item, index + 1)).join('')
                      : '<tr><td colspan="4" class="fund-empty">표시할 데이터가 없습니다.</td></tr>'
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="fund-section">
            <div class="fund-section__header">
              <div>
                <h3>최근 공금 내역</h3>
                <p>active 원장 최근 12건</p>
              </div>
            </div>

            <div class="fund-ledger-list">
              ${
                fund.recentLedger.length
                  ? fund.recentLedger.map(renderLedgerItem).join('')
                  : '<div class="fund-empty fund-empty--block">최근 내역이 없습니다.</div>'
              }
            </div>
          </section>
        </div>

        <div class="fund-live-note">
          <strong>LIVE ENGINE</strong>
          승인된 납부는 fund_ledger에 즉시 생성되고 주간 상태와 잔액에 바로 반영됩니다.
        </div>
      </div>
    </section>

    ${
      fund.request.open
        ? renderFundRequestModal(fund, members.items)
        : ''
    }

    ${
      fund.admin.open && auth.admin
        ? renderFundAdminModal(fund, members.items)
        : ''
    }
  `;

  root.querySelector('[data-fund-period]')?.addEventListener('change', (event) => {
    const [year, month, week] = event.target.value.split('-').map(Number);
    actions.onPeriodChange?.({ year, month, week });
  });

  root.querySelector('[data-open-fund-request]')?.addEventListener('click', () => {
    actions.onOpenRequest?.();
  });

  root.querySelectorAll('[data-close-fund-request]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseRequest?.();
    });
  });

  const requestForm = root.querySelector('[data-fund-request-form]');
  requestForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(requestForm);
    const selectedPeriod = fund.selectedPeriod;

    if (!selectedPeriod) return;

    actions.onSubmitRequest?.({
      member_key: String(formData.get('member_key') ?? ''),
      discord_user_id: String(formData.get('discord_user_id') ?? '').trim(),
      year: selectedPeriod.year,
      month: selectedPeriod.month,
      week: selectedPeriod.week,
      amount: Number(formData.get('amount')),
      payment_mode: String(formData.get('payment_mode') ?? ''),
      evidence_url: String(formData.get('evidence_url') ?? '').trim(),
      memo: String(formData.get('memo') ?? '').trim(),
    });
  });

  root.querySelector('[data-open-fund-admin]')?.addEventListener('click', () => {
    actions.onOpenAdmin?.();
  });

  root.querySelectorAll('[data-close-fund-admin]').forEach((element) => {
    element.addEventListener('click', () => {
      actions.onCloseAdmin?.();
    });
  });

  root.querySelectorAll('[data-fund-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onAdminTabChange?.(button.dataset.fundAdminTab);
    });
  });

  root.querySelectorAll('[data-approve-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = window.prompt('승인 메모가 있으면 입력하세요.', '');

      if (note === null) return;

      actions.onApproveRequest?.(
        Number(button.dataset.approveRequest),
        note.trim(),
      );
    });
  });

  root.querySelectorAll('[data-reject-request]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = window.prompt('거절 사유를 입력하세요.', '');

      if (note === null) return;

      actions.onRejectRequest?.(
        Number(button.dataset.rejectRequest),
        note.trim(),
      );
    });
  });

  const paymentForm = root.querySelector('[data-fund-payment-form]');
  paymentForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(paymentForm);
    const selectedPeriod = fund.selectedPeriod;

    if (!selectedPeriod) return;

    actions.onCreatePayment?.({
      member_key: String(formData.get('member_key') ?? ''),
      year: selectedPeriod.year,
      month: selectedPeriod.month,
      week: selectedPeriod.week,
      amount: Number(formData.get('amount')),
      account: String(formData.get('account') ?? ''),
      ledger_date: String(formData.get('ledger_date') ?? ''),
      memo: String(formData.get('memo') ?? '').trim(),
    });
  });

  const transactionForm = root.querySelector('[data-fund-transaction-form]');
  transactionForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(transactionForm);

    actions.onCreateTransaction?.({
      direction: String(formData.get('direction') ?? ''),
      account: String(formData.get('account') ?? ''),
      amount: Number(formData.get('amount')),
      category: String(formData.get('category') ?? '').trim(),
      ledger_date: String(formData.get('ledger_date') ?? ''),
      member_key: String(formData.get('member_key') ?? ''),
      memo: String(formData.get('memo') ?? '').trim(),
    });
  });

  root.querySelectorAll('[data-cancel-ledger]').forEach((button) => {
    button.addEventListener('click', () => {
      const reason = window.prompt(
        '취소 사유를 입력하세요. 사유 없이 취소하려면 빈칸으로 확인하세요.',
        '',
      );

      if (reason === null) return;

      actions.onCancelLedger?.(
        Number(button.dataset.cancelLedger),
        reason.trim(),
      );
    });
  });

  const exemptionForm = root.querySelector('[data-fund-exemption-form]');
  exemptionForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(exemptionForm);
    const selectedPeriod = fund.selectedPeriod;

    if (!selectedPeriod) return;

    actions.onCreateExemption?.({
      member_key: String(formData.get('member_key') ?? ''),
      year: selectedPeriod.year,
      month: selectedPeriod.month,
      week: selectedPeriod.week,
      reason: String(formData.get('reason') ?? '').trim(),
    });
  });

  root.querySelectorAll('[data-disable-exemption]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onDisableExemption?.(Number(button.dataset.disableExemption));
    });
  });

  const feeRuleForm = root.querySelector('[data-fund-fee-rule-form]');
  feeRuleForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(feeRuleForm);

    actions.onCreateFeeRule?.({
      start_year: Number(formData.get('start_year')),
      start_month: Number(formData.get('start_month')),
      start_week: Number(formData.get('start_week')),
      weekly_fee: Number(formData.get('weekly_fee')),
      note: String(formData.get('note') ?? '').trim(),
    });
  });

  root.querySelectorAll('[data-toggle-fee-rule]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.onToggleFeeRule?.(
        Number(button.dataset.toggleFeeRule),
        button.dataset.nextEnabled === 'true',
      );
    });
  });
}

function renderFundRequestModal(fund, memberItems) {
  const period = fund.selectedPeriod;
  const weeklyFee = Number(fund.summary?.fee ?? 0);
  const activeMembers = memberItems.filter((member) => member.status === 'active');

  return `
    <div class="fund-request-backdrop" data-close-fund-request></div>

    <section class="fund-request-modal" role="dialog" aria-modal="true" aria-label="공금 납부 신청">
      <div class="fund-request-modal__header">
        <div>
          <span>PAYMENT REQUEST</span>
          <h3>공금 납부 신청</h3>
          <p>${formatPeriodLabel(period)} · 관리자 승인 후 완료 처리</p>
        </div>

        <button
          class="fund-request-modal__close"
          type="button"
          aria-label="닫기"
          data-close-fund-request
        >
          ×
        </button>
      </div>

      <div class="fund-request-modal__body">
        ${
          fund.request.success
            ? `
              <div class="fund-request-result fund-request-result--success">
                <strong>신청 완료</strong>
                <span>${escapeHtml(fund.request.success)}</span>
              </div>
              <button class="fund-request-close-wide" type="button" data-close-fund-request>
                닫기
              </button>
            `
            : `
              ${
                fund.request.error
                  ? `<div class="fund-request-result fund-request-result--error">${escapeHtml(fund.request.error)}</div>`
                  : ''
              }

              <form class="fund-request-form" data-fund-request-form>
                <label class="member-edit-field">
                  <span>멤버 *</span>
                  <select name="member_key" required>
                    <option value="">선택</option>
                    ${activeMembers.map((member) => `
                      <option value="${escapeAttribute(member.member_key)}">
                        ${escapeHtml(member.nickname)}
                      </option>
                    `).join('')}
                  </select>
                </label>

                <label class="member-edit-field">
                  <span>Discord 사용자 ID *</span>
                  <input
                    type="text"
                    name="discord_user_id"
                    inputmode="numeric"
                    placeholder="본인의 Discord 숫자 ID"
                    required
                  />
                </label>

                <div class="fund-request-grid">
                  <label class="member-edit-field">
                    <span>신청 금액 *</span>
                    <input
                      type="number"
                      name="amount"
                      min="1"
                      step="1"
                      value="${weeklyFee}"
                      required
                    />
                  </label>

                  <label class="member-edit-field">
                    <span>입금 계좌</span>
                    <select name="payment_mode">
                      <option value="공용계좌" selected>공용계좌</option>
                      <option value="회사잔고">회사잔고</option>
                    </select>
                  </label>
                </div>

                <label class="member-edit-field">
                  <span>증빙 URL</span>
                  <input
                    type="url"
                    name="evidence_url"
                    maxlength="500"
                    placeholder="선택 · 이미지/증빙 링크"
                  />
                </label>

                <label class="member-edit-field">
                  <span>메모</span>
                  <input
                    type="text"
                    name="memo"
                    maxlength="300"
                    placeholder="선택"
                  />
                </label>

                <div class="fund-request-help">
                  선택한 멤버에 등록된 Discord ID와 입력한 ID가 일치해야 신청됩니다.
                  신청만으로 공금 완료가 되지는 않으며, 관리자 승인 시 원장에 자동 등록됩니다.
                </div>

                <button
                  class="fund-request-submit"
                  type="submit"
                  ${fund.request.submitting ? 'disabled' : ''}
                >
                  ${fund.request.submitting ? '신청 중...' : '납부 신청'}
                </button>
              </form>
            `
        }
      </div>
    </section>
  `;
}

function renderFundAdminModal(fund, memberItems) {
  const admin = fund.admin;
  const period = fund.selectedPeriod;
  const activeMembers = memberItems.filter((member) => member.status === 'active');

  return `
    <div class="fund-admin-backdrop" data-close-fund-admin></div>

    <section class="fund-admin-modal" role="dialog" aria-modal="true" aria-label="공금 관리">
      <div class="fund-admin-modal__header">
        <div>
          <span>FUND ADMIN</span>
          <h3>공금 관리</h3>
          <p>신청 · 원장 · 면제 · 회비 규칙을 관리합니다.</p>
        </div>

        <button
          class="fund-admin-modal__close"
          type="button"
          aria-label="닫기"
          data-close-fund-admin
        >
          ×
        </button>
      </div>

      <div class="fund-admin-tabs">
        ${renderAdminTab('requests', '요청', admin.tab, countPending(admin.requests))}
        ${renderAdminTab('ledger', '원장', admin.tab)}
        ${renderAdminTab('exemptions', '면제', admin.tab)}
        ${renderAdminTab('feeRules', '회비 규칙', admin.tab)}
      </div>

      <div class="fund-admin-modal__body">
        ${
          admin.loading
            ? '<div class="notice">관리 데이터를 불러오는 중입니다.</div>'
            : ''
        }

        ${
          admin.message
            ? `<div class="fund-admin-message fund-admin-message--success">${escapeHtml(admin.message)}</div>`
            : ''
        }

        ${
          admin.error
            ? `<div class="fund-admin-message fund-admin-message--error">${escapeHtml(admin.error)}</div>`
            : ''
        }

        ${
          admin.tab === 'requests'
            ? renderRequestsAdmin(admin)
            : admin.tab === 'ledger'
              ? renderLedgerAdmin(admin, fund, activeMembers, memberItems)
              : admin.tab === 'feeRules'
                ? renderFeeRulesAdmin(admin, period)
                : renderExemptionsAdmin(admin, period, activeMembers)
        }
      </div>
    </section>
  `;
}

function renderRequestsAdmin(admin) {
  const sorted = [...admin.requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return `
    <div class="fund-admin-section-head">
      <div>
        <h4>공금 요청함</h4>
        <p>pending 요청을 승인하면 fund_ledger에 납부가 자동 생성됩니다.</p>
      </div>
      <span>대기 ${countPending(admin.requests)}건</span>
    </div>

    <div class="fund-request-admin-list">
      ${
        sorted.length
          ? sorted.map(renderRequestAdminItem).join('')
          : '<div class="fund-admin-empty">공금 신청 내역이 없습니다.</div>'
      }
    </div>
  `;
}

function renderRequestAdminItem(item) {
  const pending = item.status === 'pending';

  return `
    <article class="fund-request-admin-item ${pending ? 'fund-request-admin-item--pending' : ''}">
      <div class="fund-request-admin-item__top">
        <div>
          <div class="fund-request-admin-item__title">
            <strong>${escapeHtml(item.nickname || '멤버')}</strong>
            ${renderRequestStatus(item.status)}
          </div>
          <span>
            ${item.year}년 ${item.month}월 ${item.week}주차
            · ${escapeHtml(item.payment_mode || '공용계좌')}
          </span>
        </div>

        <b>${formatMoney(item.amount)}</b>
      </div>

      <div class="fund-request-admin-item__meta">
        <span>Discord ${escapeHtml(item.discord_name || item.discord_user_id || '—')}</span>
        <span>${formatDateTime(item.created_at)}</span>
        <span>${escapeHtml(item.submitted_via || 'legacy')}</span>
      </div>

      ${
        item.memo
          ? `<p class="fund-request-admin-item__memo">메모 · ${escapeHtml(item.memo)}</p>`
          : ''
      }

      ${
        item.evidence_url
          ? `
            <p class="fund-request-admin-item__memo">
              증빙 ·
              <a href="${escapeAttribute(item.evidence_url)}" target="_blank" rel="noopener noreferrer">
                링크 열기
              </a>
            </p>
          `
          : ''
      }

      ${
        item.review_note
          ? `<p class="fund-request-admin-item__review">검토 · ${escapeHtml(item.review_note)}</p>`
          : ''
      }

      ${
        pending
          ? `
            <div class="fund-request-admin-item__actions">
              <button
                class="fund-admin-danger"
                type="button"
                data-reject-request="${item.id}"
              >
                거절
              </button>

              <button
                class="fund-admin-primary"
                type="button"
                data-approve-request="${item.id}"
              >
                승인 + 원장 등록
              </button>
            </div>
          `
          : ''
      }
    </article>
  `;
}

function renderRequestStatus(status) {
  const labels = {
    pending: '검토 대기',
    approved: '승인',
    rejected: '거절',
    deleted: '삭제됨',
  };

  return `
    <span class="fund-request-status fund-request-status--${escapeAttribute(status)}">
      ${labels[status] ?? escapeHtml(status)}
    </span>
  `;
}

function countPending(requests) {
  return requests.filter((item) => item.status === 'pending').length;
}

function renderLedgerAdmin(admin, fund, activeMembers, allMembers) {
  const period = fund.selectedPeriod;
  const weeklyFee = Number(fund.summary?.fee ?? 0);
  const today = getLocalDateString();

  return `
    <div class="fund-admin-ledger-grid">
      <section class="fund-admin-box">
        <div class="fund-admin-section-head">
          <div>
            <h4>주간 공금 납부 등록</h4>
            <p>${formatPeriodLabel(period)} · 관리자 직접 등록</p>
          </div>
        </div>

        <form class="fund-admin-form fund-admin-form--plain" data-fund-payment-form>
          <div class="fund-admin-form-grid">
            <label class="member-edit-field">
              <span>멤버</span>
              <select name="member_key" required>
                <option value="">선택</option>
                ${activeMembers.map((member) => `
                  <option value="${escapeAttribute(member.member_key)}">
                    ${escapeHtml(member.nickname)}
                  </option>
                `).join('')}
              </select>
            </label>

            <label class="member-edit-field">
              <span>납부 금액</span>
              <input
                type="number"
                name="amount"
                min="1"
                step="1"
                value="${weeklyFee}"
                required
              />
            </label>

            <label class="member-edit-field">
              <span>계좌</span>
              <select name="account">
                <option value="공용계좌" selected>공용계좌</option>
                <option value="회사잔고">회사잔고</option>
              </select>
            </label>

            <label class="member-edit-field">
              <span>처리일</span>
              <input type="date" name="ledger_date" value="${today}" required />
            </label>

            <label class="member-edit-field fund-admin-form-grid__wide">
              <span>메모</span>
              <input
                type="text"
                name="memo"
                maxlength="300"
                placeholder="선택"
              />
            </label>
          </div>

          <button
            class="fund-admin-primary"
            type="submit"
            ${admin.saving ? 'disabled' : ''}
          >
            ${admin.saving ? '처리 중...' : '납부 등록'}
          </button>
        </form>
      </section>

      <section class="fund-admin-box">
        <div class="fund-admin-section-head">
          <div>
            <h4>수입 · 지출 · 조정</h4>
            <p>공금 잔액에 직접 반영되는 일반 원장 항목</p>
          </div>
        </div>

        <form class="fund-admin-form fund-admin-form--plain" data-fund-transaction-form>
          <div class="fund-admin-form-grid">
            <label class="member-edit-field">
              <span>거래 유형</span>
              <select name="direction">
                <option value="지출" selected>지출</option>
                <option value="수입">수입</option>
                <option value="조정">조정</option>
              </select>
            </label>

            <label class="member-edit-field">
              <span>계좌</span>
              <select name="account">
                <option value="공용계좌" selected>공용계좌</option>
                <option value="회사잔고">회사잔고</option>
              </select>
            </label>

            <label class="member-edit-field">
              <span>금액</span>
              <input
                type="number"
                name="amount"
                step="100"
                placeholder="예: 21000"
                required
              />
            </label>

            <label class="member-edit-field">
              <span>처리일</span>
              <input type="date" name="ledger_date" value="${today}" required />
            </label>

            <label class="member-edit-field">
              <span>관련 멤버</span>
              <select name="member_key">
                <option value="">없음</option>
                ${allMembers.map((member) => `
                  <option value="${escapeAttribute(member.member_key)}">
                    ${escapeHtml(member.nickname)}
                  </option>
                `).join('')}
              </select>
            </label>

            <label class="member-edit-field">
              <span>분류</span>
              <input
                type="text"
                name="category"
                maxlength="100"
                placeholder="예: 화약 구매 / 전쟁비 / 의뢰비"
                required
              />
            </label>

            <label class="member-edit-field fund-admin-form-grid__wide">
              <span>메모</span>
              <input
                type="text"
                name="memo"
                maxlength="300"
                placeholder="선택"
              />
            </label>
          </div>

          <div class="fund-admin-warning">
            수입/지출은 양수로 입력합니다. 조정은 잔액 증가 시 양수, 감소 시 음수로 입력합니다.
          </div>

          <button
            class="fund-admin-primary"
            type="submit"
            ${admin.saving ? 'disabled' : ''}
          >
            ${admin.saving ? '처리 중...' : '거래 등록'}
          </button>
        </form>
      </section>
    </div>

    <div class="fund-admin-section-head fund-admin-ledger-heading">
      <div>
        <h4>최근 원장</h4>
        <p>최근 50건 · 취소는 삭제가 아니라 cancelled로 보존</p>
      </div>
    </div>

    <div class="fund-admin-ledger-list">
      ${
        admin.ledgerItems.length
          ? admin.ledgerItems.map(renderAdminLedgerItem).join('')
          : '<div class="fund-admin-empty">원장 내역이 없습니다.</div>'
      }
    </div>
  `;
}

function renderAdminLedgerItem(item) {
  return `
    <article class="fund-admin-ledger-item ${item.status === 'cancelled' ? 'fund-admin-ledger-item--cancelled' : ''}">
      <div class="fund-admin-ledger-item__top">
        <div>
          <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
          <span>
            ${escapeHtml(item.nickname || item.account || '공용')}
            · ${escapeHtml(item.direction || '')}
            · ${escapeHtml(item.account || '')}
          </span>
        </div>

        <b class="fund-ledger-amount fund-ledger-amount--${ledgerAmountType(item)}">
          ${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}
        </b>
      </div>

      <div class="fund-admin-ledger-item__bottom">
        <div>
          <span>${formatDate(item.ledger_date)}</span>
          ${
            item.year && item.month && item.week
              ? `<span>${item.year}년 ${item.month}월 ${item.week}주차</span>`
              : ''
          }
          <span>${item.status === 'active' ? 'active' : 'cancelled'}</span>
        </div>

        ${
          item.status === 'active'
            ? `
              <button
                class="fund-admin-danger"
                type="button"
                data-cancel-ledger="${item.id}"
              >
                취소
              </button>
            `
            : '<span class="fund-admin-locked">취소됨</span>'
        }
      </div>

      ${
        item.memo
          ? `<p class="fund-admin-ledger-item__memo">${escapeHtml(item.memo)}</p>`
          : ''
      }
    </article>
  `;
}

function renderAdminTab(value, label, activeTab, count = null) {
  return `
    <button
      class="fund-admin-tab ${value === activeTab ? 'fund-admin-tab--active' : ''}"
      type="button"
      data-fund-admin-tab="${value}"
    >
      ${label}
      ${count !== null ? `<span class="fund-admin-tab__count">${count}</span>` : ''}
    </button>
  `;
}

function renderExemptionsAdmin(admin, period, activeMembers) {
  return `
    <div class="fund-admin-section-head">
      <div>
        <h4>주간 면제</h4>
        <p>${formatPeriodLabel(period)} · 활성 면제만 표시</p>
      </div>
      <span>${admin.exemptions.length}건</span>
    </div>

    <form class="fund-admin-form" data-fund-exemption-form>
      <div class="fund-admin-form-grid">
        <label class="member-edit-field">
          <span>멤버</span>
          <select name="member_key" required>
            <option value="">선택</option>
            ${activeMembers.map((member) => `
              <option value="${escapeAttribute(member.member_key)}">
                ${escapeHtml(member.nickname)}
              </option>
            `).join('')}
          </select>
        </label>

        <label class="member-edit-field fund-admin-form-grid__wide">
          <span>면제 사유</span>
          <input
            type="text"
            name="reason"
            maxlength="200"
            placeholder="예: 신규 가입 주차 / 운영진 승인"
          />
        </label>
      </div>

      <button
        class="fund-admin-primary"
        type="submit"
        ${admin.saving ? 'disabled' : ''}
      >
        ${admin.saving ? '처리 중...' : '면제 등록'}
      </button>
    </form>

    <div class="fund-admin-list">
      ${
        admin.exemptions.length
          ? admin.exemptions.map(renderExemptionItem).join('')
          : '<div class="fund-admin-empty">이 주차에 활성 면제가 없습니다.</div>'
      }
    </div>
  `;
}

function renderExemptionItem(item) {
  return `
    <article class="fund-admin-list-item">
      <div>
        <strong>${escapeHtml(item.nickname || '멤버')}</strong>
        <span>${escapeHtml(item.reason || '사유 없음')}</span>
        <small>
          ${escapeHtml(item.created_by || '관리자')}
          · ${formatDateTime(item.created_at)}
        </small>
      </div>

      <button
        class="fund-admin-danger"
        type="button"
        data-disable-exemption="${item.id}"
      >
        면제 해제
      </button>
    </article>
  `;
}

function renderFeeRulesAdmin(admin, selectedPeriod) {
  const defaultYear = selectedPeriod?.year ?? new Date().getFullYear();
  const defaultMonth = selectedPeriod?.month ?? new Date().getMonth() + 1;
  const defaultWeek = selectedPeriod?.week ?? 1;

  return `
    <div class="fund-admin-section-head">
      <div>
        <h4>주간 공금 규칙</h4>
        <p>새 적용 시점을 추가하는 방식으로 이력을 보존합니다.</p>
      </div>
      <span>${admin.feeRules.filter((rule) => rule.enabled).length}개 활성</span>
    </div>

    <form class="fund-admin-form" data-fund-fee-rule-form>
      <div class="fund-admin-form-grid fund-admin-form-grid--rule">
        <label class="member-edit-field">
          <span>시작 연도</span>
          <input type="number" name="start_year" min="2020" max="2100" value="${defaultYear}" required />
        </label>

        <label class="member-edit-field">
          <span>월</span>
          <input type="number" name="start_month" min="1" max="12" value="${defaultMonth}" required />
        </label>

        <label class="member-edit-field">
          <span>주차</span>
          <input type="number" name="start_week" min="1" max="5" value="${defaultWeek}" required />
        </label>

        <label class="member-edit-field">
          <span>주간 공금</span>
          <input type="number" name="weekly_fee" min="0" step="1000" value="20000" required />
        </label>

        <label class="member-edit-field fund-admin-form-grid__wide">
          <span>메모</span>
          <input
            type="text"
            name="note"
            maxlength="200"
            placeholder="예: 9월 1주차부터 30,000원"
          />
        </label>
      </div>

      <div class="fund-admin-warning">
        과거 시점에 새 규칙을 추가하면 해당 시점 이후의 과거 주차 계산도 달라질 수 있습니다.
      </div>

      <button
        class="fund-admin-primary"
        type="submit"
        ${admin.saving ? 'disabled' : ''}
      >
        ${admin.saving ? '처리 중...' : '새 회비 규칙 추가'}
      </button>
    </form>

    <div class="fund-admin-list fund-admin-list--rules">
      ${
        admin.feeRules.length
          ? admin.feeRules.map(renderFeeRuleItem).join('')
          : '<div class="fund-admin-empty">등록된 회비 규칙이 없습니다.</div>'
      }
    </div>
  `;
}

function renderFeeRuleItem(rule) {
  const isBase = rule.source_key === 'base_weekly_fee';

  return `
    <article class="fund-admin-list-item fund-admin-list-item--rule">
      <div>
        <strong>
          ${rule.start_year}년 ${rule.start_month}월 ${rule.start_week}주차
          · ${formatMoney(rule.weekly_fee)}
        </strong>
        <span>${escapeHtml(rule.note || '메모 없음')}</span>
        <small>
          ${rule.enabled ? '활성' : '비활성'}
          ${isBase ? ' · 기본 fallback' : ''}
        </small>
      </div>

      ${
        isBase
          ? '<span class="fund-admin-locked">고정</span>'
          : `
            <button
              class="${rule.enabled ? 'fund-admin-danger' : 'fund-admin-secondary'}"
              type="button"
              data-toggle-fee-rule="${rule.id}"
              data-next-enabled="${rule.enabled ? 'false' : 'true'}"
            >
              ${rule.enabled ? '비활성화' : '활성화'}
            </button>
          `
      }
    </article>
  `;
}

function renderPeriodOptions(periods, selected) {
  return periods.map((period) => {
    const value = `${period.year}-${period.month}-${period.week}`;
    const selectedValue = selected
      ? `${selected.year}-${selected.month}-${selected.week}`
      : '';

    return `
      <option value="${value}" ${value === selectedValue ? 'selected' : ''}>
        ${period.year}년 ${period.month}월 ${period.week}주차
      </option>
    `;
  }).join('');
}

function renderKpi(label, value, note) {
  return `
    <div class="fund-kpi">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </div>
  `;
}

function renderStatusCard(label, count, amount, type) {
  return `
    <div class="fund-status-card fund-status-card--${type}">
      <div>
        <span>${label}</span>
        <strong>${Number(count ?? 0).toLocaleString('ko-KR')}</strong>
      </div>
      <small>${amount ? formatMoney(amount) : '—'}</small>
    </div>
  `;
}

function renderStatusRow(item, displayOrder) {
  return `
    <tr>
      <td>${displayOrder}</td>
      <td><strong>${escapeHtml(item.nickname ?? '')}</strong></td>
      <td>${renderStatusBadge(item.status)}</td>
      <td class="fund-number">${formatMoney(item.amount)}</td>
    </tr>
  `;
}

function renderStatusBadge(status) {
  const classNames = {
    '완료': 'done',
    '미납': 'unpaid',
    '면제': 'exempt',
    '예정': 'scheduled',
    '가입 전': 'before',
  };

  const className = classNames[status] ?? 'before';

  return `<span class="fund-status-badge fund-status-badge--${className}">${escapeHtml(status)}</span>`;
}

function renderLedgerItem(item) {
  return `
    <article class="fund-ledger-item">
      <div class="fund-ledger-item__main">
        <div>
          <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
          <span>${escapeHtml(item.nickname || item.account || '공용')}</span>
        </div>
        <b class="fund-ledger-amount fund-ledger-amount--${ledgerAmountType(item)}">
          ${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}
        </b>
      </div>
      <div class="fund-ledger-item__meta">
        <span>${formatDate(item.ledger_date)}</span>
        <span>${escapeHtml(item.account || '')}</span>
      </div>
    </article>
  `;
}

function ledgerSign(item) {
  if (item.direction === '지출') return '-';
  if (item.direction === '조정') {
    return Number(item.amount ?? 0) >= 0 ? '+' : '-';
  }
  return '+';
}

function ledgerAmountType(item) {
  if (item.direction === '지출') return 'out';
  if (item.direction === '조정' && Number(item.amount ?? 0) < 0) return 'out';
  return 'in';
}

function formatMoney(value) {
  const number = Number(value ?? 0);
  return `${Number.isFinite(number) ? number.toLocaleString('ko-KR') : '0'}원`;
}

function formatPeriodLabel(period) {
  if (!period) return '기간 없음';
  return `${period.year}년 ${period.month}월 ${period.week}주차`;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getLocalDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
