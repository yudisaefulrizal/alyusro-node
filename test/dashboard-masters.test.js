import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { pool } from '../src/db.js';
import { createAuthHandler } from '../src/auth.js';
import { masterResources, masterRoute, createDashboardMasters } from '../src/dashboard-masters.js';

const sample = {
 'kategori-artikel': { nama: '100% <Uji>', status: 'aktif' },
 'kategori-fasilitas': { nama_kategori: '100% <Uji>', deskripsi_kategori: '<script>uji</script>' },
 'struktur-mahad': { struktur: '100% <Uji>', nama: '<img src=x onerror=alert(1)>', level: '2' },
 menu: { nama: '100% <Uji>', route: 'dashboard.test', icon: 'ysr-artikel', views: '0', waktu: '2', status: 'aktif' },
 'event-mahad': { nama: '100% <Uji>', tanggal: '27', bulan: '10', tahun: '2026' }
};
// Resolve the baseline DDL from the repository, never populate the actual shared tables.
async function setup(c, config) {
 const { readdir } = await import('node:fs/promises');
 const files = await readdir(new URL('../../database/migrations/', import.meta.url));
 const filename = files.find(f => f.endsWith(`_create_${config.table}_table.php`));
 const source = await readFile(new URL('../../database/migrations/' + filename, import.meta.url), 'utf8');
 const ddl = source.match(/CREATE TABLE[\s\S]*?ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/)[0];
 await c.query(ddl.replace('CREATE TABLE', 'CREATE TEMPORARY TABLE'));
 for (const [table, key] of config.related || []) await c.query(`CREATE TEMPORARY TABLE ${table} (id BIGINT PRIMARY KEY,${key} BIGINT)`);
}
const hash = value => createHash('sha256').update(value).digest('hex');
for (const [resource, config] of Object.entries(masterResources)) test(`${resource}: SQL/HTTP CRUD, permission, filter, ekspor, isolasi dan relasi`, async t => {
 const c = await pool.getConnection();
 let server;
 try {
  await setup(c, config);
  const masters = createDashboardMasters({ getConnection: async () => ({ execute: (...args) => c.execute(...args), beginTransaction: () => c.beginTransaction(), commit: () => c.commit(), rollback: () => c.rollback(), release() {} }) });
  const access = { roles: ['Penguji'], permissions: ['view_any', 'view', 'create', 'update', 'delete', 'delete_any'].map(p => p + '_' + config.permission) };
  const call = (action, extra = {}) => masters({ resource, access, action, csrf: 'csrf', ...extra });
  for (const action of ['list', 'create', 'edit', 'bulkDelete', ...(config.view ? ['view', 'delete'] : [])]) assert.equal((await call(action, { id: '1', access: { permissions: [] } })).status, 403);
  assert.equal((await call('create', { data: {} })).status, 422);
  assert.equal((await call('create', { data: sample[resource] })).status, 303);
  assert.equal((await call('create', { data: sample[resource] })).status, 303);
  const [[row]] = await c.query(`SELECT * FROM ${config.table} WHERE id=1`);
  if (config.slug) {
   const [slugs] = await c.query(`SELECT slug FROM ${config.table} ORDER BY id`);
   assert.deepEqual(slugs.map(r => r.slug), ['100-uji', '100-uji-1']);
  }
  const list = await call('list', { params: new URLSearchParams('q=%25') });
  assert.equal(list.status, 200); assert.match(list.body, /100% &lt;Uji&gt;/); assert.doesNotMatch(list.body, /<img src=x/);
  assert.match(list.body, /data-table-key=/); assert.match(list.body, /2 data/);
  assert.doesNotMatch((await call('list', { params: new URLSearchParams('q=_') })).body, /100% &lt;Uji&gt;/);
  assert.equal((await call('list', { params: new URLSearchParams('sort=id;DROP') })).status, 422);
  assert.equal((await call('list', { params: new URLSearchParams('per_page=0') })).status, 422);
  for (const sort of config.sorts) assert.equal((await call('list', { params: new URLSearchParams({ sort, direction: 'desc' }) })).status, 200);
  const empty = await call('list', { params: new URLSearchParams('q=missing') }); assert.match(empty.body, /0 data/);
  const readOnly = await call('list', { access: { permissions: ['view_any_' + config.permission] } });
  assert.doesNotMatch(readOnly.body, /data-table-bulk|\/create|\/1\/edit/);
  if (config.fields.some(f => f.options)) {
   assert.equal((await call('list', { params: new URLSearchParams('status=bogus') })).status, 422);
   assert.match((await call('list', { params: new URLSearchParams('status=aktif') })).body, /100% &lt;Uji&gt;/);
   const filtered = await call('list', { params: new URLSearchParams({ status: config.fields.find(f => f.options).options[1], export: 'xlsx' }) });
   const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(filtered.xlsx); assert.equal(workbook.worksheets[0].rowCount, 1);
  }
  const exported = await call('list', { params: new URLSearchParams('q=%25&export=xlsx&direction=desc') });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(exported.xlsx);
  assert.equal(workbook.worksheets[0].rowCount, 3); assert.equal(workbook.worksheets[0].getCell('A2').value, sample[resource][config.fields[0].key]);
  assert.equal((await call('edit', { id: '999' })).status, 404);
  assert.equal((await call('edit', { id: 'bad' })).status, 404);
  assert.equal((await call('edit', { id: '1', data: { ...sample[resource], [config.statusOnly ? 'status' : config.fields[0].key]: config.statusOnly ? 'tidak aktif' : 'Diperbarui', nama: config.statusOnly ? 'Diabaikan' : sample[resource].nama } })).status, 303);
  const [[edited]] = await c.query(`SELECT * FROM ${config.table} WHERE id=1`);
  if (config.statusOnly) { assert.equal(edited.nama, row.nama); assert.equal(edited.status, 'tidak aktif'); }
  for (const f of config.fields.filter(f => f.type === 'number')) assert.equal((await call('edit', { id: '1', data: { ...sample[resource], [f.key]: '2147483648' } })).status, 422);
  if (config.view) { assert.equal((await call('view', { id: '1' })).status, 200); assert.equal((await call('delete', { id: '1', data: { confirm: 'wrong' } })).status, 422); }
  assert.equal((await call('bulkDelete', { data: { id_1: '1', bad: '1' } })).status, 422);
  assert.equal((await call('bulkDelete', { data: { id_1: '1', id_999: '1' } })).status, 404);
  for (const [table, key] of config.related || []) {
   await c.execute(`INSERT INTO ${table} (id,${key}) VALUES (1,1)`);
   assert.equal((await call('bulkDelete', { data: { id_1: '1', id_2: '1' } })).status, 422);
   const [[count]] = await c.query(`SELECT COUNT(*) AS n FROM ${config.table}`); assert.equal(count.n, 2);
   await c.execute(`DELETE FROM ${table} WHERE id=1`);
  }
  // Exercise the real HTTP routing with this isolated SQL connection and an authenticated fixture session.
  const raw = 'a'.repeat(64), user = { id: 1, name: 'Penguji', password: 'fixture-hash' };
  const session = { id: hash(raw), user_id: 1, password_hash: hash(user.password), csrf: 'csrf' };
  const store = { session: async () => session, user: async () => user, access: async () => access, touch: async () => {} };
  const handler = createAuthHandler({ store, masters });
  server = http.createServer(async (req, res) => { await handler(req, res, new URL(req.url, 'http://localhost').pathname); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, base = origin + '/dashboard/' + resource;
  const headers = { cookie: 'alyusro_node_session=' + raw };
  const get = await fetch(base, { headers }); assert.equal(get.status, 200); assert.equal(get.headers.get('cache-control'), 'no-store'); assert.match(await get.text(), new RegExp(`href="/dashboard/${resource}"`));
  const head = await fetch(base, { method: 'HEAD', headers }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const post = (path, data, extra = {}) => fetch(base + path, { method: 'POST', headers: { ...headers, origin, ...extra }, body: new URLSearchParams(data), redirect: 'manual' });
  assert.equal((await post('/create', sample[resource])).status, 403);
  assert.equal((await post('/create', { ...sample[resource], _csrf: 'csrf' }, { origin: 'https://evil.test' })).status, 403);
  if (resource === 'kategori-fasilitas') {
   const long = 'Deskripsi '.repeat(3000);
   assert.equal((await post('/create', { ...sample[resource], deskripsi_kategori: long, _csrf: 'csrf' })).status, 303);
   const [[stored]] = await c.query('SELECT deskripsi_kategori FROM kategori_fasilitas ORDER BY id DESC LIMIT 1');
   assert.equal(stored.deskripsi_kategori, long.trim());
  }
  const created = await post('/create', { ...sample[resource], _csrf: 'csrf' }); assert.equal(created.status, 303); assert.equal(created.headers.get('location'), '/dashboard/' + resource);
  assert.equal((await post('', { _csrf: 'csrf' })).status, 405);
  access.permissions = [];
  assert.equal((await fetch(base, { headers })).status, 403);
  assert.equal((await post('/create', { ...sample[resource], _csrf: 'csrf' })).status, 403);
  access.permissions = ['delete_any_' + config.permission];
  assert.equal((await post('/delete', { id_1: '1', _csrf: 'csrf' })).status, 303);
  const [[deleted]] = await c.query(`SELECT * FROM ${config.table} WHERE id=1`);
  if (config.softDelete) { assert.ok(deleted.deleted_at); assert.equal((await call('edit', { id: '1', access: { permissions: ['update_' + config.permission] } })).status, 404); } else assert.equal(deleted, undefined);
 } finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await c.rollback();
  for (const table of [config.table, ...(config.related || []).map(r => r[0])]) await c.query(`DROP TEMPORARY TABLE IF EXISTS ${table}`);
  c.release();
 }
});
test('master routes whitelist dan identifier', () => {
 assert.equal(masterRoute('/dashboard/users'), null);
 assert.equal(masterRoute('/dashboard/menu/0/edit'), null);
 assert.equal(masterRoute('/dashboard/menu/1;DROP/edit'), null);
 assert.equal(masterRoute('/dashboard/menu/delete').action, 'bulkDelete');
});
test.after(() => pool.end());
