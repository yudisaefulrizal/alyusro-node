import { createServer } from 'node:http';
import { readFile, readdir, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import ExcelJS from 'exceljs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importHeaders } from '../src/master-imports.js';
import { pool } from '../src/db.js';
import { server as assets } from '../src/server.js';
import { createAuthHandler } from '../src/auth.js';
import { masterResources, createDashboardMasters } from '../src/dashboard-masters.js';

const c = await pool.getConnection(), createdTables = [], captures = [];
let browser, server;
try {
 const migrations = new URL('../../database/migrations/', import.meta.url), filenames = await readdir(migrations);
 for (const [resource, config] of Object.entries(masterResources).filter(([key]) => !['artikel','artikel-saya','fasilitas','galeri-fasilitas','dokumen'].includes(key))) {
  const filename = filenames.find(f => f.endsWith(`_create_${config.table}_table.php`));
  const source = await readFile(new URL(filename, migrations), 'utf8');
  await c.query(source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0].replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'));
  createdTables.push(config.table);
  const fields = config.fields.map(f => f.key), sample = Object.fromEntries(config.fields.map(f => [f.key, f.options ? f.options[0] : f.type === 'number' ? 1 : f.type === 'date' ? '2026-10-27' : 'Contoh ' + f.label]));
  for (let n = 1; n <= 12; n++) await c.execute(`INSERT INTO ${config.table} (${fields.map(f => '`' + f + '`')}${config.slug ? ',slug' : ''},created_at,updated_at) VALUES (${fields.map(() => '?')}${config.slug ? ',?' : ''},NOW(),NOW())`, [...fields.map(f => f === 'nama_arab' && resource === 'perpustakaan-nama' ? 'Belum terdefinisi' : f === 'nama_tema' ? sample[f] + n : sample[f]), ...(config.slug ? ['contoh-' + n] : [])]);
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
 for (const theme of process.env.MASTER_UI_ACTIONS_ONLY ? [] : ['light', 'dark']) for (const width of [1440, 390]) {
  await page.setViewport({ width, height: 900 }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
  for (const [resource, config] of Object.entries(masterResources).filter(([key]) => !['artikel','artikel-saya','fasilitas','galeri-fasilitas','dokumen'].includes(key))) {
   if (process.env.MASTER_UI_RESOURCES && !process.env.MASTER_UI_RESOURCES.split(',').includes(resource)) continue;
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
   if (config.fields.some(f => f.options)) { await visit(path + '?' + config.fields.find(f => f.options).key + '=' + encodeURIComponent(config.fields.find(f => f.options).options[1])); assert.ok(await page.$('.data-table-empty')); }
   await visit(path + '?q=tidak-ditemukan'); assert.ok(await page.$('.data-table-empty'));
   await visit(path + '/create'); assert.equal((await page.$$('form input[required],form select[required]')).length > 0, true);
   await visit(path + '/1/edit');
   const firstKey = config.statusOnly ? 'status' : config.fields[0].key;
   assert.ok(await page.$(`[name="${firstKey}"]`));
   if (config.singleDelete) { await visit(path + '/1/delete'); assert.ok(await page.$('[name=confirm]')); }
   if (config.view) { await visit(path + '/1/view'); assert.equal((await page.$$('dl dt')).length, config.fields.length);  }
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
 // Submit every newly migrated resource through the browser, then verify persisted values.
 for (const resource of ['program-pendidikan', 'kalender-akademik', 'prestasi', 'nama-kota', 'tema-soal', 'perpustakaan-nama']) {
  if (process.env.MASTER_UI_RESOURCES && !process.env.MASTER_UI_RESOURCES.split(',').includes(resource)) continue;
  const config = masterResources[resource], path = '/dashboard/' + resource;
  const input = Object.fromEntries(config.fields.map(f => [f.key, f.options ? f.options[0] : f.type === 'date' ? '2026-10-27' : f.type === 'number' ? '2026' : 'Browser ' + f.label]));
  await visit(path + '/create');
  for (const f of config.fields) {
   if (f.type === 'rich') { const editor = await page.$(`[name="${f.key}"]`); await editor.evaluate((node, value) => { const content = node.previousElementSibling.querySelector('[contenteditable]'); content.textContent = value; content.dispatchEvent(new Event('input', { bubbles: true })); }, input[f.key]); }
   else if (f.options) await page.select(`[name="${f.key}"]`, input[f.key]);
   else await page.$eval(`[name="${f.key}"]`, (node, value) => { node.value = value; }, input[f.key]);
  }
  if (resource === 'program-pendidikan') {
   await page.focus('.master-rich-content'); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
   await page.click('.master-rich-toolbar button');
  }
  for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
   await page.setViewport({ width, height: 900 }); await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
   await page.waitForFunction(() => innerWidth > 1023 || document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: fileURLToPath(new URL(`master-form-${resource}-${theme}-${width}.png`, output)), fullPage: true });
  }
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.status-note-form button[type=submit]')]);
  assert.equal(new URL(page.url()).pathname, path);
  const [[stored]] = await c.query(`SELECT * FROM ${config.table} ORDER BY id DESC LIMIT 1`);
  assert.equal(stored[config.fields[0].key], input[config.fields[0].key]);
  if (resource === 'program-pendidikan') assert.match(stored.deskripsi, /<(b|strong)>/);
  await visit(path + '/' + stored.id + '/edit');
  const field = config.fields.find(f => f.type !== 'date' && !f.options && f.type !== 'rich' && f.type !== 'number');
  await page.$eval(`[name="${field.key}"]`, node => { node.value = 'Browser diperbarui'; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.status-note-form button[type=submit]')]);
  const [[edited]] = await c.execute(`SELECT * FROM ${config.table} WHERE id=?`, [stored.id]); assert.equal(edited[field.key], 'Browser diperbarui');
  if (config.importable) {
   const folder = await mkdtemp(join(tmpdir(), 'alyusro-import-'));
   try {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Import'); sheet.addRow(importHeaders(resource));
    sheet.addRow(resource === 'kalender-akademik' ? [2026, 10, 27, 2026, 10, 28, 'Browser impor kegiatan', 'Catatan', 'hijau'] : resource === 'nama-kota' ? ['Browser impor kota', 'مدينة'] : resource === 'perpustakaan-nama' ? ['Browser impor nama', 'عربي', '1'] : ['Browser impor prestasi', 1, 'Lomba', 'Nasional', 'Mahad', 2026]);
    const filename = join(folder, 'uji.xlsx'); await writeFile(filename, Buffer.from(await book.xlsx.writeBuffer()));
    await visit(path); await (await page.$('.master-import [name=workbook]')).uploadFile(filename);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('.master-import button[type=submit]')]);
    const [[last]] = await c.query(`SELECT * FROM ${config.table} ORDER BY id DESC LIMIT 1`); assert.match(last[resource === 'kalender-akademik' ? 'kegiatan' : config.fields[0].key], /[Bb]rowser impor/);
    if (config.convertible) {
     const names = new ExcelJS.Workbook(); names.addWorksheet('Nama').addRows([['nama_latin'],['Nama Browser Baru']]);
     await writeFile(filename, Buffer.from(await names.xlsx.writeBuffer()));
     await visit(path); await (await page.$('.master-convert [name=workbook]')).uploadFile(filename);
     const download = page.waitForResponse(response => response.url().endsWith('/convert') && response.request().method() === 'POST');
     await page.click('.master-convert button[type=submit]');
     const response = await download; assert.equal(response.status(), 200); assert.match(response.headers()['content-type'], /spreadsheetml/);
     const [[unknown]] = await c.execute("SELECT COUNT(*) AS n FROM perpustakaan_namas WHERE nama_latin='baru' AND status='1'"); assert.equal(unknown.n,1);
    }
   } finally { await rm(folder, { recursive: true, force: true }); }
  }
 }
 const thumbs = await Promise.all(captures.map(async ({ capture }) => sharp(capture).resize({ width: 360, height: 300, fit: 'contain', background: '#ddd' }).png().toBuffer()));
 if (captures.length) await sharp({ create: { width: 1800, height: Math.ceil(captures.length / 5) * 300, channels: 3, background: '#ddd' } }).composite(thumbs.map((input, i) => ({ input, left: (i % 5) * 360, top: Math.floor(i / 5) * 300 }))).png().toFile(fileURLToPath(new URL('masters-contact-sheet.png', output)));
 if (!process.env.MASTER_UI_ACTIONS_ONLY) console.log('Master terpilih: desktop/HP, terang/gelap, data berisi/kosong, kolom tersimpan, keyboard, pagination, sort/filter, formulir/detail lulus.');
 console.log('Modul terpilih: tambah/edit, impor workbook dan konversi yang tersedia melalui browser lulus.');
} finally {
 if (browser) await browser.close();
 if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
 for (const table of createdTables) await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
 c.release(); await pool.end();
}
