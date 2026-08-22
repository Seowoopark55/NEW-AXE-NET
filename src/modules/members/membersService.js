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
