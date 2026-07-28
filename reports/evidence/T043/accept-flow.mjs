import { chromium } from 'playwright-core';
import fs from 'node:fs';

const WEB = 'http://localhost:8766';
const OUT = process.env.OUT;
const token = fs.readFileSync('invite_token.txt', 'utf8').trim();
const log = [];
const say = (m) => { console.log(m); log.push(m); };

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// --- AC4: logged-out visit must render the form, not redirect to /login ---
const storageBefore = await ctx.storageState();
say(`localStorage before visit: ${JSON.stringify(storageBefore.origins)}`);

await page.goto(`${WEB}/invite/accept?token=${token}`, { waitUntil: 'networkidle' });
say(`AC4 landed URL: ${page.url()}`);
say(`AC4 accept button visible: ${await page.getByRole('button', { name: 'Accept invitation' }).isVisible()}`);

// --- theme capture: set data-theme AFTER mount, assert the computed token ---
async function captureTheme(theme, expectedAccent, width, height, name) {
  await page.setViewportSize({ width, height });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(150);
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
  );
  const btnBg = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Accept invitation'));
    return getComputedStyle(b).backgroundColor;
  });
  const bodyBg = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.bg-surface-raised')).backgroundColor,
  );
  if (accent.toLowerCase() !== expectedAccent) {
    throw new Error(`THEME ASSERTION FAILED for ${theme}: --color-accent="${accent}" expected "${expectedAccent}"`);
  }
  await page.screenshot({ path: `${OUT}/${name}`, fullPage: true });
  say(`${name}: data-theme=${theme} --color-accent=${accent} (ASSERTED) submit-bg=${btnBg} card-bg=${bodyBg} viewport=${width}x${height}`);
  // horizontal overflow check
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  say(`  horizontal overflow at ${width}px: ${overflow}`);
}

await captureTheme('simple', '#9333ea', 1280, 900, 'accept-page_simple_desktop-1280.png');
await captureTheme('dark-neon', '#d51944', 1280, 900, 'accept-page_dark-neon_desktop-1280.png');
await captureTheme('simple', '#9333ea', 768, 900, 'accept-page_simple_tablet-768.png');
await captureTheme('dark-neon', '#d51944', 768, 900, 'accept-page_dark-neon_tablet-768.png');
await captureTheme('simple', '#9333ea', 320, 700, 'accept-page_simple_mobile-320.png');
await captureTheme('dark-neon', '#d51944', 320, 700, 'accept-page_dark-neon_mobile-320.png');

// which theme does an anonymous visitor actually get, with no override?
const page2 = await ctx.newPage();
await page2.goto(`${WEB}/invite/accept?token=${token}`, { waitUntil: 'networkidle' });
await page2.waitForTimeout(300);
const anon = await page2.evaluate(() => ({
  attr: document.documentElement.getAttribute('data-theme'),
  accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
  cardBg: getComputedStyle(document.querySelector('.bg-surface-raised')).backgroundColor,
  textColor: getComputedStyle(document.querySelector('h1')).color,
}));
say(`ANONYMOUS visitor theme: data-theme=${anon.attr} --color-accent=${anon.accent} card-bg=${anon.cardBg} heading-color=${anon.textColor}`);
await page2.close();

// --- AC8 live: short password must issue zero network calls ---
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
const calls = [];
page.on('request', (r) => { if (r.url().includes('/users/invite/accept')) calls.push(r.url()); });
await page.getByLabel('Password', { exact: true }).fill('short');
await page.getByLabel('Confirm password').fill('short');
await page.getByRole('button', { name: 'Accept invitation' }).click();
await page.waitForTimeout(500);
say(`AC8 live: short-password error="${await page.getByRole('alert').textContent()}" accept-requests=${calls.length}`);

// --- AC5 live: accept and land in the INVITING kitchen ---
await page.getByLabel('Password', { exact: true }).fill('Password123!');
await page.getByLabel('Confirm password').fill('Password123!');
await page.getByRole('button', { name: 'Accept invitation' }).click();
await page.waitForURL('**/dashboard', { timeout: 15000 });
say(`AC5 live: post-accept URL = ${page.url()}`);
await page.screenshot({ path: `${OUT}/after-accept_dashboard.png`, fullPage: true });

const session = await page.evaluate(() => ({
  authUser: JSON.parse(localStorage.getItem('authUser')),
  hasToken: Boolean(localStorage.getItem('accessToken')),
  accessToken: localStorage.getItem('accessToken'),
}));
say(`AC5 live session authUser = ${JSON.stringify(session.authUser)}`);
fs.writeFileSync('invitee_token.txt', session.accessToken);

// --- AC6 live: reuse the same token in a fresh logged-out context ---
const ctx2 = await browser.newContext();
const page3 = await ctx2.newPage();
await page3.goto(`${WEB}/invite/accept?token=${token}`, { waitUntil: 'networkidle' });
await page3.getByLabel('Password', { exact: true }).fill('Password123!');
await page3.getByLabel('Confirm password').fill('Password123!');
await page3.getByRole('button', { name: 'Accept invitation' }).click();
await page3.waitForTimeout(1500);
say(`AC6 live (token reuse): url=${page3.url()} error="${await page3.getByRole('alert').textContent()}" tokenStored=${await page3.evaluate(() => Boolean(localStorage.getItem('accessToken')))}`);
await page3.screenshot({ path: `${OUT}/accept-page_reused-token-404.png`, fullPage: true });

// --- AC9 live: no token ---
await page3.goto(`${WEB}/invite/accept`, { waitUntil: 'networkidle' });
say(`AC9 live (no token): url=${page3.url()} message="${await page3.getByTestId('missing-token').textContent()}"`);
await page3.screenshot({ path: `${OUT}/accept-page_missing-token.png`, fullPage: true });

fs.writeFileSync(`${OUT}/accept-flow.log`, log.join('\n') + '\n');
await browser.close();
