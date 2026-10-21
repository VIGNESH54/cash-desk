import { describe, expect, it } from 'vitest';
import { friendly } from '../app/Store';
import { toReport } from '../app/monitor';

describe('error reporting helpers', () => {
  it('clips long messages and stacks', () => {
    const e = new Error('x'.repeat(900));
    e.stack = 's'.repeat(9000);
    const r = toReport(e);
    expect(r.message.length).toBe(500);
    expect(r.stack!.length).toBe(4000);
  });
  it('handles non-Error values and circular objects without throwing', () => {
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(toReport(loop).message).toBe('Unknown error');
    expect(toReport('plain').message).toBe('plain');
    expect(toReport(undefined).message).toBeTruthy();
  });
  it('turns raw failures into plain advice', () => {
    expect(friendly('TypeError: Failed to fetch')).toMatch(/internet/i);
    expect(friendly('JWT expired')).toMatch(/sign/i);
    expect(friendly('new row violates row-level security policy')).toMatch(/access/i);
    expect(friendly('something odd')).toBe('something odd');
  });
});
