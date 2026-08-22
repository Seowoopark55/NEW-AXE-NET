async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // 아래 공통 오류 처리에서 상태코드를 사용합니다.
  }

  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || `요청에 실패했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function signInMember(nickname, password) {
  const data = await postJson('/api/member-login', { nickname, password });
  return {
    member: data.member,
    expires_at: data.expires_at,
  };
}

export async function restoreMemberSession() {
  try {
    const data = await postJson('/api/member-session', { action: 'validate' });
    return {
      member: data.member,
      expires_at: data.expires_at,
    };
  } catch (error) {
    if (error.status === 401 || error.status === 403) return null;
    throw error;
  }
}

export async function signOutMember() {
  try {
    await postJson('/api/member-session', { action: 'logout' });
  } catch (error) {
    // 세션이 이미 만료된 경우도 클라이언트에서는 로그아웃 완료로 취급합니다.
    if (error.status !== 401 && error.status !== 403) {
      console.warn('[NEW AXE NET] member session revoke failed:', error);
    }
  }
}

export async function fetchMemberFundProfile() {
  const data = await postJson('/api/member-session', { action: 'fund_profile' });
  return data.profile;
}

export async function submitMemberFundRequest(values) {
  const data = await postJson('/api/member-session', {
    action: 'fund_submit',
    ...values,
  });
  return data.request_id;
}
