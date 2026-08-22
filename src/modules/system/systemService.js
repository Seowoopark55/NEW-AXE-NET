import { api } from '../../api/api.js';

export async function runSupabaseHealthCheck() {
  const rows = await api.select('app_meta', {
    columns: 'key,value',
    limit: 1,
  });

  const row = rows.find((item) => item.key === 'health');

  if (!row) {
    throw new Error('app_meta health row를 찾을 수 없습니다.');
  }

  return row;
}
