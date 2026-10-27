import { tableQuery, renderTable, selectedTableIds, tableRowActions, tableExport, tableFilters } from './dashboard-table.js';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';

const base='/dashboard/sumber-informasi';
const isId=id=>/^[1-9]\d{0,14}$/.test(String(id));
const message=(status,text)=>({status,title:'Sumber Informasi',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali ke daftar</a></section>`});
export const slugFor=name=>name.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'');
function form(row,csrf,errors=[],input=row){
 const isNew=!row.id;
 return {status:errors.length?422:200,title:isNew?'Tambah Sumber Informasi':'Edit Sumber Informasi',body:`<section class="status-note-form"><form method="post" action="${base}/${isNew?'create':`${esc(row.id)}/edit`}"><input type="hidden" name="_csrf" value="${esc(csrf)}">${errors.length?`<div role="alert" class="message">${errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:''}<label class="field"><span class="field-label">Nama Sumber <span class="required">*</span></span><span class="input-wrap"><input name="name" maxlength="100" value="${esc(input.name??'')}" required></span></label>${!isNew?`<label class="field"><span class="field-label">Slug</span><span class="input-wrap"><input value="${esc(row.slug)}" disabled></span></label>`:'<p>Slug dibuat otomatis dari nama.</p>'}<label class="field"><span class="field-label">Deskripsi</span><span class="input-wrap"><textarea name="description" rows="2" maxlength="255">${esc(input.description??'')}</textarea></span></label><button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>`};
}
export function createReferralSources(db=pool){
 return async function referrals({access,action='list',id,params=new URLSearchParams(),csrf='',data}){
  const permission={list:'view_any',create:'create',edit:'update',delete:'delete_any'}[action];
  if(!permission)return message(404,'Halaman tidak ditemukan.');
  if(!access.permissions.includes(`${permission}_referral::source`))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
  if(action==='edit'&&!isId(id))return message(404,'Sumber informasi tidak ditemukan.');
  const c=await db.getConnection();
  try{
   if(action==='list'){
    const query=tableQuery(params,{sorts:['name','santris_count'],defaultSort:'name'});
    if(!query)return message(422,'Pencarian, urutan, atau halaman tidak valid.');
    const filters=[{name:'jumlah',label:'Santri terkait',options:[{value:'ada',label:'Ada'},{value:'kosong',label:'Tidak ada'}]}];const values=tableFilters(params,filters);if(!values)return message(422,'Filter tidak valid.');
    const [rows]=await c.execute(`SELECT COUNT(*) OVER() AS table_total,r.id,r.name,COALESCE(sc.santris_count,0) AS santris_count FROM referral_sources r LEFT JOIN (SELECT referral_source_id,COUNT(*) AS santris_count FROM santris GROUP BY referral_source_id) sc ON sc.referral_source_id=r.id WHERE r.name LIKE ? ESCAPE '!' AND (? = '' OR (? = 'ada' AND sc.santris_count > 0) OR (? = 'kosong' AND sc.santris_count IS NULL)) ORDER BY ${query.sort==='name'?'r.name':'santris_count'} ${query.direction.toUpperCase()},r.id LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,[query.pattern,values.jumlah,values.jumlah,values.jumlah]);
    const canDelete=access.permissions.includes('delete_any_referral::source'),canEdit=access.permissions.includes('update_referral::source');
    const columns=[{key:'name',label:'Nama'},{key:'santris_count',label:'Jumlah Santri'}];
    const exported=await tableExport(params,rows,columns,'Sumber Informasi');if(exported)return exported;
    if(canEdit)columns.push({label:'Aksi',html:row=>tableRowActions([{label:'Edit',href:`${base}/${row.id}/edit`}])});
    const table=renderTable({base,query,rows,columns,exportable:true,filters:filters.map(f=>({...f,value:values[f.name]})),title:'sumber informasi',searchLabel:'Cari nama',emptyText:'Tidak ada sumber yang cocok.',sortOptions:[{value:'name',label:'Nama'},{value:'santris_count',label:'Jumlah Santri'}],bulk:canDelete?{action:`${base}/delete`,csrf,rowLabel:row=>row.name,confirm:'Hapus sumber yang dipilih? Sumber informasi pada santri terkait akan dikosongkan.',notice:'Penghapusan mengosongkan sumber informasi pada santri yang terkait.'}:null});
    return {status:200,title:'Sumber Informasi',body:`<section>${access.permissions.includes('create_referral::source')?`<p class="table-create"><a href="${base}/create">Tambah Sumber Informasi</a></p>`:''}${table}</section>`};
   }
   if(action==='delete'){
    if(!data)return message(405,'Metode tidak tersedia.');
    const ids=selectedTableIds(data);
    if(!ids)return message(422,'Pilih satu sampai 100 sumber yang akan dihapus.');
    await c.execute(`DELETE FROM referral_sources WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);return {status:303};
   }
   let row={};
   if(action==='edit'){const [rows]=await c.execute('SELECT id,name,slug,description FROM referral_sources WHERE id=?',[id]);if(!rows.length)return message(404,'Sumber informasi tidak ditemukan.');row=rows[0];}
   if(!data)return form(row,csrf);
   const name=String(data.name??'').trim(),description=String(data.description??'').trim(),slug=slugFor(name),errors=[];
   if(!name||Array.from(name).length>100)errors.push('Nama sumber wajib diisi, maksimal 100 karakter.');
   if(Array.from(description).length>255)errors.push('Deskripsi maksimal 255 karakter.');
   if(action==='create'&&(!slug||Array.from(slug).length>100))errors.push('Nama harus menghasilkan slug yang valid, maksimal 100 karakter.');
   if(errors.length)return form(row,csrf,errors,data);
   try{
    if(action==='create')await c.execute('INSERT INTO referral_sources (name,slug,description,created_at,updated_at) VALUES (?,?,?,NOW(),NOW())',[name,slug,description||null]);
    else{const [updated]=await c.execute('UPDATE referral_sources SET name=?,description=?,updated_at=NOW() WHERE id=?',[name,description||null,id]);if(!updated.affectedRows)return message(404,'Sumber informasi tidak ditemukan.');}
   }catch(error){if(error.code==='ER_DUP_ENTRY')return form(row,csrf,['Slug sudah digunakan oleh sumber lain.'],data);throw error;}
   return {status:303};
  }finally{c.release();}
 };
}
export const referralSources=createReferralSources();
