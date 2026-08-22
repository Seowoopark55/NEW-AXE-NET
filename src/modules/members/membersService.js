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
