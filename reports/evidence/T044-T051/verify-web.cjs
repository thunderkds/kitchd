// Stage 5 live verify for T044–T049 against the running API (:3000) and web (:8767).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3000';
const WEB = 'http://localhost:8767';
const OUT = process.argv[2];
const EXE = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell');
const log = (...a) => console.log(new Date().toISOString(), ...a);
const stamp = Date.now();

async function api(method, p, token, body) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${text}`);
  return data;
}

async function asUser(browser, auth, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('accessToken', t);
    localStorage.setItem('authUser', u);
  }, [auth.accessToken, JSON.stringify(auth.user)]);
  return ctx;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const owner = await api('POST', '/auth/signup', null, {
    email: `verify-owner-${stamp}@kitchenos.dev`, password: 'correct-horse-battery',
    organizationName: `Verify Org ${stamp}`, kitchenName: `Verify Kitchen ${stamp}`,
  });
  const invite = await api('POST', '/users/invite', owner.accessToken, { email: `verify-chef-${stamp}@kitchenos.dev`, role: 'CHEF' });
  const tokenRow = await api('GET', '/users/invites', owner.accessToken);
  const inv = (Array.isArray(tokenRow) ? tokenRow : tokenRow.items ?? []).find((i) => i.id === invite.id) ?? invite;
  const chef = await api('POST', '/users/invite/accept', null, { token: inv.token ?? invite.token, password: 'member-password' });
  log('fixtures: owner', owner.user.email, 'chef', chef.user.email);

  const ing = await api('POST', '/ingredients', owner.accessToken, { name: `Verify Flour ${stamp}`, unit: 'kg', costPerUnit: 2, minThreshold: 5 });
  const soon = new Date(Date.now() + 2 * 86400000).toISOString();
  await api('POST', `/ingredients/${ing.id}/stock/receive`, owner.accessToken, { qty: 3, expiryDate: soon });
  const recipe = await api('POST', '/recipes', owner.accessToken, { name: `Verify Bread ${stamp}`, steps: ['Mix'], servings: 2, ingredients: [{ ingredientId: ing.id, qty: 1 }] });

  const browser = await chromium.launch({ executablePath: EXE });
  const results = {};
  try {
    // ---- T044 shift log ---------------------------------------------------
    let ctx = await asUser(browser, owner);
    let page = await ctx.newPage();
    await page.goto(`${WEB}/shift-logs`);
    await page.getByRole('heading', { name: 'Shift Log' }).waitFor();
    await page.getByRole('button', { name: 'New Shift Log' }).click();
    await page.getByRole('dialog').waitFor();
    // empty submit -> error inside dialog, feed stays
    await page.getByRole('dialog').getByRole('button', { name: 'Add Shift Log' }).click();
    const dlgAlert = await page.getByRole('dialog').getByRole('alert').textContent().catch(() => null);
    results.T044_empty_submit_alert_in_dialog = dlgAlert;
    await page.getByRole('dialog').getByLabel('Shift log body').fill(`Walk-in fridge at 3°C, verified ${stamp}`);
    await page.getByRole('dialog').getByRole('button', { name: 'Add Shift Log' }).click();
    await page.getByText(`verified ${stamp}`).waitFor({ timeout: 5000 });
    results.T044_created_entry_visible = true;
    await page.screenshot({ path: `${OUT}/T044-shift-logs.png`, fullPage: true });

    // ---- T045 expiring widget ---------------------------------------------
    await page.goto(`${WEB}/dashboard`);
    await page.getByText(`Verify Flour ${stamp}`).first().waitFor({ timeout: 5000 });
    results.T045_expiring_item_on_dashboard = true;
    await page.screenshot({ path: `${OUT}/T045-dashboard.png`, fullPage: true });

    // ---- T046 export -------------------------------------------------------
    await page.goto(`${WEB}/inventory`);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.getByRole('button', { name: 'Export Ingredients CSV' }).click(),
    ]);
    const csvPath = `${OUT}/${dl.suggestedFilename()}`;
    await dl.saveAs(csvPath);
    const csv = fs.readFileSync(csvPath, 'utf8');
    results.T046_download = { file: dl.suggestedFilename(), header: csv.split('\n')[0], containsIngredient: csv.includes(`Verify Flour ${stamp}`) };

    // ---- T049 clear threshold ---------------------------------------------
    const row = page.getByText(`Verify Flour ${stamp}`).first();
    await row.waitFor();
    results.T049_before_threshold = (await api('GET', `/ingredients/${ing.id}`, owner.accessToken)).minThreshold;
    const editBtn = page.locator('li, tr, div').filter({ hasText: `Verify Flour ${stamp}` }).getByRole('button', { name: 'Edit', exact: true }).first();
    await editBtn.click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Low stock threshold').fill('');
    await dlg.getByRole('button', { name: 'Save Changes' }).click();
    await dlg.waitFor({ state: 'detached', timeout: 5000 });
    results.T049_after_threshold = (await api('GET', `/ingredients/${ing.id}`, owner.accessToken)).minThreshold;

    // ---- T047 version history ---------------------------------------------
    await api('PATCH', `/recipes/${recipe.id}`, owner.accessToken, { servings: 4 });
    await page.goto(`${WEB}/recipes`);
    await page.getByText(`Verify Bread ${stamp}`).first().click();
    await page.getByTestId('recipe-versions').getByText(/Version 2/).first().waitFor({ timeout: 8000 });
    results.T047_versions_text = (await page.getByTestId('recipe-versions').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await page.screenshot({ path: `${OUT}/T047-recipe-versions.png`, fullPage: true });
    await ctx.close();

    // ---- T048 kitchen rename (CHEF) ----------------------------------------
    ctx = await asUser(browser, chef);
    page = await ctx.newPage();
    await page.goto(`${WEB}/settings`);
    const nameInput = page.getByLabel(/kitchen name/i);
    await nameInput.waitFor({ timeout: 5000 });
    results.T048_loaded_name = await nameInput.inputValue();
    await nameInput.fill(`Renamed Kitchen ${stamp}`);
    await page.getByRole('button', { name: 'Save name' }).click();
    await page.waitForTimeout(800);
    results.T048_api_name_after = (await api('GET', `/kitchens/${chef.user.kitchenId}`, chef.accessToken)).name;
    await page.screenshot({ path: `${OUT}/T048-settings.png`, fullPage: true });
    await ctx.close();

    // ---- responsiveness: shift log + settings at 375px ---------------------
    ctx = await asUser(browser, owner, 375);
    page = await ctx.newPage();
    for (const route of ['shift-logs', 'dashboard', 'settings']) {
      await page.goto(`${WEB}/${route}`);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      results[`mobile375_${route}_overflow_px`] = overflow;
      await page.screenshot({ path: `${OUT}/m375-${route}.png`, fullPage: true });
    }
    await ctx.close();
  } finally {
    await browser.close();
    log('RESULTS', JSON.stringify(results, null, 2));
  }
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
