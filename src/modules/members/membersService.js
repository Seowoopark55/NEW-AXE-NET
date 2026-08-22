import { api } from '../../api/api.js';

/**
 * 다음 단계에서 실제 테이블명과 컬럼을 확정한 뒤 사용합니다.
 */
export async function fetchMembers() {
  return api.select('members');
}
