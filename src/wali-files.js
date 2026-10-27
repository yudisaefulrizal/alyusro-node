import { studentRoot, studentFile } from './student-storage.js';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { sep } from 'node:path';
import sharp from 'sharp';
import { pool } from './db.js';

const payment = {'Kuttab':'kuttab','Madrasah':'madrasah',"Darul 'Ilmi":'darul_ilmi',"Ma'had 'Aly":'mahad_aly','TK TAUD':'tk_taud','Mahdon Tarbawi':'mahdon_tarbawi'};
export function cardFiles(row) {
  const fields = [['foto','Pass Foto 3x4'],['foto_akta_lahir','Akta Lahir'],['foto_kartu_keluarga','Kartu Keluarga']];
  if (row.status_defined && payment[row.jenjang]) fields.splice(1,0,[`foto_pembayaran_psb_${payment[row.jenjang]}`,'Bukti pembayaran pendaftaran']);
  if (row.jenjang === 'Madrasah') fields.push(['foto_ijazah_sd','Ijazah SD (jika sudah keluar)']);
  if (row.jenjang === "Darul 'Ilmi") fields.push(['foto_ijazah_smp','Ijazah SMP (jika sudah keluar)']);
  if (row.jenjang === "Ma'had 'Aly") fields.push(['foto_ijazah_sma','Ijazah SMA (jika sudah keluar)']);
  if (row.jenjang === 'Madrasah' && row.status === 'diterima') fields.push(['foto_surat_komitment_madrasah','Surat Komitmen Madrasah']);
  if (row.jenjang === "Darul 'Ilmi") fields.push(['foto_surat_komitment_darul_ilmi','Surat Komitmen Darul Ilmi']);
  if (row.jenjang === "Ma'had 'Aly" && row.status === 'diterima') fields.push(['foto_surat_komitment_mahad_aly',"Surat Komitmen Ma'had 'Aly"]);
  return fields;
}
// Resource Dokumen Santri has its own visibility rules and permissions.
export function documentFiles(row) {
  const result=[['foto','Pass Foto 3x4'],['foto_akta_lahir','Akta Lahir'],['foto_kartu_keluarga','Kartu Keluarga'],['foto_ijazah_sd','Ijazah SD']];
  const normalized=String(row.jenjang??'').toLowerCase().replace(/[^a-z]/g,'');
  const levels={tktaud:'tk_taud',kuttab:'kuttab',madrasah:'madrasah',darulilmi:'darul_ilmi',mahadaly:'mahad_aly'};
  if(levels[normalized])result.unshift([`foto_pembayaran_psb_${levels[normalized]}`,'Bukti pembayaran PSB']);
  if(normalized!=='madrasah')result.push(['foto_ijazah_smp','Ijazah SMP']);
  return result;
}
export function candidateFiles(row) {
  const fields=[['foto','Pass Foto'],['foto_akta_lahir','Akta Lahir'],['foto_kartu_keluarga','Kartu Keluarga']];
  const payments={'Madrasah':'madrasah',"Darul 'Ilmi":'darul_ilmi',"Ma'had 'Aly":'mahad_aly','Mahdon Tarbawi':'mahdon_tarbawi'};
  const diplomas={'Madrasah':'sd',"Darul 'Ilmi":'smp',"Ma'had 'Aly":'sma'};
  if(payments[row.jenjang])fields.push([`foto_pembayaran_psb_${payments[row.jenjang]}`,'Bukti Pembayaran']);
  if(diplomas[row.jenjang])fields.push([`foto_ijazah_${diplomas[row.jenjang]}`,'Ijazah']);
  if (["Darul 'Ilmi", "Ma'had 'Aly"].includes(row.jenjang)) fields.push([row.jenjang === "Darul 'Ilmi" ? 'foto_surat_komitment_darul_ilmi' : 'foto_surat_komitment_mahad_aly','Surat Komitmen']);
  return fields;
}
const validId = id => /^[1-9]\d{0,14}$/.test(id);
const allowed = (access, mutation, scope) => scope==='documents' ? (mutation ? access.permissions.includes('update_berkas::santri::wali') : access.permissions.includes('view_any_berkas::santri::wali') || access.permissions.includes('update_berkas::santri::wali')) : access.permissions.includes('view_any_santri::wali') && (!mutation || access.permissions.includes('update_santri::wali'));
const select = `SELECT s.*, sc.id IS NOT NULL AS status_defined, (SELECT f.path FROM foto_santris f WHERE f.santri_id=s.id ORDER BY f.id LIMIT 1) AS foto FROM santris s LEFT JOIN status_catatan sc ON sc.status=s.status WHERE s.id=? AND s.no_kk=?`;
export function createWaliFiles(db=pool, root=studentRoot) {
  async function record(c,id,kk,lock=false) { const [rows]=await c.execute(select+(lock?' FOR UPDATE':''),[id,kk]); return rows[0]; }
  return async function files({user,access,id,field,action='read',image,scope='card'}) {
    const mutation=action!=='read';
    if (scope==='candidate' ? (mutation || !access.permissions.includes('view_any_calon::santri')) : !allowed(access,mutation,scope)) return {status:403};
    const kk=String(user.nomor_kk??'').trim();
    if ((scope!=='candidate' && !kk) || !validId(id) || !/^[a-z_]+$/.test(field)) return {status:404};
    if (!['read','upload','delete'].includes(action)) return {status:404};
    let converted;
    if (action==='upload') {
      try {
        if (!Buffer.isBuffer(image) || !image.length || image.length>1048576) return {status:422};
        const source=sharp(image,{limitInputPixels:16000000}); const meta=await source.metadata();
        if (!['jpeg','png','webp'].includes(meta.format)) return {status:422};
        converted=await source.rotate().resize({height:1080,withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
      } catch { return {status:422}; }
    }
    const c=await db.getConnection(); let path;
    try {
      if(mutation) await c.beginTransaction();
      const row=scope==='candidate' ? (await c.execute(`SELECT s.*, (SELECT f.path FROM foto_santris f WHERE f.santri_id=s.id ORDER BY f.id LIMIT 1) AS foto FROM santris s WHERE s.id=? AND s.status NOT IN ('Santri','Lulus','Di Keluarkan')`,[id]))[0][0] : await record(c,id,kk,mutation);
      if (!row || !(scope==='candidate' ? candidateFiles(row) : scope==='documents' ? [...documentFiles(row),...(!mutation?[['foto_ijazah_sd'],['foto_ijazah_smp'],['foto_akta_lahir'],['foto_kartu_keluarga']]:[])] : cardFiles(row)).some(([name])=>name===field)) {if(mutation)await c.rollback();return {status:404};}
      if(!mutation) {
        if(!row[field])return {status:404};
        try {
          const stored=await studentFile(row[field],root);
          if(!stored)return {status:404};
          const {file}=stored;
          const content=await sharp(await readFile(file),{limitInputPixels:16000000}).rotate().resize({height:1080,withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
          return {status:200,content};
        } catch { return {status:404}; }
      }
      if(action==='upload') {
        const dir=new URL('uploads/node-wali/',root); await mkdir(dir,{recursive:true});
        const base=await realpath(root), destination=await realpath(dir);
        if(!destination.startsWith(base+sep))throw new Error('Lokasi unggahan tidak valid.');
        path='uploads/node-wali/'+randomBytes(24).toString('hex')+'.jpg';
        await writeFile(new URL(path,root),converted,{mode:0o644,flag:'wx'});
      }
      if(field==='foto') {
        await c.execute('DELETE FROM foto_santris WHERE santri_id=?',[id]);
        if(path)await c.execute('INSERT INTO foto_santris (santri_id,path,created_at,updated_at) VALUES (?,?,NOW(),NOW())',[id,path]);
      } else {
        // field is selected only from cardFiles' fixed server-side whitelist.
        await c.execute(`UPDATE santris SET \`${field}\`=?, updated_at=NOW() WHERE id=? AND no_kk=?`,[path??null,id,kk]);
      }
      await c.commit(); return {status:303};
    } catch(error) {
      if(mutation)await c.rollback();
      if(path)await unlink(new URL(path,root)).catch(()=>{});
      throw error;
    } finally { c.release(); }
  };
}
export const waliFiles=createWaliFiles();
