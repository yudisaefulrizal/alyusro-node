import { tableQuery, renderTable, tableRowActions, tableExport, tableFilters } from './dashboard-table.js';
import { query } from './db.js';
import { esc } from './dashboard-shell.js';
import { documentFiles } from './wali-files.js';

export function createWaliDocuments(read=query) {
 return async function documents(user,access,params,id,csrf='') {
  const edit=id!==undefined;
  if(!access.permissions.includes(edit?'update_berkas::santri::wali':'view_any_berkas::santri::wali'))return {status:403,title:'Akses ditolak',body:'<section><p>Anda tidak memiliki izin untuk dokumen santri.</p></section>'};
  const kk=String(user.nomor_kk??'').trim();
  const missing=()=>({status:404,title:'Santri tidak ditemukan',body:'<section><p>Data santri tidak ditemukan.</p></section>'});
  if(edit&&!/^[1-9]\d{0,14}$/.test(id))return missing();
  if(!kk)return edit?missing():{status:200,title:'Dokumen santri',body:'<section><p>Lengkapi nomor KK akun untuk melihat dokumen santri.</p></section>'};
  if(edit){
   const [row]=await read(`SELECT s.*, (SELECT f.path FROM foto_santris f WHERE f.santri_id=s.id ORDER BY f.id LIMIT 1) AS foto FROM santris s WHERE s.no_kk=? AND s.id=? LIMIT 1`,[kk,id]);
   if(!row)return missing();
   const files=documentFiles(row);
   const body=files.map(([field,label])=>{
    const base=`/dashboard/dokumen-wali/${esc(id)}/${field}`;
    return `<div class="document-item"><h2>${esc(label)}</h2>${row[field]?`<a href="${base}" target="_blank" rel="noopener noreferrer"><img src="${base}" alt="${esc(label)}"></a><form method="post" action="${base}/delete" data-wali-delete><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="secondary" type="submit">Hapus</button></form>`:'<p>Belum diunggah.</p>'}<form method="post" action="${base}/upload" enctype="multipart/form-data"><input type="hidden" name="_csrf" value="${esc(csrf)}"><label>Pilih gambar <input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required></label><button type="submit">${row[field]?'Ganti':'Unggah'}</button></form></div>`;
   }).join('');
   return {status:200,title:'Perbarui Berkas Santri',body:`<section><p>${esc(row.nama)}</p><a href="/dashboard/dokumen-wali">Kembali ke daftar</a><div class="document-grid">${body}</div></section>`};
  }
  const query=tableQuery(params);
  if(!query)return {status:422,title:'Dokumen santri',body:'<section><p>Pencarian atau halaman tidak valid.</p></section>'};
  const filters=[{name:'dokumen',label:'Akta lahir',options:[{value:'ada',label:'Sudah diunggah'},{value:'belum',label:'Belum diunggah'}]}];const values=tableFilters(params,filters);
  if(!values)return {status:422,title:'Dokumen santri',body:'<p>Filter tidak valid.</p>'};
  const rows=await read(`SELECT COUNT(*) OVER() AS table_total,id,nama,foto_ijazah_sd,foto_ijazah_smp,foto_akta_lahir,foto_kartu_keluarga FROM santris WHERE no_kk=? AND nama LIKE ? ESCAPE '!' AND (? = '' OR (? = 'ada' AND foto_akta_lahir IS NOT NULL AND foto_akta_lahir <> '') OR (? = 'belum' AND (foto_akta_lahir IS NULL OR foto_akta_lahir = ''))) ORDER BY nama,id LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,[kk,query.pattern,values.dokumen,values.dokumen,values.dokumen]);
  const fields=[['foto_ijazah_sd','Ijazah SD'],['foto_ijazah_smp','Ijazah SMP'],['foto_akta_lahir','Akta Lahir'],['foto_kartu_keluarga','Kartu Keluarga']];
  const columns=[{key:'nama',label:'Nama'},...fields.map(([field,label])=>({label,html:row=>row[field]?`<a href="/dashboard/dokumen-wali/${esc(row.id)}/${field}" target="_blank" rel="noopener noreferrer"><img class="document-thumb" src="/dashboard/dokumen-wali/${esc(row.id)}/${field}" alt="${esc(label)}"></a>`:'—'}))];
  const exported=await tableExport(params,rows,[{key:'nama',label:'Nama'},...fields.map(([key,label])=>({label,value:row=>row[key]?'Sudah diunggah':'Belum diunggah'}))],'Dokumen santri');if(exported)return exported;
  if(access.permissions.includes('update_berkas::santri::wali'))columns.push({label:'Aksi',html:row=>tableRowActions([{label:'Perbarui Berkas',href:`/dashboard/dokumen-wali/${row.id}/edit`}])});
  return {status:200,title:'Dokumen santri',body:`<section>${renderTable({base:'/dashboard/dokumen-wali',query,rows,columns,exportable:true,filters:filters.map(f=>({...f,value:values[f.name]})),title:'dokumen santri',searchLabel:'Cari nama santri',emptyText:'Tidak ada santri yang cocok.'})}</section>`};
 };
}
export const waliDocuments=createWaliDocuments();
