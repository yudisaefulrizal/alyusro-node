import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardStats } from '../src/dashboard-stats.js';
import { pool } from '../src/db.js';

test('statistik tanpa permission tidak menjalankan SQL', async () => {
  const stats = createDashboardStats(() => { throw Error('SQL tidak diizinkan'); });
  assert.equal(await stats({ permissions: [] }), '');
});
test('SQL statistik: status, jenjang, total, nol dan permission pada tabel TEMPORARY', async () => {
  const c = await pool.getConnection();
  try {
    await c.query('CREATE TEMPORARY TABLE santris (jenjang VARCHAR(255), status VARCHAR(255))');
    await c.query("INSERT INTO santris VALUES ('madrasah','santri'),('Madrasah','santri'),('taud','lulus'),('madrasah','diterima'),('lainnya','santri'),('kuttab','lulus')");
    const calls = [];
    const stats = createDashboardStats(async (sql, args) => { calls.push(args); return (await c.execute(sql, args))[0]; });
    const santri = await stats({ permissions: ['widget_JumlahSantri'] });
    assert.match(santri, /Total: <strong>2<\/strong>/);
    assert.match(santri, /height:100%/);
    assert.match(santri, /height:0%/);
    assert.doesNotMatch(santri, /<h2>Alumni/);
    assert.deepEqual(calls[0].slice(5), ['santri']);
    const both = await stats({ permissions: ['widget_JumlahSantri', 'widget_JumlahAlumni'] });
    assert.match(both, /<h2>Alumni/);
    assert.equal((both.match(/Total: <strong>2<\/strong>/g) || []).length, 2);
    await c.query('DELETE FROM santris');
    const empty = await stats({ permissions: ['widget_JumlahAlumni'] });
    assert.match(empty, /Total: <strong>0<\/strong>/);
    assert.doesNotMatch(empty, /NaN|Infinity/);
  } finally {
    await c.query('DROP TEMPORARY TABLE IF EXISTS santris');
    c.release();
  }
});
test.after(() => pool.end());
