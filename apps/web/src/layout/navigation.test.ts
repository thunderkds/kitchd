import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './navigation';

describe('navigation', () => {
  it('includes Shift Log in the main sidebar nav', () => {
    expect(NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Shift Log',
          path: '/shift-logs',
        }),
      ]),
    );
  });
});
