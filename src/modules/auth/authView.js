export function renderAuthView(root, auth, actions = {}) {
  if (!root) return;

  // Auth state updates re-render this root. Preserve the in-flight form values so
  // the browser password manager cannot briefly replace a member nickname with
  // a saved admin e-mail while the login button changes to "확인 중...".
  const memberDraft = readFormDraft(root.querySelector('[data-member-login-form]'), ['member_nickname', 'member_password']);
  const adminDraft = readFormDraft(root.querySelector('[data-admin-login-form]'), ['admin_email', 'admin_password']);

  root.innerHTML = `
    <div class="auth-control">
      ${renderAuthButton(auth)}
    </div>
    ${auth.loginOpen ? renderLoginModal(auth) : ''}
  `;

  restoreFormDraft(root.querySelector('[data-member-login-form]'), memberDraft);
  restoreFormDraft(root.querySelector('[data-admin-login-form]'), adminDraft);

  // Chrome may still group all saved credentials by origin even when each form
  // uses a different autocomplete section. Keep the password manager enabled,
  // but reject only a cross-filled identity (admin e-mail in member login or
  // member nickname in admin login). Manually typed values are never touched.
  installCrossCredentialAutofillGuard(root.querySelector('[data-member-login-form]'), 'member');
  installCrossCredentialAutofillGuard(root.querySelector('[data-admin-login-form]'), 'admin');

  root.querySelector('[data-open-login]')?.addEventListener('click', () => {
    actions.onOpenLogin?.('member');
  });

  root.querySelector('[data-open-admin-login]')?.addEventListener('click', () => {
    actions.onOpenLogin?.('admin');
  });

  root.querySelectorAll('[data-close-login]').forEach((element) => {
    element.addEventListener('click', () => actions.onCloseLogin?.());
  });

  root.querySelector('[data-auth-logout]')?.addEventListener('click', () => {
    actions.onLogout?.();
  });

  root.querySelectorAll('[data-login-mode]').forEach((button) => {
    button.addEventListener('click', () => actions.onLoginModeChange?.(button.dataset.loginMode));
  });

  const memberForm = root.querySelector('[data-member-login-form]');
  memberForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(memberForm);
    actions.onMemberLogin?.({
      nickname: String(formData.get('member_nickname') ?? '').trim(),
      password: String(formData.get('member_password') ?? ''),
    });
  });

  const adminForm = root.querySelector('[data-admin-login-form]');
  adminForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(adminForm);
    actions.onAdminLogin?.({
      email: String(formData.get('admin_email') ?? '').trim(),
      password: String(formData.get('admin_password') ?? ''),
    });
  });
}

function renderAuthButton(auth) {
  if (!auth.initialized) {
    return '<span class="auth-pill auth-pill--muted">ACCOUNT CHECKING</span>';
  }

  if (auth.admin) {
    return `
      <div class="auth-signed-in auth-signed-in--admin">
        <div class="auth-signed-in__text">
          <span>${auth.admin.admin_level === 'operator' ? '운영진' : '최고관리자'}</span>
          <strong>${escapeHtml(auth.admin.nickname)}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  if (auth.member) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span>멤버</span>
          <strong>${escapeHtml(auth.member.nickname)}</strong>
        </div>
        <button class="auth-admin-upgrade" type="button" data-open-admin-login>관리자</button>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  if (auth.user && !auth.admin) {
    return `
      <div class="auth-signed-in">
        <div class="auth-signed-in__text">
          <span class="auth-denied">관리자 연결 없음</span>
          <strong>${escapeHtml(auth.user.email ?? 'Authenticated')}</strong>
        </div>
        <button class="auth-logout" type="button" data-auth-logout>로그아웃</button>
      </div>
    `;
  }

  return `
    <button class="auth-login-button" type="button" data-open-login>
      로그인
    </button>
  `;
}

function renderLoginModal(auth) {
  const mode = auth.loginMode === 'admin' ? 'admin' : 'member';

  return `
    <div class="auth-modal-backdrop" data-close-login></div>

    <section class="auth-modal" role="dialog" aria-modal="true" aria-label="AXE NET 로그인">
      <div class="auth-modal__header">
        <div>
          <span>AXE ACCOUNT</span>
          <h3>${mode === 'member' ? 'AXE NET 로그인' : '관리자 인증'}</h3>
          <p>${mode === 'member'
            ? 'AXE NET에서 사용 중인 닉네임과 비밀번호로 로그인합니다. 운영진 권한도 이 로그인으로 자동 적용됩니다.'
            : '최고관리자용 Supabase Auth 인증입니다. 일반 운영진은 멤버 로그인만 사용하면 됩니다.'}</p>
        </div>

        <button type="button" class="auth-modal__close" data-close-login aria-label="닫기">×</button>
      </div>

      <div class="auth-mode-tabs" role="tablist" aria-label="로그인 종류">
        <button class="${mode === 'member' ? 'active' : ''}" type="button" data-login-mode="member">멤버 로그인</button>
        <button class="${mode === 'admin' ? 'active' : ''}" type="button" data-login-mode="admin">관리자 인증</button>
      </div>

      ${mode === 'member' ? renderMemberLoginForm(auth) : renderAdminLoginForm(auth)}
    </section>
  `;
}

function renderMemberLoginForm(auth) {
  return `
    <form class="auth-form" id="axe-member-login-form" name="axe-member-login" autocomplete="on" data-member-login-form>
      <label for="axe-member-nickname">
        <span>닉네임</span>
        <input
          id="axe-member-nickname"
          name="member_nickname"
          autocomplete="section-axe-member username"
          autocapitalize="off"
          spellcheck="false"
          placeholder="AXE NET 닉네임"
          required
        />
      </label>

      <label for="axe-member-password">
        <span>비밀번호</span>
        <input
          id="axe-member-password"
          type="password"
          name="member_password"
          autocomplete="section-axe-member current-password"
          required
        />
      </label>

      ${auth.error ? `<div class="auth-form__error">${escapeHtml(auth.error)}</div>` : ''}

      <button class="auth-form__submit" type="submit" ${auth.loading ? 'disabled' : ''}>
        ${auth.loading ? '확인 중...' : '로그인'}
      </button>

      <div class="auth-form__help">
        로그인 후 공금납부·내 제출에서 Discord 숫자 ID를 다시 입력하지 않습니다.
      </div>
    </form>
  `;
}

function renderAdminLoginForm(auth) {
  return `
    <form class="auth-form" id="axe-admin-login-form" name="axe-admin-login" autocomplete="on" data-admin-login-form>
      <label for="axe-admin-email">
        <span>이메일</span>
        <input
          id="axe-admin-email"
          type="email"
          name="admin_email"
          autocomplete="section-axe-admin username"
          autocapitalize="off"
          spellcheck="false"
          placeholder="admin@example.com"
          required
        />
      </label>

      <label for="axe-admin-password">
        <span>비밀번호</span>
        <input
          id="axe-admin-password"
          type="password"
          name="admin_password"
          autocomplete="section-axe-admin current-password"
          required
        />
      </label>

      ${auth.error ? `<div class="auth-form__error">${escapeHtml(auth.error)}</div>` : ''}

      <button class="auth-form__submit" type="submit" ${auth.loading ? 'disabled' : ''}>
        ${auth.loading ? '확인 중...' : '관리자 인증'}
      </button>
    </form>
  `;
}


function installCrossCredentialAutofillGuard(form, mode) {
  if (!form) return;

  const identityName = mode === 'admin' ? 'admin_email' : 'member_nickname';
  const passwordName = mode === 'admin' ? 'admin_password' : 'member_password';
  const identity = form.elements?.namedItem(identityName);
  const password = form.elements?.namedItem(passwordName);

  if (!(identity instanceof HTMLInputElement)) return;

  const sanitizeAutofill = () => {
    if (!isBrowserAutofilled(identity)) return;

    const value = String(identity.value || '').trim();
    if (!value) return;

    const crossFilled = mode === 'admin'
      ? !looksLikeEmail(value)
      : looksLikeEmail(value);

    if (!crossFilled) return;

    identity.value = '';
    if (password instanceof HTMLInputElement) password.value = '';
  };

  // Password managers can inject values just after paint or after selecting a
  // saved account. Check several short windows, but only act on :-webkit-autofill.
  [0, 80, 240, 700, 1400].forEach((delay) => {
    window.setTimeout(sanitizeAutofill, delay);
  });

  identity.addEventListener('input', () => {
    window.setTimeout(sanitizeAutofill, 0);
    window.setTimeout(sanitizeAutofill, 80);
  });
}

function isBrowserAutofilled(input) {
  try {
    return input.matches(':-webkit-autofill');
  } catch {
    return false;
  }
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function readFormDraft(form, fields) {
  if (!form) return null;
  const draft = {};
  for (const field of fields) {
    const input = form.elements?.namedItem(field);
    if (input && typeof input.value === 'string') draft[field] = input.value;
  }
  return draft;
}

function restoreFormDraft(form, draft) {
  if (!form || !draft) return;
  for (const [field, value] of Object.entries(draft)) {
    const input = form.elements?.namedItem(field);
    if (input && typeof input.value === 'string') input.value = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
