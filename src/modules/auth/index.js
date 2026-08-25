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
              loading: Boolean(session.admin_bridge?.auto_signin),
              member: session.member,
              memberSessionExpiresAt: session.expires_at,
              error: session.admin_bridge?.mode === 'error' ? session.admin_bridge.message : null,
              loginOpen: false,
            },
          }));

          // role=admin 멤버는 별도 이메일 입력 없이 내부 Auth 계정으로 자동 승격합니다.
          // 최고관리자처럼 기존 외부 admin_accounts가 연결된 계정은 기존 이메일 인증을 그대로 유지합니다.
          if (session.admin_bridge?.auto_signin && session.admin_bridge?.email) {
            try {
              const adminSession = await signInWithPassword(session.admin_bridge.email, session.admin_bridge.secret);
              await applyAdminSession(adminSession, { closeLogin: true });
            } catch (adminError) {
              console.error('[AXE NET] member admin auto sign-in failed:', adminError);
              store.updateState((state) => ({
                ...state,
                auth: {
                  ...state.auth,
                  loading: false,
                  error: '멤버 로그인은 완료됐지만 관리자 권한 자동 연결에 실패했습니다. 최고관리자에게 문의하세요.',
                },
              }));
            }
          }
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

  // 관리자 세션 + 관리자 프로필 조회를 멤버 세션 검증과 병렬로 처리합니다.
  const adminSessionTask = (async () => {
    try {
      const session = await getCurrentSession();
      await applyAdminSession(session, { suppressInitialized: true });
      return session;
    } catch (error) {
      console.error('[AXE NET] admin session restore failed:', error);
      return null;
    }
  })();

  const memberSessionTask = (async () => {
    try {
      return await restoreMemberSession();
    } catch (error) {
      console.error('[AXE NET] member session restore failed:', error);
      return null;
    }
  })();

  const [, memberSession] = await Promise.all([
    adminSessionTask,
    memberSessionTask,
  ]);

  store.updateState((state) => ({
    ...state,
    auth: {
      ...state.auth,
      initialized: true,
      member: memberSession?.member ?? null,
      memberSessionExpiresAt: memberSession?.expires_at ?? null,
      error: state.auth.error,
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
      console.error('[AXE NET] admin session lookup failed:', adminError);
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
