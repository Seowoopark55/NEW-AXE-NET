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

export async function submitMemberModbookRequest(values) {
  const data = await postJson('/api/member-session', {
    action: 'info_modbook_request_submit',
    ...values,
  });
  return data.request_id;
}

export async function fetchMemberModbookRequests() {
  const data = await postJson('/api/member-session', {
    action: 'info_modbook_my_requests',
  });
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function updateMemberModbookPrice(id, recentPrice) {
  const data = await postJson('/api/member-session', {
    action: 'info_modbook_price_update',
    id,
    recent_price: recentPrice,
  });
  return data.modbook_id;
}

export async function fetchMemberAccounts() {
  const data = await postJson('/api/member-session', { action: 'asset_plika_accounts' });
  return Array.isArray(data.accounts) ? data.accounts : [];
}

export async function fetchMemberAccountRequests() {
  const data = await postJson('/api/member-session', { action: 'asset_plika_my_requests' });
  return Array.isArray(data.requests) ? data.requests : [];
}

export async function submitMemberAccountRequest(values) {
  const data = await postJson('/api/member-session', {
    action: 'asset_plika_request_submit',
    account: String(values.account || '').trim(),
    note: String(values.note || '').trim(),
  });
  return data.request_id;
}

