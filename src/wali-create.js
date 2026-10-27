import { pool } from './db.js';
import { jakartaDate } from './wali-widget.js';
import { renderForm, validate, selectAdmission, nextRegistration } from './wali-edit.js';

const familyFields=['alamat','nama_kelurahan','kecamatan','rt','rw','kode_pos',...['ayah','ibu','wali'].flatMap(p=>['nama','nik','pendidikan','pekerjaan','penghasilan_bulanan','tahun_lahir'].map(f=>`${f}_${p}`))];
const denied=(status,message)=>({status,title:'Daftarkan Santri',body:`<section><p>${message}</p><a href="/dashboard">Kembali ke dasbor</a></section>`});
export function createWaliRegistration(db=pool,now=()=>new Date()) {
 return async function register({user,access,csrf,data}) {
  if(!access.permissions.includes('create_santri::wali'))return denied(403,'Anda tidak memiliki izin mendaftarkan santri.');
  const kk=String(user.nomor_kk??'').trim();
  if(!kk)return denied(422,'Lengkapi nomor KK akun sebelum mendaftarkan santri.');
  const c=await db.getConnection();
  try {
   if(data)await c.beginTransaction();
   const today=jakartaDate(now());
   const [programs]=await c.execute("SELECT DISTINCT p.nama_program FROM penerimaan_santris a JOIN program_pendidikans p ON p.id=a.program_pendidikan_id WHERE a.status='aktif' AND a.tanggal_mulai<=? AND a.tanggal_selesai>=? ORDER BY p.nama_program",[today,today]);
   const [referrals]=await c.execute('SELECT id,name FROM referral_sources ORDER BY name,id');
   const [previous]=await c.execute('SELECT * FROM santris WHERE no_kk=? ORDER BY id LIMIT 1',[kk]);
   const row={no_kk:kk};if(previous.length)for(const key of familyFields)row[key]=previous[0][key];
   if(!data)return renderForm(row,programs,referrals,csrf,[],row,true);
   const {values,errors}=validate(data,Number(today.slice(0,4)));
   const referral=String(data.referral_source_id??'').trim(),jenjang=String(data.jenjang??'').trim();
   if(!referrals.some(r=>String(r.id)===referral))errors.push('Sumber informasi tidak tersedia.');
   if(!programs.some(p=>p.nama_program===jenjang))errors.push('Penerimaan untuk jenjang tersebut tidak sedang aktif.');
   if(values.nik||values.nisn){const [duplicates]=await c.execute('SELECT id FROM santris WHERE (nik IS NOT NULL AND nik=?) OR (nisn IS NOT NULL AND nisn=?) LIMIT 1',[values.nik,values.nisn]);if(duplicates.length)errors.push('NIK atau NISN sudah terdaftar pada santri lain.');}
   if(errors.length){await c.rollback();return renderForm(row,programs,referrals,csrf,errors,data,true);}
   const wave=await selectAdmission(c,jenjang,today);
   if(!wave){await c.rollback();return renderForm(row,programs,referrals,csrf,['Penerimaan untuk jenjang tersebut tidak sedang aktif.'],data,true);}
   const number=await nextRegistration(c,wave);
   if(!number){await c.rollback();return renderForm(row,programs,referrals,csrf,['Nomor pendaftaran terlalu panjang. Hubungi panitia.'],data,true);}
   const changes={...values,referral_source_id:referral,jenjang,no_kk:kk,status:'belum terverifikasi',penerimaan_santri_id:wave.id,nomor_pendaftaran:number};
   await c.execute(`INSERT INTO santris (${Object.keys(changes).map(k=>`\`${k}\``).join(',')},created_at,updated_at) VALUES (${Object.keys(changes).map(()=>'?').join(',')},NOW(),NOW())`,Object.values(changes));
   await c.commit();return {status:303};
  } catch(error) {
   if(data)await c.rollback();
   if(error.code==='ER_DUP_ENTRY')return denied(409,'Nomor pendaftaran sudah digunakan. Muat ulang dan coba lagi.');
   throw error;
  } finally {c.release();}
 };
}
export const waliRegistration=createWaliRegistration();
