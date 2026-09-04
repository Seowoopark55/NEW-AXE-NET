import { api } from '../../api/api.js';

export async function fetchMembers() {
  return api.select('members_app', {
    columns: [
      'member_key',
      'discord_name',
      'nickname',
      'role',
      'status',
      'joined_date',
      'last_login',
      'badge',
      'points',
      'resigned_at',
      'sort_order',
    ].join(','),
    orderBy: 'sort_order',
    ascending: true,
  });
}

export async function updateMember(memberKey, values) {
  const allowed = {
    nickname: values.nickname,
    role: values.role,
    status: values.status,
    badge: values.badge || null,
    points: Number(values.points),
    resigned_at: values.status === 'resigned'
      ? (values.resigned_at || null)
      : null,
  };

  return api.update('members', allowed, {
    member_key: memberKey,
  });
}

export async function createMember(values) {
  return api.rpc('create_member_with_password', {
    p_nickname: values.nickname,
    p_password: values.password,
    p_discord_user_id: values.discord_user_id || null,
    p_discord_name: values.discord_name || null,
    p_role: values.role,
    p_status: values.status,
    p_joined_date: values.joined_date || null,
    p_badge: values.badge || null,
    p_points: Number(values.points),
  });
}

export async function resetMemberPassword(memberKey, password) {
  return api.rpc('admin_set_member_password', {
    p_member_key: memberKey,
    p_password: password,
  });
}

export async function fetchMemberAudit(memberKey) {
  return api.select('member_audit_log', {
    columns: [
      'id',
      'member_key',
      'changed_by_nickname',
      'changed_fields',
      'old_data',
      'new_data',
      'changed_at',
    ].join(','),
    filters: {
      member_key: memberKey,
    },
    orderBy: 'changed_at',
    ascending: false,
    limit: 20,
  });
}
