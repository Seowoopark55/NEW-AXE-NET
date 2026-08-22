import { api } from '../../api/api.js';

/**
 * 실제 멤버 테이블 구조를 확정한 뒤 사용합니다.
 */
export async function fetchMembers() {
  return api.select('members');
}
