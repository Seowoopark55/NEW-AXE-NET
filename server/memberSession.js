import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_LEGACY_API_URL =
  'https://script.google.com/macros/s/AKfycbzDem9Wtg-Jxyj115xMu8_7Hrk_StOFEG7n1PNOH68_iGfcaSKNXEH6cWlE4iW5bw-j9A/exec';
const SESSION_TTL_DAYS = 30;

let serviceClient = null;

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function onlyPost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  sendJson(res, 405, { ok: false, message: 'POST 요청만 지원합니다.' });
  return false;
}

export function getServiceClient() {
  if (serviceClient) return serviceClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('서버 환경변수 SUPABASE_URL(또는 VITE_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  }

  serviceClient = createClient(url, serviceRoleKey, {
    db: { schema: 'new_axe_net' },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return serviceClient;
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}');
    } catch {
      throw new Error('요청 데이터 형식이 올바르지 않습니다.');
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('요청 데이터 형식이 올바르지 않습니다.');
  }
}

export function getSessionToken(req, body = {}) {
  const cookieHeader = String(req.headers.cookie || '');
  const cookies = Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index < 0) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );

  if (cookies.axe_member_session) return cookies.axe_member_session;

  const header = String(req.headers.authorization || '');
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return String(body.token || '').trim();
}

export function setMemberSessionCookie(req, res, token, expiresAt) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const secure = forwardedProto === 'https' || process.env.NODE_ENV === 'production';
  const expires = new Date(expiresAt);
  const maxAge = Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
  const parts = [
    `axe_member_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    `Expires=${expires.toUTCString()}`,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearMemberSessionCookie(req, res) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const secure = forwardedProto === 'https' || process.env.NODE_ENV === 'production';
  const parts = [
    'axe_member_session=',
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function publicMember(member) {
  if (!member) return null;
  return {
    member_key: member.member_key,
    nickname: member.nickname,
    role: member.role,
    status: member.status,
    discord_name: member.discord_name || null,
    badge: member.badge || null,
    points: Number(member.points || 0),
  };
}


export async function getMemberLoginTarget(nickname) {
  const client = getServiceClient();
  const { data, error } = await client.rpc('get_member_login_target', {
    p_nickname: String(nickname || '').trim(),
  });
  if (error) throw error;
  return data || null;
}

export async function verifyMemberCredentials(nickname, password) {
  const client = getServiceClient();
  const { data, error } = await client.rpc('verify_member_credentials', {
    p_nickname: String(nickname || '').trim(),
    p_password: String(password || ''),
  });
  if (error) throw error;
  return data || null;
}

export async function setMemberPassword(memberKey, password, migratedFrom = 'server') {
  const client = getServiceClient();
  const { data, error } = await client.rpc('set_member_password', {
    p_member_key: memberKey,
    p_password: String(password || ''),
    p_migrated_from: migratedFrom,
  });
  if (error) throw error;
  return Boolean(data);
}

export function invalidMemberLoginError(message = '닉네임 또는 비밀번호가 올바르지 않습니다.') {
  const error = new Error(message);
  error.code = 'MEMBER_LOGIN_FAILED';
  error.statusCode = 401;
  return error;
}

export async function legacyLogin(nickname, password) {
  const apiUrl = process.env.AXE_LEGACY_API_URL || DEFAULT_LEGACY_API_URL;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      type: 'login',
      nickname,
      password,
    }),
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`기존 로그인 이관 서버 응답 오류 (${response.status})`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('기존 로그인 이관 응답을 해석할 수 없습니다.');
  }

  if (!data || data.result !== 'success' || !data.user) {
    const message = String(data?.message || '닉네임 또는 비밀번호가 올바르지 않습니다.');
    const error = new Error(message);
    error.code = 'LEGACY_LOGIN_FAILED';
    throw error;
  }

  return data.user;
}

export async function findNewMemberForLegacyUser(legacyUser) {
  const client = getServiceClient();
  const legacyId = String(legacyUser?.id || '').trim();
  const nickname = String(legacyUser?.nickname || '').trim();

  let member = null;

  if (legacyId) {
    const { data, error } = await client
      .from('members')
      .select('member_key,nickname,role,status,discord_user_id,discord_name,badge,points')
      .eq('member_key', legacyId)
      .maybeSingle();

    if (error) throw error;
    member = data || null;
  }

  if (!member && nickname) {
    const { data, error } = await client
      .from('members')
      .select('member_key,nickname,role,status,discord_user_id,discord_name,badge,points')
      .eq('nickname', nickname)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    member = data || null;
  }

  if (!member) {
    throw new Error('NEW AXE NET 멤버 목록에서 로그인 계정을 찾을 수 없습니다. 관리자에게 문의하세요.');
  }

  if (String(member.status || '').toLowerCase() !== 'active') {
    throw new Error('현재 활동 상태의 계정만 로그인할 수 있습니다.');
  }

  return member;
}

export async function touchMemberLogin(memberKey) {
  const client = getServiceClient();
  const { error } = await client
    .from('members')
    .update({ last_login: new Date().toISOString() })
    .eq('member_key', memberKey);
  if (error) throw error;
}

export async function createMemberSession(member) {
  const client = getServiceClient();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 오래된 세션은 로그인 시 가볍게 정리합니다. 실패해도 로그인 자체는 계속합니다.
  try {
    await client.rpc('cleanup_expired_member_web_sessions');
  } catch (error) {
    console.warn('[NEW AXE NET] expired member session cleanup skipped:', error?.message || error);
  }

  const { error } = await client.from('member_web_sessions').insert({
    member_key: member.member_key,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) throw error;

  return { token, expires_at: expiresAt };
}

export async function requireMemberSession(token) {
  if (!token) {
    const error = new Error('로그인이 필요합니다.');
    error.statusCode = 401;
    throw error;
  }

  const client = getServiceClient();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const { data: session, error: sessionError } = await client
    .from('member_web_sessions')
    .select('id,member_key,expires_at,last_seen_at')
    .eq('token_hash', tokenHash)
    .gt('expires_at', now)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!session) {
    const error = new Error('로그인 세션이 만료되었거나 유효하지 않습니다. 다시 로그인하세요.');
    error.statusCode = 401;
    throw error;
  }

  const { data: member, error: memberError } = await client
    .from('members')
    .select('member_key,nickname,role,status,discord_user_id,discord_name,badge,points')
    .eq('member_key', session.member_key)
    .maybeSingle();

  if (memberError) throw memberError;
  if (!member || String(member.status || '').toLowerCase() !== 'active') {
    const error = new Error('현재 사용할 수 없는 멤버 계정입니다.');
    error.statusCode = 403;
    throw error;
  }

  // 매 요청마다 DB write를 하지 않도록 마지막 갱신이 10분보다 오래된 경우만 touch합니다.
  const lastSeen = session.last_seen_at ? new Date(session.last_seen_at).getTime() : 0;
  if (!lastSeen || Date.now() - lastSeen > 10 * 60 * 1000) {
    void client
      .from('member_web_sessions')
      .update({ last_seen_at: now })
      .eq('id', session.id)
      .then(() => {})
      .catch(() => {});
  }

  return { session, member, client, tokenHash };
}

export async function revokeMemberSession(token) {
  if (!token) return;
  const client = getServiceClient();
  const { error } = await client
    .from('member_web_sessions')
    .delete()
    .eq('token_hash', hashToken(token));
  if (error) throw error;
}


const MEMBER_ADMIN_BRIDGE_DOMAIN = 'member-admin.axenet.invalid';

function memberAdminBridgeEmail(memberKey) {
  const digest = crypto
    .createHash('sha256')
    .update(String(memberKey || ''))
    .digest('hex')
    .slice(0, 24);
  return `member-${digest}@${MEMBER_ADMIN_BRIDGE_DOMAIN}`;
}

function isMemberAdminBridgeEmail(email) {
  return String(email || '').toLowerCase().endsWith(`@${MEMBER_ADMIN_BRIDGE_DOMAIN}`);
}


function memberAdminBridgeSecret(memberKey, memberPassword) {
  const serverSecret = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!serverSecret) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 없어 관리자 자동 연결 비밀값을 만들 수 없습니다.');

  // Supabase Auth의 최소 비밀번호 길이 정책과 무관하게 충분히 긴 내부 비밀값을 사용합니다.
  // 사용자가 입력한 멤버 비밀번호 원문은 저장하지 않고 HMAC 입력으로만 사용합니다.
  const digest = crypto
    .createHmac('sha256', serverSecret)
    .update(`${String(memberKey || '')}:${String(memberPassword || '')}`)
    .digest('base64url');
  return `Ax!${digest}9z`;
}

async function findAuthUserByEmail(client, email) {
  const target = String(email || '').trim().toLowerCase();
  if (!target) return null;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => String(user?.email || '').trim().toLowerCase() === target);
    if (found) return found;
    if (users.length < 100) break;
  }

  return null;
}

/**
 * role=admin 멤버가 닉네임/비밀번호로 로그인했을 때 기존 Supabase Auth
 * 관리자 체계를 그대로 사용할 수 있도록 내부 전용 Auth 계정을 자동 연결합니다.
 *
 * - 사용자는 내부 이메일을 입력하거나 볼 필요가 없습니다.
 * - 이미 사람이 직접 만든 admin_accounts 연결(최고관리자)은 절대 덮어쓰지 않습니다.
 * - role이 admin이 아니면 아무 작업도 하지 않습니다.
 */
export async function ensureMemberAdminBridge(member, password) {
  if (!member || String(member.status || '').toLowerCase() !== 'active') return null;
  if (String(member.role || '').toLowerCase() !== 'admin') return null;

  const client = getServiceClient();
  const memberKey = String(member.member_key || '').trim();
  if (!memberKey) return null;
  const bridgeSecret = memberAdminBridgeSecret(memberKey, password);

  const { data: existingLink, error: linkError } = await client
    .from('admin_accounts')
    .select('user_id,member_key,enabled,admin_level')
    .eq('member_key', memberKey)
    .maybeSingle();
  if (linkError) throw linkError;

  if (existingLink?.user_id) {
    const { data: existingUserData, error: userError } = await client.auth.admin.getUserById(existingLink.user_id);
    if (userError) throw userError;
    const existingUser = existingUserData?.user || null;
    const email = String(existingUser?.email || '').trim().toLowerCase();

    // 최고관리자처럼 사람이 직접 연결한 Auth 계정은 비밀번호/이메일을 건드리지 않습니다.
    if (!isMemberAdminBridgeEmail(email)) {
      return {
        mode: 'external',
        auto_signin: false,
      };
    }

    const { error: updateUserError } = await client.auth.admin.updateUserById(existingLink.user_id, {
      password: bridgeSecret,
      user_metadata: {
        ...(existingUser?.user_metadata || {}),
        axe_member_key: memberKey,
        axe_shadow_admin: true,
      },
    });
    if (updateUserError) throw updateUserError;

    if (!existingLink.enabled) {
      const { error: enableError } = await client
        .from('admin_accounts')
        .update({ enabled: true, admin_level: 'operator', updated_at: new Date().toISOString() })
        .eq('member_key', memberKey);
      if (enableError) throw enableError;
    }

    return {
      mode: 'member',
      auto_signin: true,
      email,
      secret: bridgeSecret,
    };
  }

  const email = memberAdminBridgeEmail(memberKey);
  let authUser = await findAuthUserByEmail(client, email);
  let createdNow = false;

  if (!authUser) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: bridgeSecret,
      email_confirm: true,
      user_metadata: {
        axe_member_key: memberKey,
        axe_shadow_admin: true,
      },
    });
    if (error) throw error;
    authUser = data?.user || null;
    createdNow = true;
  } else {
    const { error } = await client.auth.admin.updateUserById(authUser.id, {
      password: bridgeSecret,
      user_metadata: {
        ...(authUser.user_metadata || {}),
        axe_member_key: memberKey,
        axe_shadow_admin: true,
      },
    });
    if (error) throw error;
  }

  if (!authUser?.id) throw new Error('멤버 관리자 Auth 계정을 생성하지 못했습니다.');

  const { error: accountError } = await client
    .from('admin_accounts')
    .insert({
      user_id: authUser.id,
      member_key: memberKey,
      enabled: true,
      admin_level: 'operator',
    });

  if (accountError) {
    if (createdNow) {
      try {
        await client.auth.admin.deleteUser(authUser.id);
      } catch (cleanupError) {
        console.warn('[NEW AXE NET] orphan member admin auth cleanup skipped:', cleanupError?.message || cleanupError);
      }
    }
    throw accountError;
  }

  return {
    mode: 'member',
    auto_signin: true,
    email,
    secret: bridgeSecret,
  };
}

export function normalizeApiError(error) {
  const message = String(error?.message || error || '알 수 없는 오류가 발생했습니다.');
  const lower = message.toLowerCase();

  if (error?.code === 'LEGACY_LOGIN_FAILED' || error?.code === 'MEMBER_LOGIN_FAILED') {
    return { status: 401, message };
  }

  if (error?.statusCode) {
    return { status: error.statusCode, message };
  }

  if (lower.includes('member_credentials') || lower.includes('get_member_login_target') || lower.includes('verify_member_credentials')) {
    return {
      status: 500,
      message: 'NEW AXE NET 멤버 로그인 DB가 준비되지 않았습니다. 025_member_credentials.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('discord_sync_status') || lower.includes('discord_thread_id')) {
    return {
      statusCode: 503,
      message: 'AXE TUBE Discord 포럼 연동 데이터베이스가 아직 준비되지 않았습니다. 037_tube_discord_forum_primary.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('sync_owner') || lower.includes('save_tube_video_admin') || lower.includes('deactivate_tube_video_admin')) {
    return {
      status: 500,
      message: 'AXE TUBE Supabase-first 데이터베이스가 아직 준비되지 않았습니다. 036_tube_supabase_primary.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('tube_comments') || lower.includes('deactivate_tube_comment_admin')) {
    return {
      status: 500,
      message: 'AXE TUBE 댓글 데이터베이스가 아직 준비되지 않았습니다. 039_tube_comments.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('tube_reactions') || lower.includes('set_tube_reaction')) {
    return {
      status: 500,
      message: 'AXE TUBE 반응 데이터베이스가 아직 준비되지 않았습니다. 035_tube_reactions_bridge.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('tube_videos')) {
    return {
      status: 500,
      message: 'AXE TUBE 데이터베이스가 아직 준비되지 않았습니다. 033~036 SQL 적용 상태를 확인하세요.',
    };
  }

  if (lower.includes('outlaw_stats_') || lower.includes('outlaw_guide_') || lower.includes('outlaw_briefing_maps')) {
    return {
      status: 500,
      message: '무법지대 데이터베이스가 아직 준비되지 않았습니다. 030_outlaw_module.sql / 031_outlaw_legacy_import.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('member_accounts') || lower.includes('member_account_requests') || lower.includes('company_assets') || lower.includes('company_asset_returns')) {
    return {
      status: 500,
      message: '자산·계좌 데이터베이스가 아직 준비되지 않았습니다. 026_assets_plika.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('member_web_sessions')) {
    return {
      status: 500,
      message: 'NEW AXE NET 웹 세션 테이블이 준비되지 않았습니다. 016_member_web_sessions.sql 실행 여부를 확인하세요.',
    };
  }

  if (lower.includes('service_role') || lower.includes('environment') || lower.includes('환경변수')) {
    return { status: 500, message };
  }

  return { status: 500, message };
}


const FUND_EVIDENCE_BUCKET = 'fund-evidence';
const FUND_EVIDENCE_MAX_BYTES = 3 * 1024 * 1024;

export function storageEvidencePath(value) {
  const prefix = `storage://${FUND_EVIDENCE_BUCKET}/`;
  const text = String(value || '').trim();
  return text.startsWith(prefix) ? text.slice(prefix.length) : null;
}

export async function signFundEvidenceUrl(client, value, expiresIn = 3600) {
  const path = storageEvidencePath(value);
  if (!path) return value || null;
  const { data, error } = await client.storage
    .from(FUND_EVIDENCE_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
}

export async function hydrateFundEvidence(profile, client) {
  if (!profile || !Array.isArray(profile.requests)) return profile;
  const requests = await Promise.all(profile.requests.map(async (row) => ({
    ...row,
    evidence_storage_ref: row.evidence_url || null,
    evidence_url: await signFundEvidenceUrl(client, row.evidence_url),
  })));
  return { ...profile, requests };
}

export async function uploadFundEvidence(client, memberKey, evidence) {
  const dataUrl = String(evidence?.data_url || evidence?.dataUrl || '').trim();
  if (!dataUrl) throw new Error('증빙 스크린샷을 첨부하세요.');

  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match) throw new Error('증빙 이미지 형식이 올바르지 않습니다.');

  const mime = String(match[1]).toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('증빙 이미지가 비어 있습니다.');
  if (buffer.length > FUND_EVIDENCE_MAX_BYTES) throw new Error('증빙 이미지는 3MB 이하로 첨부하세요.');

  const ext = mimeExtension(mime);
  const safeMember = String(memberKey || 'member').replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${safeMember}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;

  const { error } = await client.storage
    .from(FUND_EVIDENCE_BUCKET)
    .upload(path, buffer, {
      contentType: mime,
      upsert: false,
      cacheControl: '3600',
    });
  if (error) throw error;
  return { path, ref: `storage://${FUND_EVIDENCE_BUCKET}/${path}` };
}

export async function removeFundEvidence(client, path) {
  if (!path) return;
  try {
    await client.storage.from(FUND_EVIDENCE_BUCKET).remove([path]);
  } catch (error) {
    console.warn('[NEW AXE NET] orphan fund evidence cleanup skipped:', error?.message || error);
  }
}

function mimeExtension(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/heic') return 'heic';
  if (mime === 'image/heif') return 'heif';
  return 'jpg';
}
