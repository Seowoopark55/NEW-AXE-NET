import { store } from '../../state/store.js';
import {
  fetchAdminSession,
  getCurrentSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
} from './authService.js';
import {
  restoreMemberSession,
  signInMember,
  signOutMember,
} from './memberAuthService.js';
import { renderAuthView } from './authView.js';

export async function initAuthModule() {
  const root = document.querySelector('#auth-root');
  if (!root) throw new Error('#auth-root element not found.');

  const render = () => {
    renderAuthView(root, store.getState().auth, {
      onOpenLogin(mode = 'member') {
        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loginOpen: true,
            loginMode: mode,
            error: null,
          },
        }));
      },

      onCloseLogin() {
        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loginOpen: false,
            error: null,
          },
        }));
      },

      onLoginModeChange(mode) {
        store.updateState((state) => ({
          ...state,
          auth: {
            ...state.auth,
            loginMode: mode === 'admin' ? 'admin' : 'member',
            error: null,
          },
        }));
      },

      async onMemberLogin({ nickname, password }) {
        if (!nickname || !password) return;
        setAuthLoading(true);

        try {
          const session = await signInMember(nickname, password);
          store.updateState((state) => ({
            ...state,
            auth: {
              ...state.auth,
              initialized: true,
              loading: false,
              member: session.member,
              memberSessionExpiresAt: session.expires_at,
              error: null,
              loginOpen: false,
            },
          }));
        } catch (error) {
          setAuthError(translateMemberAuthError(error));
        }
      },

      async onAdminLogin({ email, password }) {
        if (!email || !password) return;
        setAuthLoading(true);

        try {
          const session = await signInWithPassword(email, password);
          await applyAdminSession(session, { closeLogin: true });
        } catch (error) {
          setAuthError(translateAdminAuthError(error));
        }
      },

      async onLogout() {
        const current = store.getState().auth;
        const tasks = [];
        if (current.user) tasks.push(signOut());
        if (current.member) tasks.push(signOutMember());

        try {
          await Promise.allSettled(tasks);
        } finally {
          await applyAdminSession(null);
          store.updateState((state) => ({
            ...state,
            auth: {
              ...state.auth,
              initialized: true,
              loading: false,
              member: null,
              memberSessionExpiresAt: null,
              error: null,
              loginOpen: false,
            },
          }));
        }
      },
    });
  };

  render();
  store.subscribe(render);

  const [adminSessionResult, memberSessionResult] = await Promise.allSettled([
    getCurrentSession(),
    restoreMemberSession(),
  ]);

  const adminSession = adminSessionResult.status === 'fulfilled' ? adminSessionResult.value : null;
  const memberSession = memberSessionResult.status === 'fulfilled' ? memberSessionResult.value : null;

  if (adminSessionResult.status === 'rejected') {
    console.error('[NEW AXE NET] admin session restore failed:', adminSessionResult.reason);
  }
  if (memberSessionResult.status === 'rejected') {
    console.error('[NEW AXE NET] member session restore failed:', memberSessionResult.reason);
  }

  await applyAdminSession(adminSession, { suppressInitialized: true });

  store.updateState((state) => ({
    ...state,
    auth: {
      ...state.auth,
      initialized: true,
      member: memberSession?.member ?? null,
      memberSessionExpiresAt: memberSession?.expires_at ?? null,
      error: null,
    },
  }));

  onAuthStateChange(async (nextSession) => {
    await applyAdminSession(nextSession);
  });
}

async function applyAdminSession(session, options = {}) {
  const user = session?.user ?? null;
  let admin = null;
  let error = null;

  if (user) {
    try {
      admin = await fetchAdminSession();
    } catch (adminError) {
      console.error('[NEW AXE NET] admin session lookup failed:', adminError);
      error = adminError?.message ?? String(adminError);
    }
  }

  store.updateState((state) => ({
    ...state,
    auth: {
      ...state.auth,
      initialized: options.suppressInitialized ? state.auth.initialized : true,
      loading: false,
      user,
      admin,
      error,
      loginOpen: options.closeLogin ? false : state.auth.loginOpen,
    },
  }));
}

function setAuthLoading(loading) {
  store.updateState((state) => ({
    ...state,
    auth: { ...state.auth, loading, error: null },
  }));
}

function setAuthError(error) {
  store.updateState((state) => ({
    ...state,
    auth: { ...state.auth, loading: false, error },
  }));
}

function translateAdminAuthError(error) {
  const message = error?.message ?? String(error);
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (lower.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않은 계정입니다.';
  }
  return message;
}

function translateMemberAuthError(error) {
  const message = error?.message ?? String(error);
  if (error?.status === 404) return '로그인 API를 찾을 수 없습니다. Vercel 재배포 상태를 확인하세요.';
  return message;
}
