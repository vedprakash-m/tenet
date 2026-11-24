import { expect, it } from 'vitest';
import { retries } from '../src/retry';
it('retries once', () => expect(retries).toBe(1));
