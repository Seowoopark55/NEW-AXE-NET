export function renderAssetsView(root, state, actions) {
  const asset = state.assets;
  const auth = state.auth;
  const members = state.members.items || [];
  const isAdmin = Boolean(auth.admin);
  const canReadAccounts = Boolean(auth.member || auth.admin);

  root.innerHTML = `
    <section class="ops-assets">
      <header class="ops-assets__head">
        <div>
          <span class="ops-assets__eyebrow">ASSETS & ACCOUNTS</span>
          <h1>자산 · 계좌</h1>
          <p>플리카 계좌와 회사 자산을 한 곳에서 확인하고 관리합니다.</p>
        </div>
        <button class="ops-assets-btn" type="button" data-assets-refresh ${asset.loading ? 'disabled' : ''}>${asset.loading ? '불러오는 중…' : '새로고침'}</button>
      </header>

      <nav class="ops-assets-tabs" aria-label="자산 계좌 메뉴">
        ${tabButton('accounts', '플리카 계좌', asset.tab)}
        ${isAdmin ? tabButton('company', '회사 자산', asset.tab) : ''}
        ${isAdmin ? tabButton('returns', '반납 내역', asset.tab) : ''}
      </nav>

      ${asset.error ? `<div class="ops-assets-alert ops-assets-alert--error">${h(asset.error)}</div>` : ''}
      ${asset.message ? `<div class="ops-assets-alert ops-assets-alert--success">${h(asset.message)}</div>` : ''}
      ${asset.tab === 'accounts' ? renderAccounts(asset, auth, members, canReadAccounts, isAdmin) : ''}
      ${asset.tab === 'company' && isAdmin ? renderCompanyAssets(asset, members) : ''}
      ${asset.tab === 'returns' && isAdmin ? renderReturns(asset, members) : ''}
      ${asset.tab !== 'accounts' && !isAdmin ? renderAdminOnly() : ''}
      ${renderModal(asset, auth, members)}
    </section>
  `;

  bindEvents(root, actions);
}

function renderAccounts(asset, auth, members, canReadAccounts, isAdmin) {
  if (!canReadAccounts) {
    return `
      <section class="ops-assets-gate">
        <div class="ops-assets-gate__icon">₩</div>
        <h2>플리카 계좌는 로그인 후 확인할 수 있습니다.</h2>
        <p>계좌번호는 공개 화면에 노출하지 않습니다. 일반 팀원 로그인 또는 관리자 인증 후 이용하세요.</p>
        <button class="ops-assets-btn ops-assets-btn--gold" type="button" data-assets-login>멤버 로그인</button>
      </section>
    `;
  }

  const memberMap = mapMembers(members);
  const keyword = normalize(asset.filters.accountSearch);
  const accounts = asset.accounts
    .map((row) => ({ ...row, nickname: row.nickname || memberMap.get(row.member_key)?.nickname || row.member_key }))
    .filter((row) => !keyword || normalize(`${row.nickname} ${row.account} ${row.note || ''}`).includes(keyword));
  const pending = (asset.adminRequests || []).filter((row) => row.status === 'pending');
  const ownPending = (asset.ownRequests || []).find((row) => row.status === 'pending');

  return `
    <section class="ops-assets-panel">
      <div class="ops-assets-toolbar">
        <label class="ops-assets-search">
          <span>계좌 검색</span>
          <input type="search" value="${a(asset.filters.accountSearch)}" placeholder="멤버명 또는 계좌번호" data-assets-search="accountSearch" />
        </label>
        <div class="ops-assets-toolbar__meta"><strong>${accounts.length}</strong><span>등록 계좌</span></div>
        <div class="ops-assets-toolbar__actions">
          ${auth.member ? `<button class="ops-assets-btn" type="button" data-assets-open="member-request">${ownPending ? '신청 확인' : '내 계좌 등록·변경 신청'}</button>` : ''}
          ${isAdmin ? `<button class="ops-assets-btn ops-assets-btn--gold" type="button" data-assets-open="account">계좌 직접 등록</button>` : ''}
        </div>
      </div>

      <div class="ops-assets-account-list">
        ${accounts.length ? accounts.map((row) => accountRow(row, isAdmin)).join('') : empty('등록된 플리카 계좌가 없습니다.')}
      </div>
    </section>

    ${auth.member ? renderOwnRequests(asset.ownRequests) : ''}
    ${isAdmin ? renderAdminRequests(pending) : ''}
  `;
}

function accountRow(row, isAdmin) {
  return `
    <article class="ops-assets-account-row ${row.enabled === false ? 'is-disabled' : ''}">
      <div class="ops-assets-account-row__member">
        <span>${h(row.nickname || row.member_key)}</span>
        ${row.enabled === false ? '<small>사용중지</small>' : ''}
      </div>
      <button class="ops-assets-account-number" type="button" data-assets-copy="${a(row.account)}" title="계좌번호 복사">${h(row.account)}</button>
      <button class="ops-assets-copy" type="button" data-assets-copy="${a(row.account)}">복사</button>
      ${row.note ? `<small class="ops-assets-account-note">${h(row.note)}</small>` : '<small class="ops-assets-account-note">—</small>'}
      ${isAdmin ? `<button class="ops-assets-row-action" type="button" data-assets-edit-account="${a(row.member_key)}">관리</button>` : ''}
    </article>
  `;
}

function renderOwnRequests(requests = []) {
  if (!requests.length) return '';
  return `
    <section class="ops-assets-panel ops-assets-panel--compact">
      <div class="ops-assets-section-title"><div><h2>내 계좌 신청</h2><p>최근 신청 처리 상태입니다.</p></div></div>
      <div class="ops-assets-request-list">
        ${requests.slice(0, 5).map((row) => `
          <article class="ops-assets-request-row">
            <div><strong>${h(row.account)}</strong><small>${dateTime(row.created_at)}</small></div>
            ${statusBadge(row.status)}
            <p>${h(row.review_note || row.note || '메모 없음')}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderAdminRequests(requests = []) {
  return `
    <section class="ops-assets-panel ops-assets-panel--compact">
      <div class="ops-assets-section-title">
        <div><h2>계좌 등록 신청</h2><p>팀원의 계좌 등록·변경 신청을 검수합니다.</p></div>
        <span class="ops-assets-count">대기 ${requests.length}</span>
      </div>
      <div class="ops-assets-request-list">
        ${requests.length ? requests.map((row) => `
          <article class="ops-assets-request-row ops-assets-request-row--admin">
            <div><strong>${h(row.nickname)}</strong><small>${dateTime(row.created_at)}</small></div>
            <button class="ops-assets-account-number" type="button" data-assets-copy="${a(row.account)}">${h(row.account)}</button>
            <p>${h(row.note || '메모 없음')}</p>
            <div class="ops-assets-request-actions">
              <button type="button" class="ops-assets-btn ops-assets-btn--small ops-assets-btn--gold" data-assets-review="approve" data-request-id="${Number(row.id)}">승인</button>
              <button type="button" class="ops-assets-btn ops-assets-btn--small ops-assets-btn--danger" data-assets-review="reject" data-request-id="${Number(row.id)}">반려</button>
            </div>
          </article>
        `).join('') : empty('검수 대기 중인 계좌 신청이 없습니다.')}
      </div>
    </section>
  `;
}

function renderCompanyAssets(asset) {
  const keyword = normalize(asset.filters.assetSearch);
  const category = asset.filters.assetCategory;
  const status = asset.filters.assetStatus;
  const categories = unique(asset.companyAssets.map((row) => row.asset_category));
  const statuses = unique(asset.companyAssets.map((row) => row.status));
  const list = asset.companyAssets.filter((row) => {
    if (category !== 'all' && row.asset_category !== category) return false;
    if (status !== 'all' && row.status !== status) return false;
    if (keyword && !normalize(Object.values(row).join(' ')).includes(keyword)) return false;
    return true;
  });
  const held = asset.companyAssets.filter((row) => String(row.status || '').includes('보유')).length;
  const totalCost = asset.companyAssets.reduce((sum, row) => sum + Number(row.personal_cost || 0), 0);

  return `
    <section class="ops-assets-panel">
      <div class="ops-assets-summary">
        ${summaryCard(asset.companyAssets.length, '총 자산')}
        ${summaryCard(held, '보유')}
        ${summaryCard(categories.length, '분류')}
        ${summaryCard(formatMoney(totalCost), '개인 부담 합계')}
      </div>
      <div class="ops-assets-toolbar ops-assets-toolbar--filters">
        ${selectFilter('assetCategory', asset.filters.assetCategory, '자산 분류', categories)}
        ${selectFilter('assetStatus', asset.filters.assetStatus, '현재 상태', statuses)}
        <label class="ops-assets-search"><span>검색</span><input type="search" value="${a(asset.filters.assetSearch)}" placeholder="이름, 자산명, 획득 방식" data-assets-search="assetSearch" /></label>
        <div class="ops-assets-toolbar__actions"><button class="ops-assets-btn ops-assets-btn--gold" type="button" data-assets-open="asset">자산 추가</button></div>
      </div>

      <div class="ops-assets-table-wrap">
        <table class="ops-assets-table">
          <thead><tr><th>번호</th><th>보유자</th><th>분류</th><th>자산명</th><th>획득 방식</th><th>취득일</th><th>개인 부담</th><th>상태</th><th>비고</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(assetTableRow).join('') : `<tr><td colspan="10">${empty('표시할 회사 자산이 없습니다.')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function assetTableRow(row) {
  return `<tr>
    <td>${h(row.legacy_no || row.id)}</td>
    <td><strong>${h(row.owner_name)}</strong></td>
    <td><span class="ops-assets-pill">${h(row.asset_category)}</span></td>
    <td>${h(row.asset_name)}</td>
    <td>${h(row.acquisition_method || '—')}</td>
    <td>${h(row.acquired_at || '—')}</td>
    <td>${row.personal_cost == null ? '—' : `${formatMoney(row.personal_cost)}$`}</td>
    <td>${assetStatusBadge(row.status)}</td>
    <td class="ops-assets-table__note">${h(row.note || '—')}</td>
    <td><button class="ops-assets-row-action" type="button" data-assets-edit-asset="${Number(row.id)}">관리</button></td>
  </tr>`;
}

function renderReturns(asset) {
  const keyword = normalize(asset.filters.returnSearch);
  const status = asset.filters.returnStatus;
  const list = asset.returns.filter((row) => {
    if (status === 'done' && !row.returned) return false;
    if (status === 'wait' && row.returned) return false;
    if (keyword && !normalize(Object.values(row).join(' ')).includes(keyword)) return false;
    return true;
  });
  const done = asset.returns.filter((row) => row.returned).length;

  return `
    <section class="ops-assets-panel">
      <div class="ops-assets-summary">
        ${summaryCard(asset.returns.length, '총 기록')}
        ${summaryCard(done, '반납완료')}
        ${summaryCard(asset.returns.length - done, '확인대기')}
        ${summaryCard(list.length, '표시중')}
      </div>
      <div class="ops-assets-toolbar ops-assets-toolbar--filters">
        <label class="ops-assets-field"><span>상태</span><select data-assets-filter="returnStatus"><option value="all" ${status === 'all' ? 'selected' : ''}>전체</option><option value="done" ${status === 'done' ? 'selected' : ''}>반납완료</option><option value="wait" ${status === 'wait' ? 'selected' : ''}>확인대기</option></select></label>
        <label class="ops-assets-search"><span>검색</span><input type="search" value="${a(asset.filters.returnSearch)}" placeholder="이름, 자산명, 확인자" data-assets-search="returnSearch" /></label>
        <div class="ops-assets-toolbar__actions"><button class="ops-assets-btn ops-assets-btn--gold" type="button" data-assets-open="return">반납 기록 추가</button></div>
      </div>

      <div class="ops-assets-table-wrap">
        <table class="ops-assets-table ops-assets-table--returns">
          <thead><tr><th>번호</th><th>이름</th><th>자산명</th><th>반납 확인</th><th>확인자</th><th>처리일</th><th>비고</th><th></th></tr></thead>
          <tbody>${list.length ? list.map(returnTableRow).join('') : `<tr><td colspan="8">${empty('표시할 반납 내역이 없습니다.')}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function returnTableRow(row) {
  return `<tr>
    <td>${h(row.legacy_no || row.id)}</td><td><strong>${h(row.owner_name)}</strong></td><td>${h(row.asset_name)}</td>
    <td>${row.returned ? '<span class="ops-assets-badge is-ok">반납완료</span>' : '<span class="ops-assets-badge is-wait">확인대기</span>'}</td>
    <td>${h(row.checker || '—')}</td><td>${h(row.processed_at || '—')}</td><td class="ops-assets-table__note">${h(row.note || '—')}</td>
    <td><button class="ops-assets-row-action" type="button" data-assets-edit-return="${Number(row.id)}">관리</button></td>
  </tr>`;
}

function renderModal(asset, auth, members) {
  const modal = asset.modal || {};
  if (!modal.type) return '';
  const item = modalItem(asset, modal);
  let content = '';
  if (modal.type === 'member-request') content = memberRequestForm(auth, asset, item);
  if (modal.type === 'account') content = accountForm(members, item);
  if (modal.type === 'asset') content = assetForm(members, item);
  if (modal.type === 'return') content = returnForm(members, asset.companyAssets, item);
  if (!content) return '';

  return `
    <div class="ops-assets-modal-backdrop" data-assets-modal-close>
      <section class="ops-assets-modal" role="dialog" aria-modal="true" data-assets-modal-panel>
        <header><div><span>${modalKicker(modal.type)}</span><h2>${modalTitle(modal.type, Boolean(item))}</h2></div><button type="button" data-assets-modal-close>×</button></header>
        ${modal.error ? `<div class="ops-assets-alert ops-assets-alert--error">${h(modal.error)}</div>` : ''}
        ${content}
      </section>
    </div>
  `;
}

function memberRequestForm(auth, asset) {
  const pending = (asset.ownRequests || []).find((row) => row.status === 'pending');
  const own = asset.accounts.find((row) => row.member_key === auth.member?.member_key);
  return `
    ${pending ? `<div class="ops-assets-pending-box"><strong>현재 검수대기 중입니다.</strong><span>${h(pending.account)}</span><small>${dateTime(pending.created_at)}</small></div>` : ''}
    <form class="ops-assets-form" data-assets-form="member-request">
      <label><span>멤버</span><input value="${a(auth.member?.nickname || '')}" disabled /></label>
      <label><span>계좌번호</span><input name="account" value="${a(pending?.account || own?.account || '')}" required autocomplete="off" /></label>
      <label class="is-wide"><span>메모</span><textarea name="note" rows="3" placeholder="변경 사유나 참고사항이 있으면 입력하세요.">${h(pending?.note || '')}</textarea></label>
      <div class="ops-assets-form__actions"><button class="ops-assets-btn" type="button" data-assets-modal-close>취소</button><button class="ops-assets-btn ops-assets-btn--gold" type="submit" ${pending || asset.modal.saving ? 'disabled' : ''}>${pending ? '처리 대기 중' : (asset.modal.saving ? '신청 중…' : '신청 접수')}</button></div>
    </form>
  `;
}

function accountForm(members, item) {
  const selectedKey = item?.member_key || '';
  return `
    <form class="ops-assets-form" data-assets-form="account">
      <label class="is-wide"><span>멤버</span>${item ? `<input value="${a(memberName(members, selectedKey))}" disabled /><input type="hidden" name="member_key" value="${a(selectedKey)}" />` : memberSelect(members, selectedKey, 'member_key', true)}</label>
      <label class="is-wide"><span>계좌번호</span><input name="account" value="${a(item?.account || '')}" required autocomplete="off" /></label>
      <label class="is-wide"><span>메모</span><textarea name="note" rows="3">${h(item?.note || '')}</textarea></label>
      <label class="ops-assets-check"><input type="checkbox" name="enabled" ${item?.enabled === false ? '' : 'checked'} /><span>사용 중</span></label>
      <div class="ops-assets-form__actions">
        ${item ? `<button class="ops-assets-btn ops-assets-btn--danger" type="button" data-assets-deactivate-account="${a(item.member_key)}">사용중지</button>` : '<span></span>'}
        <div><button class="ops-assets-btn" type="button" data-assets-modal-close>취소</button><button class="ops-assets-btn ops-assets-btn--gold" type="submit">저장</button></div>
      </div>
    </form>`;
}

function assetForm(members, item) {
  return `
    <form class="ops-assets-form" data-assets-form="asset">
      <input type="hidden" name="id" value="${a(item?.id || '')}" />
      <label><span>번호</span><input name="legacy_no" value="${a(item?.legacy_no || '')}" placeholder="선택" /></label>
      <label><span>멤버 연결</span>${memberSelect(members, item?.member_key || '', 'member_key', false, true)}</label>
      <label><span>보유자</span><input name="owner_name" value="${a(item?.owner_name || '')}" required data-assets-owner-input /></label>
      <label><span>자산 분류</span><input name="asset_category" value="${a(item?.asset_category || '')}" placeholder="차량 / 장비 / 기타" required /></label>
      <label class="is-wide"><span>자산명</span><input name="asset_name" value="${a(item?.asset_name || '')}" required /></label>
      <label><span>획득 방식</span><input name="acquisition_method" value="${a(item?.acquisition_method || '')}" /></label>
      <label><span>취득일</span><input type="date" name="acquired_at" value="${a(item?.acquired_at || '')}" /></label>
      <label><span>개인 부담 비용</span><input type="number" min="0" step="1" name="personal_cost" value="${a(item?.personal_cost ?? '')}" /></label>
      <label><span>현재 상태</span><input name="status" value="${a(item?.status || '보유')}" required /></label>
      <label class="is-wide"><span>비고</span><textarea name="note" rows="3">${h(item?.note || '')}</textarea></label>
      <div class="ops-assets-form__actions">
        ${item ? `<button class="ops-assets-btn ops-assets-btn--danger" type="button" data-assets-deactivate-asset="${Number(item.id)}">목록에서 내리기</button>` : '<span></span>'}
        <div><button class="ops-assets-btn" type="button" data-assets-modal-close>취소</button><button class="ops-assets-btn ops-assets-btn--gold" type="submit">저장</button></div>
      </div>
    </form>`;
}

function returnForm(members, assets, item) {
  return `
    <form class="ops-assets-form" data-assets-form="return">
      <input type="hidden" name="id" value="${a(item?.id || '')}" />
      <label><span>번호</span><input name="legacy_no" value="${a(item?.legacy_no || '')}" placeholder="선택" /></label>
      <label><span>연결 자산</span><select name="asset_id" data-assets-linked-asset><option value="">직접 입력</option>${assets.map((row) => `<option value="${Number(row.id)}" data-owner="${a(row.owner_name)}" data-member-key="${a(row.member_key || '')}" data-asset-name="${a(row.asset_name)}" ${Number(item?.asset_id) === Number(row.id) ? 'selected' : ''}>${h(row.owner_name)} · ${h(row.asset_name)}</option>`).join('')}</select></label>
      <label><span>멤버 연결</span>${memberSelect(members, item?.member_key || '', 'member_key', false, true)}</label>
      <label><span>이름</span><input name="owner_name" value="${a(item?.owner_name || '')}" required data-assets-return-owner /></label>
      <label class="is-wide"><span>자산명</span><input name="asset_name" value="${a(item?.asset_name || '')}" required data-assets-return-name /></label>
      <label class="ops-assets-check"><input type="checkbox" name="returned" ${item?.returned ? 'checked' : ''} /><span>반납 확인</span></label>
      <label><span>확인자</span><input name="checker" value="${a(item?.checker || '')}" placeholder="완료 시 비우면 관리자명 자동" /></label>
      <label><span>처리일</span><input type="date" name="processed_at" value="${a(item?.processed_at || '')}" /></label>
      <label class="is-wide"><span>비고</span><textarea name="note" rows="3">${h(item?.note || '')}</textarea></label>
      <div class="ops-assets-form__actions">
        ${item ? `<button class="ops-assets-btn ops-assets-btn--danger" type="button" data-assets-deactivate-return="${Number(item.id)}">기록 내리기</button>` : '<span></span>'}
        <div><button class="ops-assets-btn" type="button" data-assets-modal-close>취소</button><button class="ops-assets-btn ops-assets-btn--gold" type="submit">저장</button></div>
      </div>
    </form>`;
}

function bindEvents(root, actions) {
  root.querySelectorAll('[data-assets-tab]').forEach((button) => button.addEventListener('click', () => actions.onTabChange?.(button.dataset.assetsTab)));
  root.querySelector('[data-assets-refresh]')?.addEventListener('click', () => actions.onRefresh?.());
  root.querySelector('[data-assets-login]')?.addEventListener('click', () => actions.onOpenLogin?.());

  root.querySelectorAll('[data-assets-search]').forEach((input) => input.addEventListener('input', () => actions.onFilterChange?.(input.dataset.assetsSearch, input.value)));
  root.querySelectorAll('[data-assets-filter]').forEach((select) => select.addEventListener('change', () => actions.onFilterChange?.(select.dataset.assetsFilter, select.value)));

  root.querySelectorAll('[data-assets-copy]').forEach((button) => button.addEventListener('click', () => actions.onCopy?.(button.dataset.assetsCopy)));
  root.querySelectorAll('[data-assets-open]').forEach((button) => button.addEventListener('click', () => actions.onOpenModal?.(button.dataset.assetsOpen)));
  root.querySelectorAll('[data-assets-edit-account]').forEach((button) => button.addEventListener('click', () => actions.onOpenModal?.('account', button.dataset.assetsEditAccount)));
  root.querySelectorAll('[data-assets-edit-asset]').forEach((button) => button.addEventListener('click', () => actions.onOpenModal?.('asset', Number(button.dataset.assetsEditAsset))));
  root.querySelectorAll('[data-assets-edit-return]').forEach((button) => button.addEventListener('click', () => actions.onOpenModal?.('return', Number(button.dataset.assetsEditReturn))));

  root.querySelectorAll('[data-assets-modal-close]').forEach((element) => element.addEventListener('click', (event) => {
    if (event.currentTarget.hasAttribute('data-assets-modal-panel')) return;
    if (event.target.closest('[data-assets-modal-panel]') && event.currentTarget.classList.contains('ops-assets-modal-backdrop')) return;
    actions.onCloseModal?.();
  }));
  root.querySelector('[data-assets-modal-panel]')?.addEventListener('click', (event) => event.stopPropagation());

  root.querySelectorAll('[data-assets-form]').forEach((form) => form.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"][name]').forEach((input) => { values[input.name] = input.checked; });
    actions.onSubmitModal?.(form.dataset.assetsForm, values);
  }));

  root.querySelectorAll('[data-assets-review]').forEach((button) => button.addEventListener('click', () => actions.onReviewRequest?.(Number(button.dataset.requestId), button.dataset.assetsReview)));
  root.querySelectorAll('[data-assets-deactivate-account]').forEach((button) => button.addEventListener('click', () => actions.onDeactivateAccount?.(button.dataset.assetsDeactivateAccount)));
  root.querySelectorAll('[data-assets-deactivate-asset]').forEach((button) => button.addEventListener('click', () => actions.onDeactivateAsset?.(Number(button.dataset.assetsDeactivateAsset))));
  root.querySelectorAll('[data-assets-deactivate-return]').forEach((button) => button.addEventListener('click', () => actions.onDeactivateReturn?.(Number(button.dataset.assetsDeactivateReturn))));

  root.querySelectorAll('select[data-assets-member-select]').forEach((select) => select.addEventListener('change', () => {
    const option = select.selectedOptions[0];
    const owner = root.querySelector('[data-assets-owner-input]');
    if (owner && option?.dataset.nickname) owner.value = option.dataset.nickname;
  }));

  root.querySelector('[data-assets-linked-asset]')?.addEventListener('change', (event) => {
    const option = event.currentTarget.selectedOptions[0];
    if (!option?.value) return;
    const owner = root.querySelector('[data-assets-return-owner]');
    const name = root.querySelector('[data-assets-return-name]');
    const member = root.querySelector('select[name="member_key"]');
    if (owner) owner.value = option.dataset.owner || '';
    if (name) name.value = option.dataset.assetName || '';
    if (member) member.value = option.dataset.memberKey || '';
  });
}

function modalItem(asset, modal) {
  if (modal.type === 'account' && modal.itemId) return asset.accounts.find((row) => row.member_key === modal.itemId) || null;
  if (modal.type === 'asset' && modal.itemId) return asset.companyAssets.find((row) => Number(row.id) === Number(modal.itemId)) || null;
  if (modal.type === 'return' && modal.itemId) return asset.returns.find((row) => Number(row.id) === Number(modal.itemId)) || null;
  return null;
}

function modalTitle(type, editing) {
  if (type === 'member-request') return '내 플리카 계좌 신청';
  if (type === 'account') return editing ? '플리카 계좌 관리' : '플리카 계좌 직접 등록';
  if (type === 'asset') return editing ? '회사 자산 수정' : '회사 자산 추가';
  return editing ? '반납 기록 수정' : '반납 기록 추가';
}
function modalKicker(type) { return type.includes('account') || type === 'member-request' ? 'PLIKA ACCOUNT' : 'COMPANY ASSET'; }
function tabButton(value, label, current) { return `<button type="button" class="${current === value ? 'is-active' : ''}" data-assets-tab="${value}">${label}</button>`; }
function renderAdminOnly() { return '<section class="ops-assets-gate"><h2>관리자 전용 화면입니다.</h2></section>'; }
function summaryCard(value, label) { return `<div class="ops-assets-summary__card"><strong>${h(value)}</strong><span>${h(label)}</span></div>`; }
function selectFilter(key, selected, label, values) { return `<label class="ops-assets-field"><span>${h(label)}</span><select data-assets-filter="${a(key)}"><option value="all">전체</option>${values.map((v) => `<option value="${a(v)}" ${selected === v ? 'selected' : ''}>${h(v)}</option>`).join('')}</select></label>`; }
function memberSelect(members, selected, name, required = false, syncOwner = false) { return `<select name="${a(name)}" ${required ? 'required' : ''} ${syncOwner ? 'data-assets-member-select' : ''}><option value="">${required ? '멤버 선택' : '연결 안 함'}</option>${members.map((m) => `<option value="${a(m.member_key)}" data-nickname="${a(m.nickname)}" ${m.member_key === selected ? 'selected' : ''}>${h(m.nickname)}${m.status !== 'active' ? ` · ${h(m.status)}` : ''}</option>`).join('')}</select>`; }
function memberName(members, key) { return members.find((m) => m.member_key === key)?.nickname || key || ''; }
function mapMembers(members) { return new Map(members.map((m) => [m.member_key, m])); }
function unique(values) { return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')); }
function normalize(value) { return String(value || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function formatMoney(value) { return Number(value || 0).toLocaleString('ko-KR'); }
function dateTime(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? h(value) : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date); }
function statusBadge(status) { const key = status === 'approved' ? 'is-ok' : status === 'rejected' ? 'is-danger' : 'is-wait'; const label = status === 'approved' ? '승인' : status === 'rejected' ? '반려' : '검수대기'; return `<span class="ops-assets-badge ${key}">${label}</span>`; }
function assetStatusBadge(status) { const text = String(status || '—'); const cls = text.includes('보유') ? 'is-ok' : (text.includes('반납') || text.includes('처분') || text.includes('미배정')) ? 'is-muted' : 'is-wait'; return `<span class="ops-assets-badge ${cls}">${h(text)}</span>`; }
function empty(message) { return `<div class="ops-assets-empty">${h(message)}</div>`; }
function h(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function a(value) { return h(value).replace(/`/g, '&#96;'); }
