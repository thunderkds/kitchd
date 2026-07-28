import { chromium } from 'playwright-core';
import fs from 'node:fs';

const WEB = 'http://localhost:8766';
const API = 'http://localhost:3000';
const OUT = process.env.OUT;
const log = [];
const say = (m) => { console.log(m); log.push(m); };

const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@demo.kitchenos.dev', password: 'Password123!' }),
});
const auth = await res.json();

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.addInitScript(([t, u]) => {
  localStorage.setItem('accessToken', t);
  localStorage.setItem('authUser', u);
}, [auth.accessToken, JSON.stringify({ ...auth.user, themePreference: 'simple' })]);
const page = await ctx.newPage();

// Invite a fresh member through the real UI so the success banner is captured.
const email = `t043-ui-${Date.now()}@example.com`;
await page.goto(`${WEB}/team`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Invite Member' }).click();
await page.getByLabel('Invite email').fill(email);
await page.getByLabel('Invite role').selectOption('CHEF');
await page.getByRole('button', { name: 'Send Invite' }).click();
await page.waitForSelector('[data-testid="created-invite-banner"]');
const bannerText = await page.getByTestId('created-invite-banner').innerText();
say(`AC1/AC3 banner text:\n${bannerText}`);
const linkValue = await page.getByLabel(`New invite link for ${email}`).inputValue();
say(`AC1 link value: ${linkValue}`);

// AC1 copy control: the page is on http://localhost, a secure context for
// Chrome, so the real Clipboard API is exercised here.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.getByTestId('created-invite-banner').getByRole('button', { name: 'Copy link' }).click();
await page.waitForSelector('[data-testid="created-invite-banner"] >> text=Copied!');
const clip = await page.evaluate(() => navigator.clipboard.readText());
say(`AC1 clipboard contents after Copy link: ${clip}`);
say(`AC1 clipboard matches link: ${clip === linkValue}`);

// AC2: reload — the link must still be retrievable from the pending row.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="invites-list"]');
say(`AC2 after reload, banner present: ${await page.getByTestId('created-invite-banner').count() > 0}`);
const rowLink = await page.getByLabel(`Invite link for ${email}`).first().inputValue();
say(`AC2 pending-row link after reload: ${rowLink}`);
say(`AC3 no false "Invite sent" text on page: ${!(await page.content()).includes('Invite sent to')}`);

async function shoot(theme, expectedAccent, width, height, name) {
  await page.setViewportSize({ width, height });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(150);
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  if (accent.toLowerCase() !== expectedAccent) {
    throw new Error(`THEME ASSERTION FAILED ${theme}: ${accent} != ${expectedAccent}`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
  say(`${name}: data-theme=${theme} --color-accent=${accent} (ASSERTED) viewport=${width}x${height} horizontal-overflow=${overflow}`);
}

await shoot('simple', '#9333ea', 1280, 1000, 'team-page_invite-link_simple_desktop-1280.png');
await shoot('dark-neon', '#d51944', 1280, 1000, 'team-page_invite-link_dark-neon_desktop-1280.png');
await shoot('simple', '#9333ea', 768, 1000, 'team-page_invite-link_simple_tablet-768.png');
await shoot('simple', '#9333ea', 320, 900, 'team-page_invite-link_simple_mobile-320.png');
await shoot('dark-neon', '#d51944', 320, 900, 'team-page_invite-link_dark-neon_mobile-320.png');

// Explicit long-token overflow check on the row itself at 320px.
const box = await page.getByLabel(`Invite link for ${email}`).first().boundingBox();
say(`320px link input box: x=${box.x} width=${box.width} (viewport 320) -> fits: ${box.x + box.width <= 320}`);

fs.writeFileSync(`${OUT}/team-page.log`, log.join('\n') + '\n');
await browser.close();
