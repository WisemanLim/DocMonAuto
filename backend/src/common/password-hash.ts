import * as bcrypt from 'bcryptjs';
import { promisify } from 'node:util';

/** bcryptjs는 콜백 API만 제공하므로 Promise로 래핑 (Docker/호스트 아키텍처 혼선 방지용 순수 JS 구현). */
export const hashBcrypt = promisify(bcrypt.hash) as (
  data: string,
  saltOrRounds: string | number,
) => Promise<string>;

/** 로그인 검증은 동기 compareSync 사용 (promisify 조합 시 일부 환경에서 실패 방지). */
export function compareBcrypt(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}
