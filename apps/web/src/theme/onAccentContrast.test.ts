import { describe, expect, it } from 'vitest';

/**
 * T052 AC2 — Graphite's accent is neon mint (#3CF5A8); white text on it is
 * 1.3:1. Text on any accent fill must use the `on-accent` token (white in
 * Simple, dark in Graphite). This scans every shipped component source.
 */
const sources = import.meta.glob(['/src/**/*.tsx', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('T052 AC2: no hard-coded white text on accent fills', () => {
  it('scans a non-trivial set of component files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
  });

  it('no component keeps text-white on a bg-accent element', () => {
    const offenders: string[] = [];
    for (const [file, src] of Object.entries(sources)) {
      src.split('\n').forEach((line, i) => {
        if (/\bbg-accent\b(?!\/)/.test(line) && /\btext-white\b/.test(line)) {
          offenders.push(`${file}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('no component uses text-white at all (danger badge included)', () => {
    const offenders = Object.entries(sources)
      .filter(([, src]) => /\btext-white\b/.test(src))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
