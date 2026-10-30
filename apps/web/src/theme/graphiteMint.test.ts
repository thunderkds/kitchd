/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs with cwd = apps/web. Read as plain text: `?raw` on a .css file is compiled to an empty string by the Tailwind plugin.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/**
 * T052 — Graphite Mint replaces Dark Neon. The theme id stays `dark-neon`;
 * only its palette and look change. These tests read the stylesheet as text:
 * jsdom does not compute Tailwind output, so the contract is the CSS rules.
 */

interface Rule {
  selector: string;
  body: string;
}

function parseRules(source: string): Rule[] {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    rules.push({ selector: m[1].replace(/\s+/g, ' ').trim(), body: m[2].replace(/\s+/g, ' ').trim() });
  }
  return rules;
}

const rules = parseRules(css);
const GM = "[data-theme='dark-neon']";

function ruleFor(selectorPart: string, scope = GM): Rule {
  const found = rules.find((r) => r.selector.includes(scope) && r.selector.includes(selectorPart));
  if (!found) throw new Error(`No ${scope} rule with selector containing: ${selectorPart}`);
  return found;
}

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of body.split(';')) {
    const i = decl.indexOf(':');
    if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

describe('T052 AC1: token blocks', () => {
  it('Simple values are unchanged and gain only the on-accent token (#ffffff)', () => {
    const simple = rules.find((r) => r.selector === ":root, [data-theme='simple']");
    expect(simple).toBeDefined();
    expect(tokens(simple!.body)).toEqual({
      '--knos-surface': '#f9fafb',
      '--knos-surface-raised': '#ffffff',
      '--knos-surface-raised-2': '#eef0f4',
      '--knos-text-primary': '#111827',
      '--knos-text-muted': '#6b7280',
      '--knos-accent': '#9333ea',
      '--knos-border': 'transparent',
      '--knos-border-input': '#d1d5db',
      '--knos-danger': '#dc2626',
      '--knos-success': '#16a34a',
      '--knos-warning': '#d97706',
      '--knos-on-accent': '#ffffff',
    });
  });

  it('dark-neon holds the Graphite Mint values from tokens.json', () => {
    const block = rules.find((r) => r.selector === GM);
    expect(block).toBeDefined();
    expect(tokens(block!.body)).toMatchObject({
      '--knos-surface': '#121413',
      '--knos-surface-raised': '#121413',
      '--knos-surface-raised-2': '#121413',
      '--knos-text-primary': '#dce0dd',
      '--knos-text-muted': '#8c9590',
      '--knos-accent': '#3cf5a8',
      '--knos-border': '#262b29',
      '--knos-border-input': '#2c3230',
      '--knos-danger': '#e8968f',
      '--knos-success': '#7eddb0',
      '--knos-warning': '#e3b66b',
      '--knos-on-accent': '#0e100f',
    });
  });
});

describe('T052 AC2: on-accent token', () => {
  it('is registered in @theme inline', () => {
    const theme = rules.find((r) => r.selector.startsWith('@theme inline'));
    expect(theme?.body).toContain('--color-on-accent: var(--knos-on-accent)');
  });
});

describe('T052 AC3: outlined cards and sunken inputs (Graphite only)', () => {
  it('removes the raised-surface gradient', () => {
    expect(ruleFor('.bg-surface-raised').body).toContain('background-image: none');
  });

  it('gives border-less raised boxes (dialogs, auth cards) a 1px line border', () => {
    const r = ruleFor(".bg-surface-raised:not([class*='border'])");
    expect(r.body).toContain('border: 1px solid var(--knos-border)');
  });

  it('drops drop shadows', () => {
    expect(ruleFor('.shadow').body).toContain('box-shadow: none');
  });

  it('fills inputs/selects/textareas with bg-sunken and a line-strong border', () => {
    const r = ruleFor('textarea');
    expect(r.selector).toContain('input');
    expect(r.selector).toContain('select');
    expect(r.body).toContain('background-color: #0e100f');
    expect(r.body).toContain('border-color: #2c3230');
  });
});

describe('T052 AC4: primary button glow (Graphite only)', () => {
  it('glows accent-filled buttons but not segmented toggles, and not when disabled', () => {
    const glow = ruleFor('.bg-accent');
    expect(glow.body).toContain('rgba(60, 245, 168, 0.25)');
    const off = rules.find(
      (r) => r.selector.includes(GM) && r.selector.includes('.bg-accent') && r.selector.includes(':disabled'),
    );
    expect(off?.body).toContain('box-shadow: none');
  });

  it('shows the selected segment of a toggle as neon-soft with neon text', () => {
    const seg = ruleFor("[aria-pressed='true']");
    expect(seg.selector).toContain('.bg-accent');
    expect(seg.body).toContain('rgba(60, 245, 168, 0.08)');
    expect(seg.body).toContain('color: #3cf5a8');
  });
});

describe('T052 AC5: sidebar active item', () => {
  it("is neon-soft with neon text, glow, inset neon-line ring and weight 500", () => {
    const r = ruleFor("[aria-current='page']");
    expect(r.selector).toContain('.side-nav');
    expect(r.body).toContain('background-color: rgba(60, 245, 168, 0.08)');
    expect(r.body).toContain('color: #3cf5a8');
    expect(r.body).toContain('text-shadow: 0 0 12px rgba(60, 245, 168, 0.35)');
    expect(r.body).toContain('box-shadow: inset 0 0 0 1px rgba(60, 245, 168, 0.35)');
    expect(r.body).toContain('font-weight: 500');
  });

  it('hovers inactive items with bg-raised', () => {
    const r = ruleFor(':hover', `${GM} .side-nav`);
    expect(r.body).toContain('background-color: #181b1a');
  });
});

describe('T052 AC6: focus ring (Graphite only)', () => {
  it('draws a 2px solid neon ring with 2px offset on every interactive element', () => {
    const r = ruleFor(':focus-visible');
    for (const el of ['a', 'button', "[role='button']", 'input', 'select', 'textarea']) {
      expect(r.selector).toContain(`${GM} ${el}:focus-visible`);
    }
    expect(r.body).toContain('outline: 2px solid #3cf5a8');
    expect(r.body).toContain('outline-offset: 2px');
  });
});

describe('T052 AC7: IBM Plex typography (Graphite only)', () => {
  it('sets IBM Plex Sans on body and IBM Plex Mono for font-mono, with system fallbacks', () => {
    const body = ruleFor('body');
    expect(body.body).toContain('"IBM Plex Sans", system-ui');
    const block = rules.find((r) => r.selector === GM);
    expect(block?.body).toContain('--font-mono: "IBM Plex Mono", ui-monospace');
  });

  it('loads weights 400/500/600 from Google Fonts with display=swap in index.html', () => {
    expect(html).toContain('fonts.googleapis.com/css2');
    expect(html).toContain('family=IBM+Plex+Sans:wght@400;500;600');
    expect(html).toContain('family=IBM+Plex+Mono');
    expect(html).toContain('display=swap');
  });

  it('leaves the paint-time theme script untouched', () => {
    expect(html).toContain("cached === 'dark-neon' ? 'dark-neon' : 'simple'");
  });
});

describe('T052: Simple is untouched by Graphite rules', () => {
  it('every rule added after the Simple block that mentions Graphite is scoped to dark-neon', () => {
    const graphiteOnly = [
      'glow', 'IBM Plex', '#3cf5a8', '#0e100f', '#181b1a', '#2c3230', 'background-image: none',
    ];
    const outside = rules.filter((r) => !r.selector.includes(GM) && !r.selector.startsWith('@theme'));
    for (const r of outside) {
      if (r.selector === ":root, [data-theme='simple']") continue;
      for (const needle of graphiteOnly) {
        // The shared `.bg-surface-raised` gradient rule is the only Simple rule allowed to mention a gradient.
        expect(r.body.toLowerCase()).not.toContain(needle.toLowerCase());
      }
    }
  });
});
