import { createServer } from 'node:http';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { pool } from '../src/db.js';
import { server as assets } from '../src/server.js';
import { createAuthHandler } from '../src/auth.js';
import { masterResources, createDashboardMasters } from '../src/dashboard-masters.js';

const c = await pool.getConnection(), createdTables = [], captures = [];
let browser, server;
try {
 const migrations = new URL('../../database/migrations/', import.meta.url), filenames = await readdir(migrations);
 for (const [resource, config] of Object.entries(masterResources)) {
  const filename = filenames.find(f => f.endsWith(`_create_${config.table}_table.php`));
  const source = await readFile(new URL(filename, migrations), 'utf8');
  await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'));
  createdTables.push(config.table);
  const fields = config.fields.map(f => f.key), sample = Object.fromEntries(config.fields.map(f => [f.key, f.options ? f.options[0] : f.type === 'number' ? 1 : 'Contoh ' + f.label]));
  for (let n = 1; n <= 12; n++) await c.execute(`INSERT INTO ${config.table} (${fields.map(f => '`' + f + '`')}${config.slug ? ',slug' : ''},created_at,updated_at) VALUES (${fields.map(() => '?')}${config.slug ? ',?' : ''},NOW(),NOW())`, [...fields.map(f => sample[f]), ...(config.slug ? ['contoh-' + n] : [])]);
  for (const [table, key] of config.related || []) { await c.query(`CREATE TEMPORARY TABLE ${table} (id BIGINT PRIMARY KEY,${key} BIGINT)`); createdTables.push(table); }
 }
 const masters = createDashboardMasters({ getConnection: async () => ({ execute: (...args) => c.execute(...args), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release() {} }) });
 const raw = 'b'.repeat(64), hash = value => createHash('sha256').update(value).digest('hex');
 const user = { id: 1, name: 'Penguji Dashboard', password: 'fixture' }, session = { id: hash(raw), csrf: 'ui-csrf', user_id: 1, password_hash: hash(user.password) };
 const access = { roles: ['Penguji'], permissions: Object.values(masterResources).flatMap(config => ['view_any', 'view', 'create', 'update', 'delete', 'delete_any'].map(p => `${p}_${config.permission}`)) };
 const store = { session: async () => session, user: async () => user, access: async () => access, touch: async () => {} };
 const handler = createAuthHandler({ store, masters });
 server = createServer(async (req, res) => { if (!await handler(req, res, new URL(req.url, 'http://localhost').pathname)) assets.emit('request', req, res); });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const base = `http://127.0.0.1:${server.address().port}`;
 browser = await puppeteer.launch({ executablePath: process.env.PDF_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
 const page = await browser.newPage(), errors = [];
 page.on('pageerror', e => errors.push(e.message));
 await page.setCookie({ name: 'alyusro_node_session', value: raw, url: base });
 const output = new URL('../storage/auth-preview/', import.meta.url); await mkdir(output, { recursive: true });
 const visit = async path => { const response = await page.goto(base + path, { waitUntil: 'networkidle0' }); assert.equal(response.status(), 200, path); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path); };
 for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
  await page.setViewport({ width, height: 900 }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  for (const [resource, config] of Object.entries(masterResources)) {
   const path = '/dashboard/' + resource;
   await visit(path + '?per_page=10');
   assert.equal(await page.$eval('html', e => e.dataset.theme), theme);
   assert.equal((await page.$$('[data-table-select-row]')).length, 10);
   await page.focus('[data-table-select-all]'); await page.keyboard.press('Space');
   assert.equal(await page.$$eval('[data-table-select-row]', nodes => nodes.every(e => e.checked)), true);
   await page.keyboard.press('Space');
   // Column toggles are keyboard-operable and survive navigation.
   await page.$$eval('.data-table-menu', nodes => nodes.find(n => n.querySelector('[data-table-column]')).open = true);
   await page.focus('[data-table-column="0"]'); await page.keyboard.press('Space');
   assert.equal(await page.$eval('th[data-column="0"]', e => e.hidden), true);
   await page.reload({ waitUntil: 'networkidle0' });
   assert.equal(await page.$eval('th[data-column="0"]', e => e.hidden), true);
   await page.$$eval('.data-table-menu', nodes => nodes.find(n => n.querySelector('[data-table-column]')).open = true);
   await page.click('[data-table-column="0"]');
   await page.$$eval('.data-table-menu', nodes => nodes.forEach(n => n.open = false));
   const capture = fileURLToPath(new URL(`master-${resource}-${theme}-${width}.png`, output));
   await page.screenshot({ path: capture, fullPage: true }); captures.push({ capture, resource, theme, width });
   const next = await page.$('a[href*="page=2"]'); assert.ok(next);
   await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), next.click()]);
   assert.equal((await page.$$('[data-table-select-row]')).length, 2);
   await visit(path + '?sort=' + config.sorts[0] + '&direction=desc');
   assert.equal(await page.$eval('th[aria-sort]', e => e.getAttribute('aria-sort')), 'descending');
   if (config.fields.some(f => f.options)) { await visit(path + '?status=' + encodeURIComponent(config.fields.find(f => f.options).options[1])); assert.ok(await page.$('.data-table-empty')); }
   await visit(path + '?q=tidak-ditemukan'); assert.ok(await page.$('.data-table-empty'));
   await visit(path + '/create'); assert.equal((await page.$$('form input[required],form select[required]')).length > 0, true);
   await visit(path + '/1/edit');
   const firstKey = config.statusOnly ? 'status' : config.fields[0].key;
   assert.ok(await page.$(`[name="${firstKey}"]`));
   if (config.view) { await visit(path + '/1/view'); assert.equal((await page.$$('dl dt')).length, config.fields.length); await visit(path + '/1/delete'); assert.ok(await page.$('[name=confirm]')); }
  }
 }
 assert.deepEqual(errors, []);
 // Full submission through the UI, including the shared confirmation for bulk deletion.
 await visit('/dashboard/struktur-mahad/create');
 await page.type('[name=struktur]', 'Uji Browser'); await page.type('[name=nama]', 'Nama Browser'); await page.type('[name=level]', '3');
 await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.status-note-form button[type=submit]')]);
 await visit('/dashboard/struktur-mahad?q=Uji+Browser'); assert.match(await page.$eval('tbody', e => e.textContent), /Nama Browser/);
 await page.click('[data-table-select-all]');
 await page.$$eval('.data-table-menu', nodes => nodes.find(n => n.textContent.includes('Aksi massal')).open = true);
 page.once('dialog', dialog => dialog.accept());
 await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.data-table-delete')]);
 await visit('/dashboard/struktur-mahad?q=Uji+Browser'); assert.ok(await page.$('.data-table-empty'));
 const thumbs = await Promise.all(captures.map(async ({ capture }) => sharp(capture).resize({ width: 360, height: 300, fit: 'contain', background: '#ddd' }).png().toBuffer()));
 await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#ddd' } }).composite(thumbs.map((input, i) => ({ input, left: (i % 5) * 360, top: Math.floor(i / 5) * 300 }))).png().toFile(fileURLToPath(new URL('masters-contact-sheet.png', output)));
 console.log('5 modul: desktop/HP, terang/gelap, data berisi/kosong, kolom tersimpan, keyboard, pagination, sort/filter, formulir/detail dan tambah/hapus browser lulus.');
} finally {
 if (browser) await browser.close();
 if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
 for (const table of createdTables) await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
 c.release(); await pool.end();
}
