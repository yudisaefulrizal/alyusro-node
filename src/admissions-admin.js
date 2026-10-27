import { tableQuery, renderTable, selectedTableIds, tableExcel, tableFilters, tableRowActions } from './dashboard-table.js';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
const base='/dashboard/penerimaan-santri';
const validId=id=>/^[1-9]\d{0,14}$/.test(String(id));
const message=(status,text)=>({status,title:'Penerimaan Santri',body:`<section><p role="${status>=400?'alert':'status'}">${esc(text)}</p><a href="${base}">Kembali ke daftar</a></section>`});
const names={"tk taud":'TD',kuttab:'KT',madrasah:'MD',"darul 'ilmi":'DI',"ma'had 'aly":'MA','mahdon tarbawi':'MT'};
const labels=[['tahun','Tahun Ajaran','text',true],['gelombang','Gelombang','number',true],['tanggal_mulai','Tanggal Mulai Pendaftaran','date',true],['tanggal_selesai','Tanggal Selesai Pendaftaran','date',true],['tanggal_tes','Tanggal Tes','date',true],['biaya_pendaftaran','Biaya Pendaftaran','number',true],['kuota','Kuota','number',false]];
const get=(data,key)=>String(data[key]??'').trim();
const dateValid=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;};
function form(row,programs,csrf,errors=[],data=row,mayDelete=false){
 const isNew=!row.id;
 const options=programs.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(data.program_pendidikan_id??'')?'selected':''}>${esc(p.nama_program)}</option>`).join('');
 const inputs=labels.map(([name,label,type,required])=>`<label class="field"><span class="field-label">${label}${required?' <span class="required">*</span>':''}</span><span class="input-wrap"><input type="${type}" name="${name}" value="${esc(data[name]??'')}" ${name==='tahun'?'maxlength="4" inputmode="numeric"':''} ${name==='gelombang'?'min="1" max="4" step="1"':''} ${['biaya_pendaftaran','kuota'].includes(name)?'min="0" step="1"':''} ${required?'required':''}></span></label>`).join('');
 const deleteForm=mayDelete&&!isNew?`<form method="post" action="${base}/${esc(row.id)}/delete" data-admission-delete><input type="hidden" name="_csrf" value="${esc(csrf)}"><button type="submit">Hapus gelombang</button><p>Gelombang yang sudah digunakan santri tidak dapat dihapus.</p></form>`:'';
 return {status:errors.length?422:200,title:isNew?'Tambah Penerimaan Santri':'Edit Penerimaan Santri',body:`<section class="status-note-form"><form method="post" action="${base}/${isNew?'create':`${esc(row.id)}/edit`}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${errors.length?`<div class="message" role="alert">${errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:''}<label class="field"><span class="field-label">Program Pendidikan <span class="required">*</span></span><span class="input-wrap"><select name="program_pendidikan_id" required><option value="">Pilih program</option>${options}</select></span></label>${inputs}<label class="field"><span class="field-label">Status <span class="required">*</span></span><span class="input-wrap"><select name="status" required><option value="nonaktif" ${data.status!=='aktif'?'selected':''}>Nonaktif</option><option value="aktif" ${data.status==='aktif'?'selected':''}>Aktif</option></select></span></label><label class="field"><span class="field-label">Catatan</span><span class="input-wrap"><textarea name="catatan" rows="3" maxlength="8000">${esc(data.catatan??'')}</textarea></span></label><button type="submit">Simpan</button> <a href="${base}">Batal</a></form>${deleteForm}</section>`};
}
export function createAdmissionsAdmin(db=pool){
 return async function admissions({access,action='list',id,params=new URLSearchParams(),csrf='',data}){
  const permission={list:'view_any',create:'create',edit:'update',delete:'delete',bulkDelete:'delete_any'}[action];
  if(!permission)return message(404,'Halaman tidak ditemukan.');
  if(!access.permissions.includes(`${permission}_penerimaan::santri`))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
  if(['edit','delete'].includes(action)&&!validId(id))return message(404,'Penerimaan tidak ditemukan.');
  const c=await db.getConnection();
  try{
   if(action==='list'){
    const query=tableQuery(params);
    if(!query)return message(422,'Pencarian atau halaman tidak valid.');
    const filters=[{name:'status',label:'Status',options:[{value:'aktif',label:'Aktif'},{value:'nonaktif',label:'Nonaktif'}]}];
    const filterValues=tableFilters(params,filters);if(!filterValues)return message(422,'Filter status tidak valid.');const {status}=filterValues;
    const [rows]=await c.execute(`SELECT COUNT(*) OVER() AS table_total,a.id,a.kode_gelombang,a.tanggal_mulai,a.tanggal_selesai,a.tanggal_tes,a.biaya_pendaftaran,a.status,(SELECT COUNT(*) FROM santris s WHERE s.penerimaan_santri_id=a.id) AS jumlah_santri FROM penerimaan_santris a WHERE a.kode_gelombang LIKE ? ESCAPE '!' AND (? = '' OR a.status = ?) ORDER BY a.id DESC LIMIT ${query.limit} OFFSET ${query.offset}`,[query.pattern,status,status]);
    if(params.has('export')){
     if(params.get('export')!=='xlsx')return message(422,'Format ekspor tidak valid.');
     const [exportRows]=await c.execute(`SELECT a.kode_gelombang,a.tanggal_mulai,a.tanggal_selesai,a.tanggal_tes,a.biaya_pendaftaran,a.status,(SELECT COUNT(*) FROM santris s WHERE s.penerimaan_santri_id=a.id) AS jumlah_santri FROM penerimaan_santris a WHERE a.kode_gelombang LIKE ? ESCAPE '!' AND (? = '' OR a.status = ?) ORDER BY a.id DESC LIMIT 10001`,[query.pattern,status,status]);
     if(exportRows.length>10000)return message(422,'Hasil ekspor melebihi 10.000 baris. Gunakan pencarian atau filter.');
     const columns=[['kode_gelombang','Kode Gelombang'],['tanggal_mulai','Dibuka'],['tanggal_selesai','Ditutup'],['tanggal_tes','Tanggal Tes'],['biaya_pendaftaran','Biaya Pendaftaran'],['status','Status'],['jumlah_santri','Santri']].map(([key,label])=>({key,label}));
     return {status:200,xlsx:await tableExcel(exportRows,columns)};
    }
    const canEdit=access.permissions.includes('update_penerimaan::santri'),canDelete=access.permissions.includes('delete_any_penerimaan::santri');
    const columns=[{key:'kode_gelombang',label:'Kode Gelombang'},{key:'tanggal_mulai',label:'Dibuka'},{key:'tanggal_selesai',label:'Ditutup'},{key:'tanggal_tes',label:'Tanggal Tes'},{label:'Biaya Pendaftaran',value:r=>'Rp '+new Intl.NumberFormat('id-ID').format(BigInt(r.biaya_pendaftaran))},{key:'status',label:'Status',html:r=>`<span class="table-status ${r.status==='aktif'?'is-active':''}">${esc(r.status==='aktif'?'Aktif':r.status==='nonaktif'?'Nonaktif':r.status??'—')}</span>`},{key:'jumlah_santri',label:'Santri'}];
    if(canEdit)columns.push({label:'Aksi',html:r=>tableRowActions([{label:'Edit',href:`${base}/${r.id}/edit`}])});
    const table=renderTable({base,query,rows,columns,title:'penerimaan',exportable:true,filters:filters.map(filter=>({...filter,value:filterValues[filter.name]})),searchLabel:'Cari kode gelombang',emptyText:'Tidak ada penerimaan yang cocok.',bulk:canDelete?{action:`${base}/delete`,csrf,rowLabel:r=>r.kode_gelombang,confirm:'Hapus gelombang penerimaan yang dipilih?',notice:'Gelombang yang sudah digunakan santri tidak dapat dihapus.'}:null});
    return {status:200,title:'Penerimaan Santri',body:`<section>${access.permissions.includes('create_penerimaan::santri')?`<p class="table-create"><a href="${base}/create">Tambah Penerimaan Santri</a></p>`:''}${table}</section>`};
   }
   if(action==='delete'||action==='bulkDelete'){
    if(!data)return message(405,'Metode tidak tersedia.');
    const ids=action==='delete'?(Object.keys(data).every(k=>k==='_csrf')?[id]:null):selectedTableIds(data);
    if(!ids)return message(422,'Pilih satu sampai 100 gelombang yang akan dihapus.');
    await c.beginTransaction();
    try{
     const placeholders=ids.map(()=>'?').join(',');
     const [locked]=await c.execute(`SELECT id FROM penerimaan_santris WHERE id IN (${placeholders}) FOR UPDATE`,ids);
     if(locked.length!==ids.length){await c.rollback();return message(404,'Penerimaan tidak ditemukan.');}
     const [used]=await c.execute(`SELECT id FROM santris WHERE penerimaan_santri_id IN (${placeholders}) LIMIT 1 FOR UPDATE`,ids);
     if(used.length){await c.rollback();return message(409,'Gelombang yang dipilih sudah digunakan santri dan tidak dapat dihapus.');}
     await c.execute(`DELETE FROM penerimaan_santris WHERE id IN (${placeholders})`,ids);await c.commit();return {status:303};
    }catch(error){await c.rollback();throw error;}
   }
   let row={status:'nonaktif'};
   if(action==='edit'){const [rows]=await c.execute('SELECT * FROM penerimaan_santris WHERE id=?',[id]);if(!rows.length)return message(404,'Penerimaan tidak ditemukan.');row=rows[0];}
   const [programs]=await c.execute('SELECT id,nama_program FROM program_pendidikans ORDER BY nama_program,id');
   if(!data)return form(row,programs,csrf,[],row,access.permissions.includes('delete_penerimaan::santri'));
   const value=Object.fromEntries(['program_pendidikan_id',...labels.map(x=>x[0]),'status','catatan'].map(k=>[k,get(data,k)]));
   const errors=[],program=programs.find(p=>String(p.id)===value.program_pendidikan_id);
   if(!program)errors.push('Program pendidikan tidak tersedia.');
   if(!/^\d{4}$/.test(value.tahun))errors.push('Tahun ajaran harus empat digit.');
   if(!/^[1-4]$/.test(value.gelombang))errors.push('Gelombang harus antara 1 dan 4.');
   for(const key of ['tanggal_mulai','tanggal_selesai','tanggal_tes'])if(!dateValid(value[key]))errors.push('Tanggal harus valid dan lengkap.');
   if(dateValid(value.tanggal_mulai)&&dateValid(value.tanggal_selesai)&&value.tanggal_selesai<value.tanggal_mulai)errors.push('Tanggal selesai tidak boleh sebelum tanggal mulai.');
   if(!/^\d{1,20}$/.test(value.biaya_pendaftaran)||( /^\d{1,20}$/.test(value.biaya_pendaftaran)&&BigInt(value.biaya_pendaftaran)>18446744073709551615n))errors.push('Biaya pendaftaran harus berupa bilangan bulat nonnegatif.');
   if(value.kuota&&(!/^\d{1,10}$/.test(value.kuota)||BigInt(value.kuota)>4294967295n))errors.push('Kuota harus berupa bilangan bulat nonnegatif.');
   if(!['aktif','nonaktif'].includes(value.status))errors.push('Status tidak valid.');
   if(value.catatan.length>8000)errors.push('Catatan maksimal 8000 karakter.');
   if(errors.length)return form(row,programs,csrf,errors,data,access.permissions.includes('delete_penerimaan::santri'));
   const code=`${names[String(program.nama_program).toLowerCase()]??'-'}-${value.tahun}-G${value.gelombang}`;
   const args=[value.program_pendidikan_id,value.tahun,value.gelombang,value.tanggal_mulai,value.tanggal_selesai,value.tanggal_tes,value.biaya_pendaftaran,value.kuota||null,value.status,value.catatan||null,code];
   try{
    if(action==='create')await c.execute('INSERT INTO penerimaan_santris (program_pendidikan_id,tahun,gelombang,tanggal_mulai,tanggal_selesai,tanggal_tes,biaya_pendaftaran,kuota,status,catatan,kode_gelombang,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',args);
    else{const [updated]=await c.execute('UPDATE penerimaan_santris SET program_pendidikan_id=?,tahun=?,gelombang=?,tanggal_mulai=?,tanggal_selesai=?,tanggal_tes=?,biaya_pendaftaran=?,kuota=?,status=?,catatan=?,kode_gelombang=?,updated_at=NOW() WHERE id=?',[...args,id]);if(!updated.affectedRows)return message(404,'Penerimaan tidak ditemukan.');}
   }catch(error){if(error.code==='ER_DUP_ENTRY')return form(row,programs,csrf,['Kode gelombang sudah digunakan.'],data,access.permissions.includes('delete_penerimaan::santri'));throw error;}
   return {status:303};
  }finally{c.release();}
 };
}
export const admissionsAdmin=createAdmissionsAdmin();
