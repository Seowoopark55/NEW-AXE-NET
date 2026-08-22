import {
  createMemberSession,
  findNewMemberForLegacyUser,
  legacyLogin,
  normalizeApiError,
  onlyPost,
  publicMember,
  readBody,
  sendJson,
  setMemberSessionCookie,
  touchMemberLogin,
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

    const legacyUser = await legacyLogin(nickname, password);
    const member = await findNewMemberForLegacyUser(legacyUser);
    const session = await createMemberSession(member);
    await touchMemberLogin(member.member_key);
    setMemberSessionCookie(req, res, session.token, session.expires_at);

    return sendJson(res, 200, {
      ok: true,
      expires_at: session.expires_at,
      member: publicMember(member),
    });
  } catch (error) {
    console.error('[NEW AXE NET] member login failed:', error);
    const normalized = normalizeApiError(error);
    return sendJson(res, normalized.status, {
      ok: false,
      message: normalized.message,
    });
  }
}
