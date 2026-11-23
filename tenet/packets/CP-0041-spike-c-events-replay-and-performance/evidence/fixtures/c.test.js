import { it, expect, afterAll } from 'vitest';
it('[AB-7] passes before teardown fails', () => { expect(true).toBe(true); });
afterAll(() => { throw new Error('teardown boom'); });
