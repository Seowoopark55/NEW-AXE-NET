import {
  escapeAttribute,
  escapeHtml,
  formatMoney,
  formatPeriodLabel,
  ledgerAmountType,
  ledgerSign,
  renderStatusBadge,
  toInputDate,
} from '../fundUtils.js';

export function renderPageHeader(title, description, extra = '') {
  return `
    <div class="fund-page-header">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(description)}</p>
      </div>
      ${extra}
    </div>
  `;
}

export function renderIdentityGate(identity, _members, title = '로그인이 필요합니다') {
  return `
    <section class="fund-identity-card fund-identity-card--session">
      <div class="fund-identity-card__intro">
        <span>AXE ACCOUNT</span>
        <h3>${escapeHtml(title)}</h3>
        <p>사이트에 한 번 로그인하면 멤버 정보와 공금 계정연동을 자동으로 확인합니다.</p>
      </div>

      ${identity.loading ? '<div class="fund-identity-loading">로그인 계정의 공금 정보를 확인하고 있습니다.</div>' : ''}
      ${identity.error ? `<div class="fund-inline-error">${escapeHtml(identity.error)}</div>` : ''}

      ${identity.memberKey ? `
        <div class="fund-session-login-box">
          <div>
            <strong>${identity.loading ? '로그인 계정을 확인하고 있습니다.' : '계정은 확인됐지만 공금 연결을 완료하지 못했습니다.'}</strong>
            <span>${identity.loading ? '잠시만 기다려주세요.' : '위 오류 내용을 확인하거나 관리자에게 계정연동 상태를 문의하세요.'}</span>
          </div>
        </div>
      ` : `
        <div class="fund-session-login-box">
          <div>
            <strong>Discord 숫자 ID 입력이 필요 없습니다.</strong>
            <span>기존 AXE NET 닉네임·비밀번호로 로그인하세요.</span>
          </div>
          <button class="fund-primary-button" type="button" data-fund-open-login>로그인</button>
        </div>
      `}
    </section>
  `;
}

export function renderVerifiedMember(identity) {
  const member = identity.profile?.member;
  if (!member) return '';

  return `
    <div class="fund-member-strip fund-member-strip--session">
      <div>
        <span>${identity.source === 'admin' ? '관리자 계정으로 확인됨' : '로그인 계정으로 확인됨'}</span>
        <strong>${escapeHtml(member.nickname)}</strong>
        <small>${escapeHtml(member.discord_name || 'AXE 멤버')}</small>
      </div>
      <div class="fund-member-strip__secure">자동 본인확인</div>
    </div>
  `;
}

export function renderLedgerEditModal(admin, members) {
  const item = admin.ledgerItems.find(
    (ledger) => Number(ledger.id) === Number(admin.ledgerEditor?.itemId),
  );
  if (!item) return '';

  const isPayment = item.entry_type === 'payment';

  return `
    <div class="fund-overlay" data-close-ledger-editor></div>
    <section class="fund-dialog fund-dialog--ledger" role="dialog" aria-modal="true">
      <div class="fund-dialog__header">
        <div>
          <span>DETAIL / EDIT</span>
          <h3>공금내역 상세</h3>
          <p>#${item.id}${item.request_id ? ` · 제출 #${item.request_id}` : ''}</p>
        </div>
        <button class="fund-dialog__close" type="button" data-close-ledger-editor>×</button>
      </div>

      <form class="fund-dialog__body" data-ledger-edit-form>
        <input type="hidden" name="ledger_id" value="${item.id}" />
        <input type="hidden" name="entry_type" value="${escapeAttribute(item.entry_type)}" />

        ${
          isPayment
            ? `
              <div class="fund-lock-grid">
                <div><span>멤버</span><strong>${escapeHtml(item.nickname || '—')}</strong></div>
                <div><span>납부 주차</span><strong>${formatPeriodLabel(item)}</strong></div>
              </div>
              <input type="hidden" name="direction" value="수입" />
              <input type="hidden" name="category" value="${escapeAttribute(item.category || '주간공금')}" />
              <input type="hidden" name="member_key" value="${escapeAttribute(item.member_key || '')}" />
            `
            : `
              <div class="fund-form-grid">
                <label class="fund-field">
                  <span>거래 유형</span>
                  <select name="direction">
                    ${renderOption('수입', item.direction)}
                    ${renderOption('지출', item.direction)}
                    ${renderOption('조정', item.direction)}
                  </select>
                </label>
                <label class="fund-field">
                  <span>관련 멤버</span>
                  <select name="member_key">
                    <option value="">없음</option>
                    ${members.map((member) => `
                      <option value="${escapeAttribute(member.member_key)}" ${member.member_key === item.member_key ? 'selected' : ''}>
                        ${escapeHtml(member.nickname)}
                      </option>
                    `).join('')}
                  </select>
                </label>
                <label class="fund-field fund-field--wide">
                  <span>분류</span>
                  <input name="category" value="${escapeAttribute(item.category || '')}" required />
                </label>
              </div>
            `
        }

        <div class="fund-form-grid">
          <label class="fund-field">
            <span>금액</span>
            <input type="number" step="1" name="amount" value="${Number(item.amount ?? 0)}" required />
          </label>
          <label class="fund-field">
            <span>계좌</span>
            <select name="account">
              ${renderOption('공용계좌', item.account)}
              ${renderOption('회사잔고', item.account)}
            </select>
          </label>
          <label class="fund-field">
            <span>처리일</span>
            <input type="date" name="ledger_date" value="${toInputDate(item.ledger_date)}" required />
          </label>
          <label class="fund-field fund-field--wide">
            <span>메모</span>
            <input name="memo" maxlength="300" value="${escapeAttribute(item.memo || '')}" />
          </label>
        </div>

        ${item.evidence_url ? `
          <div class="fund-admin-evidence-existing">
            <span>증빙</span>
            <button type="button" data-evidence-preview="${escapeAttribute(item.evidence_url)}" data-evidence-label="공금내역 #${item.id} 증빙">증빙 크게 보기</button>
          </div>
        ` : ''}

        ${isPayment ? '<div class="fund-info-box">납부 멤버와 주차는 공금 상태 계산 기준이라 이 화면에서는 고정됩니다.</div>' : ''}

        <div class="fund-dialog__actions fund-dialog__actions--three">
          <button class="fund-danger-button" type="button" data-delete-ledger="${item.id}">삭제</button>
          <button class="fund-secondary-button" type="button" data-close-ledger-editor>닫기</button>
          <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>수정 저장</button>
        </div>
      </form>
    </section>
  `;
}

export function renderCompactLedger(item) {
  return `
    <article class="fund-compact-ledger">
      <div>
        <strong>${escapeHtml(item.category || item.ledger_type || '공금')}</strong>
        <span>${escapeHtml(item.nickname || item.account || '공용')} · ${escapeHtml(item.account || '')}</span>
      </div>
      <b class="fund-money--${ledgerAmountType(item)}">${ledgerSign(item)}${formatMoney(Math.abs(Number(item.amount ?? 0)))}</b>
    </article>
  `;
}


export function renderEntryCreatorModal(admin, fund, members) {
  if (!admin.entryCreator?.open) return '';
  const mode = admin.entryCreator.mode;
  const period = fund.selectedPeriod;
  const weeklyFee = Number(fund.summary?.fee ?? 0);
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
  const activeMembers = members.filter((member) => member.status === 'active');

  return `
    <div class="fund-overlay" data-close-entry-creator></div>
    <section class="fund-dialog" role="dialog" aria-modal="true">
      <div class="fund-dialog__header">
        <div>
          <span>ADD ENTRY</span>
          <h3>${mode === 'payment' ? '공금 납부 직접등록' : '수입·지출 내역 등록'}</h3>
          <p>${mode === 'payment' ? formatPeriodLabel(period) : '관리자가 공금내역에 직접 추가합니다.'}</p>
        </div>
        <button class="fund-dialog__close" type="button" data-close-entry-creator>×</button>
      </div>

      ${mode === 'payment' ? `
        <form class="fund-dialog__body" data-direct-payment-form>
          <div class="fund-form-grid">
            <label class="fund-field">
              <span>멤버</span>
              <select name="member_key" required>
                <option value="">선택</option>
                ${activeMembers.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}
              </select>
            </label>
            <label class="fund-field">
              <span>금액</span>
              <input type="number" step="1" min="1" name="amount" value="${weeklyFee}" required />
            </label>
            <label class="fund-field">
              <span>계좌</span>
              <select name="account"><option value="공용계좌">공용계좌</option><option value="회사잔고">회사잔고</option></select>
            </label>
            <label class="fund-field">
              <span>처리일</span>
              <input type="date" name="ledger_date" value="${localDate}" required />
            </label>
            <label class="fund-field fund-field--wide">
              <span>메모</span>
              <input name="memo" maxlength="300" placeholder="선택" />
            </label>
          </div>
          ${renderAdminEntryEvidence(admin.entryCreator)}
          <div class="fund-info-box">현재 선택한 ${formatPeriodLabel(period)}에 관리자가 직접 납부 완료를 등록합니다. 증빙은 선택 사항이며 등록하면 공금내역에서 바로 확인할 수 있습니다.</div>
          <div class="fund-dialog__actions">
            <button class="fund-secondary-button" type="button" data-close-entry-creator>취소</button>
            <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>납부 등록</button>
          </div>
        </form>
      ` : `
        <form class="fund-dialog__body" data-direct-transaction-form>
          <div class="fund-form-grid">
            <label class="fund-field"><span>거래 유형</span><select name="direction"><option value="지출">지출</option><option value="수입">수입</option><option value="조정">조정</option></select></label>
            <label class="fund-field"><span>계좌</span><select name="account"><option value="공용계좌">공용계좌</option><option value="회사잔고">회사잔고</option></select></label>
            <label class="fund-field"><span>금액</span><input type="number" step="1" name="amount" required /></label>
            <label class="fund-field"><span>처리일</span><input type="date" name="ledger_date" value="${localDate}" required /></label>
            <label class="fund-field"><span>관련 멤버</span><select name="member_key"><option value="">없음</option>${members.map((member) => `<option value="${escapeAttribute(member.member_key)}">${escapeHtml(member.nickname)}</option>`).join('')}</select></label>
            <label class="fund-field"><span>분류</span><input name="category" maxlength="100" placeholder="예: 화약 구매" required /></label>
            <label class="fund-field fund-field--wide"><span>메모</span><input name="memo" maxlength="300" placeholder="선택" /></label>
          </div>
          ${renderAdminEntryEvidence(admin.entryCreator)}
          <div class="fund-info-box">수입/지출은 양수로 입력하고, 조정은 증가 시 양수 · 감소 시 음수로 입력합니다.</div>
          <div class="fund-dialog__actions">
            <button class="fund-secondary-button" type="button" data-close-entry-creator>취소</button>
            <button class="fund-primary-button" type="submit" ${admin.saving ? 'disabled' : ''}>내역 등록</button>
          </div>
        </form>
      `}
    </section>
  `;
}


function renderAdminEntryEvidence(entryCreator) {
  const preview = entryCreator?.evidencePreview || '';
  return `
    <div class="fund-admin-upload" data-admin-entry-evidence-drop tabindex="0" role="group" aria-label="증빙 스크린샷 붙여넣기 영역">
      ${preview
        ? `<div class="fund-admin-upload__preview"><img src="${escapeAttribute(preview)}" alt="등록 증빙 미리보기" /></div>`
        : `<div class="fund-admin-upload__empty"><b>증빙 스크린샷</b><span>영역을 클릭한 뒤 Ctrl+V · 또는 드래그앤드롭</span><small>파일 선택은 아래 파일첨부 버튼을 사용합니다.</small></div>`}
    </div>
    <div class="fund-admin-upload__actions">
      <input type="file" accept="image/*" data-admin-entry-evidence-file hidden />
      <button type="button" class="fund-secondary-button fund-secondary-button--small" data-admin-entry-evidence-browse>파일첨부</button>
      ${preview ? '<button type="button" class="fund-secondary-button fund-secondary-button--small" data-admin-entry-evidence-clear>첨부 제거</button>' : ''}
    </div>
  `;
}

function renderOption(value, selected) {
  return `<option value="${escapeAttribute(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`;
}
