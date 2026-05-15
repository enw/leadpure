import { describe, it, expect } from 'bun:test';
import { checkRateLimit } from '../../apps/web/lib/rate-limit';

describe('rate limiter', () => {
  it('allows first request', () => {
    expect(checkRateLimit('test-key-1')).toBe(true);
  });

  it('allows up to 100 requests within window', () => {
    const key = 'test-key-burst';
    for (let i = 0; i < 100; i++) {
      expect(checkRateLimit(key)).toBe(true);
    }
  });

  it('blocks 101st request', () => {
    const key = 'test-key-overflow';
    for (let i = 0; i < 100; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key)).toBe(false);
  });

  it('different keys have independent counters', () => {
    const keyA = 'test-key-independent-a';
    const keyB = 'test-key-independent-b';

    // Fill keyA
    for (let i = 0; i < 100; i++) {
      checkRateLimit(keyA);
    }

    // keyA blocked, keyB still allowed
    expect(checkRateLimit(keyA)).toBe(false);
    expect(checkRateLimit(keyB)).toBe(true);
  });
});
