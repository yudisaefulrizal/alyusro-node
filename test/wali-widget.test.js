import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaliWidget, jakartaDate } from '../src/wali-widget.js';
import { pool } from '../src/db.js';
import { createWaliDocuments } from '../src/wali-documents.js';
import { createWaliFiles, cardFiles, documentFiles } from '../src/wali-files.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
const access = { permissions: ['view_any_santri::wali','create_santri::wali'] };
test('widget wali: permission, KK kosong, escaping, batas daftar dan izin detail', async () => {
  assert.equal(jakartaDate(new Date('2026-10-26T18:00:00Z')), '2026-10-27');
  let calls = 0;
  const widget = createWaliWidget(async (sql, args) => {
    calls++;
    if (sql.includes('FROM penerimaan_santris WHERE')) { assert.deepEqual(args, ['2026-10-27', '2026-10-27']); return []; }
    assert.deepEqual(args, ['123']);
    return Array.from({length: 21}, (_, i) => ({id:i+1,nama:'<Santri>',status:'santri',jenjang:'Madrasah'}));
  }, () => new Date('2026-10-26T18:00:00Z'));
  assert.equal(await widget({}, {permissions:[]}), ''); assert.equal(calls, 0);
  assert.match(await widget({}, access), /Lengkapi nomor KK/); assert.equal(calls, 1);
  const html = await widget({nomor_kk:'123'}, access);
  assert.match(html, /&lt;Santri&gt;/); assert.match(html, /20 santri pertama/);
  assert.doesNotMatch(html, /href="\/dashboard\/santri-wali\/1"/);
  assert.doesNotMatch(await widget({nomor_kk:'123'}, {permissions:[...access.permissions,'view_santri::wali']}), /Lihat detail santri/);
  assert.match(await widget({nomor_kk:'123'}, {permissions:[...access.permissions,'update_santri::wali']}), /href="\/dashboard\/santri-wali\/1\/edit"/);
});
test('SQL widget wali: batas tanggal inklusif, mendatang terdekat, status dan isolasi KK', async () => {
  const c = await pool.getConnection();
  try {
    await c.query('CREATE TEMPORARY TABLE penerimaan_santris (id INT, kode_gelombang VARCHAR(100), gelombang INT, status VARCHAR(20), tanggal_mulai DATE, tanggal_selesai DATE, biaya_pendaftaran INT)');
    await c.query("INSERT INTO penerimaan_santris VALUES (1,'Berakhir',1,'aktif','2026-10-01','2026-10-26',100),(2,'Aktif <MD>',2,'aktif','2026-10-27','2026-10-27',100),(3,'Terdekat',3,'aktif','2026-10-28','2026-11-01',100),(4,'Terlambat',4,'aktif','2026-11-01','2026-11-10',100),(5,'Nonaktif',5,'nonaktif','2026-10-27','2026-11-10',100)");
    await c.query('CREATE TEMPORARY TABLE santris (id INT, no_kk VARCHAR(16), nama VARCHAR(100), nomor_pendaftaran VARCHAR(100), jenjang VARCHAR(100), status VARCHAR(100), catatan VARCHAR(100))');
    await c.query("INSERT INTO santris VALUES (1,'123','Anak sendiri','REG-1','Madrasah','diterima','Catatan uji'),(2,'456','Rahasia','REG-2','Madrasah','santri',NULL)");
    await c.query('CREATE TEMPORARY TABLE status_catatan (id INT, status VARCHAR(100), catatan TEXT, nomor_wa VARCHAR(255), pesan_whatsapp TEXT, label_tombol VARCHAR(255))');
    await c.execute('INSERT INTO status_catatan VALUES (1,?,?,?,?,?)', ['diterima','Silakan hubungi panitia','+628123456789','Halo {nama}, nomor {nomor}','Hubungi panitia']);
    for (const field of ['foto_akta_lahir','foto_kartu_keluarga','foto_ijazah_sd','foto_ijazah_smp','foto_ijazah_sma','foto_pembayaran_psb_kuttab','foto_pembayaran_psb_madrasah','foto_pembayaran_psb_darul_ilmi','foto_pembayaran_psb_mahad_aly','foto_pembayaran_psb_tk_taud','foto_pembayaran_psb_mahdon_tarbawi','foto_surat_komitment_madrasah','foto_surat_komitment_darul_ilmi','foto_surat_komitment_mahad_aly']) await c.query(`ALTER TABLE santris ADD COLUMN ${field} VARCHAR(255)`);
    await c.query('ALTER TABLE santris ADD COLUMN updated_at DATETIME, ADD COLUMN penerimaan_santri_id INT');
    await c.query('CREATE TEMPORARY TABLE foto_santris (id INT AUTO_INCREMENT PRIMARY KEY, santri_id INT, path VARCHAR(255), created_at DATETIME, updated_at DATETIME)');
    const widget = createWaliWidget(async (sql,args)=>(await c.execute(sql,args))[0], () => new Date('2026-10-27T00:00:00Z'));
    const html = await widget({nomor_kk:'123'}, access);
    assert.match(html, /Daftarkan santri lainnya/); assert.doesNotMatch(html, /Pendaftaran berikutnya/); assert.match(html, /REG-1/); assert.match(html, /Catatan uji/); assert.match(html, /Silakan hubungi panitia/); assert.match(html, /https:\/\/wa\.me\/628123456789\?text=Halo\+Anak\+sendiri%2C\+nomor\+REG-1/); assert.match(html, /Hubungi panitia/); assert.match(html, /Anak sendiri/);
    assert.doesNotMatch(html, /Berakhir|Terlambat|Nonaktif|Rahasia/);
    assert.doesNotMatch(await widget({nomor_kk:'999'}, access), /Anak sendiri|Rahasia/);
    const user={nomor_kk:'123'};
    const docs=createWaliDocuments(async(sql,args)=>(await c.execute(sql,args))[0]);
    const docAccess={permissions:['view_any_berkas::santri::wali','update_berkas::santri::wali']};
    assert.equal((await docs(user,{permissions:[]},new URLSearchParams())).status,403);
    assert.equal((await docs({nomor_kk:''},docAccess,new URLSearchParams(),'1')).status,404);
    assert.equal((await docs(user,docAccess,new URLSearchParams(),'2')).status,404);
    assert.match((await docs(user,docAccess,new URLSearchParams())).body,/Anak sendiri/);
    assert.doesNotMatch((await docs(user,docAccess,new URLSearchParams())).body,/Rahasia/);
    assert.match((await docs(user,docAccess,new URLSearchParams(),'1','csrf')).body,/Perbarui Berkas Santri|Ijazah SD/);
    assert.equal((await docs(user,{permissions:['view_any_berkas::santri::wali']},new URLSearchParams(),'1')).status,403);
    assert.equal((await docs(user,docAccess,new URLSearchParams('page=-1'))).status,422);
    assert.ok(documentFiles({jenjang:"Darul 'Ilmi"}).some(([f])=>f==='foto_pembayaran_psb_darul_ilmi'));
    const dir=await mkdtemp('/tmp/alyusro-wali-');
    try {
      const files=createWaliFiles({getConnection:async()=>({execute:(...args)=>c.execute(...args),beginTransaction:()=>c.beginTransaction(),commit:()=>c.commit(),rollback:()=>c.rollback(),release:()=>{}})},pathToFileURL(dir+'/'));
      const update={permissions:[...access.permissions,'update_santri::wali']};
      const png=await sharp({create:{width:3,height:4,channels:3,background:'blue'}}).png().toBuffer();
      const call=(opts={})=>files({user:{nomor_kk:'123'},access:update,id:'1',field:'foto_akta_lahir',...opts});
      assert.equal((await call({action:'upload',image:png,access})).status,403);
      assert.equal((await call({action:'upload',image:png,id:'2'})).status,404);
      assert.equal((await call({action:'upload',image:png,field:'foto_ijazah_sma'})).status,404);
      assert.equal((await call({action:'upload',image:Buffer.from('<svg/>')})).status,422);
      assert.equal((await call({action:'upload',image:png})).status,303);
      const file=await call(); assert.equal(file.status,200); assert.equal((await sharp(file.content).metadata()).format,'jpeg');
      assert.equal((await call({id:'2'})).status,404);
      assert.equal((await call({action:'delete'})).status,303); assert.equal((await call()).status,404);
      assert.equal((await call({field:'foto',action:'upload',image:png})).status,303);
      assert.equal((await call({field:'foto'})).status,200);
      assert.equal((await call({field:'foto',action:'delete'})).status,303);
      assert.equal((await call({field:'foto'})).status,404);
      const docArgs={scope:'documents',access:docAccess};
      assert.equal((await call({...docArgs,action:'upload',image:png,field:'foto_ijazah_sd'})).status,303);
      assert.equal((await call({...docArgs,field:'foto_ijazah_sd'})).status,200);
      assert.equal((await call({...docArgs,action:'upload',image:png,id:'2'})).status,404);
      assert.equal((await call({...docArgs,action:'delete',access:{permissions:['view_any_berkas::santri::wali']}})).status,403);
      assert.equal((await call({...docArgs,action:'upload',image:png,field:'foto_ijazah_smp'})).status,404);
      assert.equal((await call({...docArgs,action:'delete',field:'foto_ijazah_sd'})).status,303);

    } finally { await rm(dir,{recursive:true,force:true}); }
    assert.deepEqual(cardFiles({jenjang:'Madrasah',status:'diterima',status_defined:1}).map(x=>x[0]), ['foto','foto_pembayaran_psb_madrasah','foto_akta_lahir','foto_kartu_keluarga','foto_ijazah_sd','foto_surat_komitment_madrasah']);
    await c.execute('UPDATE status_catatan SET nomor_wa=?, label_tombol=?', ['javascript:alert(1)', '<script>']);
    const unsafe=await widget({nomor_kk:'123'}, access); assert.doesNotMatch(unsafe, /javascript:|<script>/);
    await c.execute('UPDATE status_catatan SET nomor_wa=?, label_tombol=?', ['https://chat.whatsapp.com/example', 'tidak ada']);
    assert.doesNotMatch(await widget({nomor_kk:'123'}, access), /chat\.whatsapp\.com/);
    await c.execute('UPDATE status_catatan SET label_tombol=?', ['Gabung']);
    assert.match(await widget({nomor_kk:'123'}, access), /https:\/\/chat\.whatsapp\.com\/example/);
    await c.query("UPDATE penerimaan_santris SET status='nonaktif' WHERE id=2");
    const upcoming=await widget({nomor_kk:'123'}, access); assert.match(upcoming, /28 Oktober 2026/); assert.match(upcoming, /Gelombang 3/); assert.doesNotMatch(upcoming, /Gelombang 4/);
  } finally {
    await c.query('DROP TEMPORARY TABLE IF EXISTS santris, penerimaan_santris, status_catatan, foto_santris'); c.release();
  }
});
test.after(() => pool.end());
