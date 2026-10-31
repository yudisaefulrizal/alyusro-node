import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const configUrl = new URL('../src/config.js', import.meta.url).href;
test('standalone config loads env without Laravel and preserves process overrides', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'alyusro-config-'));
 try {
  const envFile = join(dir, '.env');
  await writeFile(envFile, 'PORT=9999\nDB_DATABASE=standalone\nPUBLIC_STORAGE_PATH=storage/custom\n');
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `const c=await import(${JSON.stringify(configUrl)}); console.log(JSON.stringify([c.setting('DB_DATABASE'),c.setting('PORT'),c.publicStorageRoot.href]));`], { env: { ...process.env, ENV_FILE:envFile, PORT:'8075', DB_DATABASE:'standalone' }, encoding:'utf8' });
  const [db, port, storage] = JSON.parse(output);
  assert.equal(db, 'standalone'); assert.equal(port, '8075'); assert.match(storage, /storage\/custom\/$/);
 } finally { await rm(dir, { recursive:true, force:true }); }
});
test('permission updates work without PHP and optionally invalidate an explicit shared cache', async () => {
 const { invalidatePermissionCache } = await import('../src/permission-cache.js');
 delete process.env.PERMISSION_CACHE_TABLE; delete process.env.PERMISSION_CACHE_KEY;
 await invalidatePermissionCache({ execute(){ throw new Error('cache must be optional'); } });
 process.env.PERMISSION_CACHE_TABLE='cache'; process.env.PERMISSION_CACHE_KEY='exact-key';
 try {
  let called=false;
  await invalidatePermissionCache({ async execute(sql,args){assert.equal(sql,'DELETE FROM `cache` WHERE `key`=?');assert.deepEqual(args,['exact-key']);called=true;} });
  assert.equal(called,true);
  process.env.PERMISSION_CACHE_TABLE='bad-table';
  await assert.rejects(invalidatePermissionCache({}), /PERMISSION_CACHE/);
 } finally { delete process.env.PERMISSION_CACHE_TABLE; delete process.env.PERMISSION_CACHE_KEY; }
});
test('print assets and PM2 config are bundled in the deployment', async () => {
 for (const path of ['template/ijazah.jpg','template/kartu santri umum.jpg','fonts/Amiri-Regular.ttf','pkbm/mahad.png']) await access(new URL('../assets/legacy-public/'+path,import.meta.url));
 const {default:config}=await import('../ecosystem.config.cjs');
 assert.equal(config.apps[0].script,'src/server.js'); assert.equal(config.apps[0].name,'alyusro-node');
});
