import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { jakartaDate } from './wali-widget.js';

// Column lengths follow the database, which is stricter than some Laravel form limits.
const fields = [
 ['nama','Nama Lengkap Santri',255,'required'],['jenis_kelamin','Jenis Kelamin',255,'gender'],['tempat_lahir','Tempat Lahir Santri',80,'required'],
 ['tanggal_lahir','Tanggal Lahir Santri',2,'day'],['bulan_lahir','Bulan Lahir Santri',2,'month'],['tahun_lahir','Tahun Lahir Santri',4,'year'],
 ['nisn','NISN',20],['nik','NIK Santri',16,'nik'],['no_registrasi_akta_lahir','No. Registrasi Akta Lahir',80],['kewarganegaraan','Kewarganegaraan',80],
 ['alamat','Alamat Lengkap',120],['nama_kelurahan','Nama Kelurahan/Desa',80],['kecamatan','Kecamatan',80],['rt','RT',3,'digits'],['rw','RW',3,'digits'],['kode_pos','Kode Pos',5,'postal'],
 ['asal_sekolah','Asal Sekolah',80],['npsn','NPSN Asal Sekolah',20],['anak_ke','Anak Ke-',10,'integer'],['jumlah_saudara_kandung','Jumlah Saudara Kandung',10,'integer'],['berat_badan','Berat Badan (kg)',10,'integer'],['tinggi_badan','Tinggi Badan (cm)',10,'integer'],['jarak_ke_sekolah','Jarak ke Sekolah (km)',10,'distance'],['hobi','Hobi',255],
 ...['ayah','ibu','wali'].flatMap(person=>[[`nama_${person}`,`Nama ${person}`,80],[`nik_${person}`,`NIK ${person}`,80],[`pendidikan_${person}`,`Pendidikan ${person}`,255],[`pekerjaan_${person}`,`Pekerjaan ${person}`,255],[`penghasilan_bulanan_${person}`,`Penghasilan ${person} (per bulan)`,10,'integer'],[`tahun_lahir_${person}`,`Tahun Lahir ${person}`,10,'integer']]),
 ['email','Email',255,'email'],['nomor_hp','Nomor HP',15,'phone'],['tempat_tinggal','Tempat Tinggal',255],
];
const get = (obj,key)=>String(obj[key]??'').trim();
const failure=(status,message)=>({status,title:status===403?'Akses ditolak':'Edit Data Santri',body:`<section><p role="alert">${esc(message)}</p><a href="/dashboard">Kembali ke dasbor</a></section>`});
export function validate(data,year){
 const values={}, errors=[];
 for(const [key,label,max,rule] of fields){
  const value=get(data,key); values[key]=value||null;
  let bad=value.length>max;
  if(['required','gender','day','month','year','nik'].includes(rule)&&!value)bad=true;
  if(rule==='gender'&&value&&!['Laki-laki','Perempuan'].includes(value))bad=true;
  if(rule==='nik'&&value&&!/^\d{16}$/.test(value))bad=true;
  if(rule==='day'&&value&&(!/^\d+$/.test(value)||+value<1||+value>31))bad=true;
  if(rule==='month'&&value&&(!/^\d+$/.test(value)||+value<1||+value>12))bad=true;
  if(rule==='year'&&value&&(!/^\d+$/.test(value)||+value<1970||+value>year))bad=true;
  if(rule==='digits'&&value&&!/^\d+$/.test(value))bad=true;
  if(rule==='postal'&&value&&!/^\d{5}$/.test(value))bad=true;
  if(rule==='integer'&&value&&(!/^\d+$/.test(value)||Number(value)>2147483647))bad=true;
  if(rule==='distance'&&value&&(!/^\d{1,6}(?:\.\d{1,2})?$/.test(value)))bad=true;
  if(rule==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))bad=true;
  if(rule==='phone'&&value&&!/^\d{9,15}$/.test(value))bad=true;
  if(bad)errors.push(`${label}: periksa kembali isian.`);
 }
 if(!/^[1-9]\d{0,14}$/.test(get(data,'referral_source_id')))errors.push('Sumber informasi wajib dipilih.');
 if(!get(data,'jenjang'))errors.push('Jenjang pendidikan wajib dipilih.');
 return {values,errors};
}
export function renderForm(row,programs,referrals,csrf,errors=[],input=row,creating=false){
 const option=(value,label,selected)=>`<option value="${esc(value)}"${String(value)===String(selected??'')?' selected':''}>${esc(label)}</option>`;
 const choices=(name,label,items)=>`<label class="field"><span class="field-label">${label} <span class="required">*</span></span><span class="input-wrap"><select name="${name}" required><option value="">Pilih ${label}</option>${items.map(([v,l])=>option(v,l,input[name])).join('')}</select></span></label>`;
 const allPrograms=[...new Set([row.jenjang,...programs.map(p=>p.nama_program)].filter(Boolean))];
 const inputs=fields.map(([key,label,max,rule])=>{
  if(rule==='gender')return choices(key,label,[['Laki-laki','Laki-laki'],['Perempuan','Perempuan']]);
  const required=['required','day','month','year','nik'].includes(rule);
  return `<label class="field"><span class="field-label">${esc(label)}${required?' <span class="required">*</span>':''}</span><span class="input-wrap"><input name="${key}" value="${esc(input[key]??'')}" maxlength="${max}" ${required?'required':''} ${['nik','day','month','year','digits','integer','postal','phone'].includes(rule)?'inputmode="numeric"':''} ${rule==='email'?'type="email"':''}></span></label>`;
 }).join('');
 return {status:errors.length?422:200,title:creating?'Daftarkan Santri':'Edit Data Santri',body:`<section class="wali-edit"><form method="post" action="${creating?'/dashboard/santri-wali/create':`/dashboard/santri-wali/${esc(row.id)}/edit`}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${errors.length?`<div class="message" role="alert"><ul>${errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}${choices('jenjang','Jenjang Pendidikan',allPrograms.map(x=>[x,x]))}<small>${creating?'Pilih jenjang dengan penerimaan yang sedang aktif.':'Perubahan jenjang memerlukan penerimaan aktif untuk jenjang tersebut.'}</small>${choices('referral_source_id','Pertama Mengetahui Mahad Tahfizh Al Yusro dari',referrals.map(r=>[r.id,r.name]))}${inputs}<label class="field"><span class="field-label">Nomor KK</span><span class="input-wrap"><input value="${esc(row.no_kk)}" disabled></span></label><button type="submit">${creating?'Daftarkan Santri':'Simpan perubahan'}</button> <a href="/dashboard">Batal</a></form></section>`};
}
export async function selectAdmission(c,jenjang,today){
 const [waves]=await c.execute("SELECT a.id,a.kode_gelombang FROM penerimaan_santris a JOIN program_pendidikans p ON p.id=a.program_pendidikan_id WHERE p.nama_program=? AND a.status='aktif' AND a.tanggal_mulai<=? AND a.tanggal_selesai>=? ORDER BY a.id DESC LIMIT 1 FOR UPDATE",[jenjang,today,today]);
 return waves[0];
}
export async function nextRegistration(c,wave){
 const prefix=String(wave.kode_gelombang)+'-';
 // A locking read sees committed registrations after waiting for the admission lock.
 const [numbers]=await c.execute('SELECT nomor_pendaftaran FROM santris WHERE LEFT(nomor_pendaftaran,?)=? FOR UPDATE',[prefix.length,prefix]);
 let highest=0;for(const n of numbers){const suffix=String(n.nomor_pendaftaran).slice(prefix.length);if(/^\d+$/.test(suffix))highest=Math.max(highest,Number(suffix));}
 const number=prefix+String(highest+1).padStart(3,'0');return number.length<=20?number:null;
}
export function createWaliEdit(db=pool, now=()=>new Date()){
 return async function edit({user,access,id,csrf,data}){
  if(!access.permissions.includes('update_santri::wali'))return failure(403,'Anda tidak memiliki izin mengubah data santri.');
  const kk=String(user.nomor_kk??'').trim();
  if(!kk||!/^[1-9]\d{0,14}$/.test(id))return failure(404,'Data santri tidak ditemukan.');
  const c=await db.getConnection();
  try {
   if(data)await c.beginTransaction();
   const [found]=await c.execute('SELECT * FROM santris WHERE id=? AND no_kk=?'+(data?' FOR UPDATE':''),[id,kk]);
   if(!found.length){if(data)await c.rollback();return failure(404,'Data santri tidak ditemukan.');}
   const row=found[0],today=jakartaDate(now());
   const [programs]=await c.execute("SELECT DISTINCT p.nama_program FROM penerimaan_santris a JOIN program_pendidikans p ON p.id=a.program_pendidikan_id WHERE a.status='aktif' AND a.tanggal_mulai<=? AND a.tanggal_selesai>=? ORDER BY p.nama_program",[today,today]);
   const [referrals]=await c.execute('SELECT id,name FROM referral_sources ORDER BY name,id');
   if(!data)return renderForm(row,programs,referrals,csrf);
   const {values,errors}=validate(data,Number(today.slice(0,4)));
   const referral=get(data,'referral_source_id'),jenjang=get(data,'jenjang');
   if(!referrals.some(r=>String(r.id)===referral))errors.push('Sumber informasi tidak tersedia.');
   if(jenjang!==row.jenjang&&!programs.some(p=>p.nama_program===jenjang))errors.push('Penerimaan untuk jenjang tersebut tidak sedang aktif.');
   if(values.nik||values.nisn){const [duplicates]=await c.execute('SELECT id, nik, nisn FROM santris WHERE id<>? AND ((nik IS NOT NULL AND nik=?) OR (nisn IS NOT NULL AND nisn=?)) LIMIT 1',[id,values.nik,values.nisn]);if(duplicates.length)errors.push('NIK atau NISN sudah terdaftar pada santri lain.');}
   if(errors.length){await c.rollback();return renderForm(row,programs,referrals,csrf,errors,data);}
   let admission={};
   if(jenjang!==row.jenjang){
    const wave=await selectAdmission(c,jenjang,today);
    if(!wave){await c.rollback();return renderForm(row,programs,referrals,csrf,['Penerimaan untuk jenjang tersebut tidak sedang aktif.'],data);}
    const number=await nextRegistration(c,wave);
    if(!number){await c.rollback();return renderForm(row,programs,referrals,csrf,['Nomor pendaftaran terlalu panjang. Hubungi panitia.'],data);}
    admission={penerimaan_santri_id:wave.id,nomor_pendaftaran:number,...(row.status==='santri'?{status:'belum terverifikasi'}:{})};
   }
   const changes={...values,referral_source_id:referral,jenjang,...admission};
   await c.execute(`UPDATE santris SET ${Object.keys(changes).map(k=>`\`${k}\`=?`).join(',')},updated_at=NOW() WHERE id=? AND no_kk=?`,[...Object.values(changes),id,kk]);
   await c.commit();return {status:303};
  }catch(error){if(data)await c.rollback();if(error.code==='ER_DUP_ENTRY')return failure(409,'Data atau nomor pendaftaran sudah digunakan. Muat ulang dan coba lagi.');throw error;}finally{c.release();}
 };
}
export const waliEdit=createWaliEdit();
