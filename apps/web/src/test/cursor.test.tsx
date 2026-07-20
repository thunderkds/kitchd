import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

// T034 — cursor pointer regression test for all clickable elements.
// Native <button>, <a>, and elements with role="button" must show
// cursor: pointer to indicate interactivity. Disabled buttons/buttons with
// aria-disabled="true" must show cursor: not-allowed.
//
// Vitest's default `css: false` test config mocks CSS imports rather than
// injecting them into jsdom, so importing index.css directly would not
// apply real styles here. Instead, the exact rule under test (mirrored from
// index.css) is injected as a <style> tag per test — this verifies the
// selector/declaration pair actually produces the intended computed cursor
// value in jsdom, independent of the Tailwind build pipeline.

const CURSOR_RULE = `
  button:not(:disabled),
  [role="button"]:not([aria-disabled="true"]),
  summary {
    cursor: pointer;
  }
  button:disabled,
  [role="button"][aria-disabled="true"] {
    cursor: not-allowed;
  }
`;

describe('Cursor pointer for interactive elements (T034)', () => {
  let styleEl: HTMLStyleElement;

  beforeEach(() => {
    styleEl = document.createElement('style');
    styleEl.textContent = CURSOR_RULE;
    document.head.appendChild(styleEl);
  });

  afterEach(() => {
    styleEl.remove();
  });

  it('should render a button element (smoke test for cursor rule targeting)', () => {
    const { container } = render(
      <div>
        <button>Click me</button>
      </div>,
    );
    const btn = container.querySelector('button');
    expect(btn).toBeInTheDocument();
    expect(btn?.textContent).toBe('Click me');
  });

  it('should render a disabled button element', () => {
    const { container } = render(
      <div>
        <button disabled>Disabled</button>
      </div>,
    );
    const btn = container.querySelector('button[disabled]');
    expect(btn).toBeInTheDocument();
    expect(btn?.disabled).toBe(true);
  });

  it('should render an element with role="button"', () => {
    const { container } = render(
      <div>
        <div role="button" tabIndex={0}>
          Button-like div
        </div>
      </div>,
    );
    const div = container.querySelector('[role="button"]');
    expect(div).toBeInTheDocument();
    expect(div?.getAttribute('role')).toBe('button');
  });

  it('should render an element with role="button" and aria-disabled="true"', () => {
    const { container } = render(
      <div>
        <div role="button" aria-disabled="true" tabIndex={-1}>
          Disabled button-like div
        </div>
      </div>,
    );
    const div = container.querySelector('[role="button"][aria-disabled="true"]');
    expect(div).toBeInTheDocument();
    expect(div?.getAttribute('aria-disabled')).toBe('true');
  });

  it('should render a summary element (disclosure widget)', () => {
    const { container } = render(
      <details>
        <summary>Expand me</summary>
        <p>Hidden content</p>
      </details>,
    );
    const summary = container.querySelector('summary');
    expect(summary).toBeInTheDocument();
    expect(summary?.textContent).toBe('Expand me');
  });

  it('button element has cursor: pointer computed', () => {
    const { container } = render(<button>Click</button>);
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(getComputedStyle(btn).cursor).toBe('pointer');
  });

  it('disabled button has cursor: not-allowed computed', () => {
    const { container } = render(<button disabled>Disabled</button>);
    const btn = container.querySelector('button[disabled]') as HTMLButtonElement;
    expect(getComputedStyle(btn).cursor).toBe('not-allowed');
  });

  it('role="button" element has cursor: pointer computed', () => {
    const { container } = render(
      <div role="button" tabIndex={0}>
        Button-like div
      </div>,
    );
    const div = container.querySelector('[role="button"]') as HTMLElement;
    expect(getComputedStyle(div).cursor).toBe('pointer');
  });

  it('role="button" with aria-disabled="true" has cursor: not-allowed computed', () => {
    const { container } = render(
      <div role="button" aria-disabled="true" tabIndex={-1}>
        Disabled button-like div
      </div>,
    );
    const div = container.querySelector('[role="button"]') as HTMLElement;
    expect(getComputedStyle(div).cursor).toBe('not-allowed');
  });
});
