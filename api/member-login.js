import {
  createMemberSession,
  ensureMemberAdminBridge,
  getMemberLoginTarget,
  invalidMemberLoginError,
  normalizeApiError,
  onlyPost,
  publicMember,
  readBody,
  sendJson,
  setMemberSessionCookie,
  touchMemberLogin,
  verifyMemberCredentials,
} from '../server/memberSession.js';

export default async function handler(req, res) {
  if (!onlyPost(req, res)) return;

  try {
    const body = await readBody(req);
    const nickname = String(body.nickname || '').trim();
    const password = String(body.password || '');

    if (!nickname || !password) {
      return sendJson(res, 400, {
        ok: false,
        message: '닉네임과 비밀번호를 입력하세요.',
      });
    }

    const target = await getMemberLoginTarget(nickname);
    if (!target?.member) {
      throw invalidMemberLoginError();
    }

    if (!target.has_credential) {
      throw invalidMemberLoginError('로그인 정보가 설정되지 않았습니다. 관리자에게 문의하세요.');
    }

    const member = await verifyMemberCredentials(nickname, password);
    if (!member) throw invalidMemberLoginError();

    let adminBridge = null;
    if (String(member.role || '').toLowerCase() === 'admin') {
      try {
        adminBridge = await ensureMemberAdminBridge(member, password);
      } catch (bridgeError) {
        console.error('[AXE NET] member admin bridge failed:', bridgeError);
        adminBridge = {
          mode: 'error',
          auto_signin: false,
          message: '관리자 권한 자동 연결에 실패했습니다. 최고관리자에게 문의하세요.',
        };
      }
    }

    const session = await createMemberSession(member);
    await touchMemberLogin(member.member_key);
    setMemberSessionCookie(req, res, session.token, session.expires_at);

    return sendJson(res, 200, {
      ok: true,
      expires_at: session.expires_at,
      member: publicMember(member),
      admin_bridge: adminBridge,
    });
  } catch (error) {
    console.error('[AXE NET] member login failed:', error);
    const normalized = normalizeApiError(error);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
