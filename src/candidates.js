import { candidateFiles } from './wali-files.js';
import { pool } from './db.js';
import { esc } from './dashboard-shell.js';
import { tableQuery, tableFilters, renderTable, tableExport, tableRowActions, selectedTableIds, tableExcel } from './dashboard-table.js';

const base='/dashboard/calon-santri';
const message=(status,text)=>({status,title:'Calon Santri',body:`<section><p>${esc(text)}</p><a href="${base}">Kembali ke daftar</a></section>`});
const excluded="'Santri','Lulus','Di Keluarkan'";
export function createCandidates(db=pool){
 return async function candidates({access,action='list',id,params=new URLSearchParams(),csrf='',data}){
  if(!access.permissions.includes(['list','bulkExport'].includes(action)?'view_any_calon::santri':action==='delete'?'delete_calon::santri':'update_calon::santri'))return message(403,'Anda tidak memiliki izin untuk tindakan ini.');
  if(action!=='list' && !['bulkStatus','bulkExport'].includes(action) && (!['status','note','delete'].includes(action)||!/^\d{1,15}$/.test(String(id))))return message(404,'Halaman tidak ditemukan.');
  const c=await db.getConnection();
  try {
   if(action==='bulkExport'){
    const ids=selectedTableIds(data);if(!ids)return message(422,'Pilih 1–100 calon santri yang valid.');
    const [rows]=await c.execute(`SELECT s.nama,s.nomor_pendaftaran,s.status,s.nisn,s.nik,s.asal_sekolah,s.jenis_kelamin,s.nomor_hp,p.kode_gelombang,s.catatan,s.created_at FROM santris s LEFT JOIN penerimaan_santris p ON p.id=s.penerimaan_santri_id WHERE s.id IN (${ids.map(()=>'?').join(',')}) AND s.status NOT IN (${excluded}) ORDER BY s.id DESC`,ids);
    const columns=[['nama','Nama'],['nomor_pendaftaran','No Pendaftaran'],['status','Status'],['nisn','NISN'],['nik','NIK'],['asal_sekolah','Asal Sekolah'],['jenis_kelamin','Jenis Kelamin'],['nomor_hp','No HP'],['kode_gelombang','Gelombang'],['catatan','Catatan'],['created_at','Tanggal Daftar']].map(([key,label])=>({key,label}));
    return {status:200,xlsx:await tableExcel(rows,columns)};
   }
   const [statuses]=await c.execute('SELECT DISTINCT status FROM status_catatan ORDER BY status');
   if(action==='bulkStatus'){
    const {status,...selection}=data||{};const ids=selectedTableIds(selection);
    if(!ids)return message(422,'Pilih 1–100 calon santri yang valid.');
    if(status===undefined)return {status:200,title:'Ubah Status Massal',body:`<section><p>Ubah status ${ids.length} calon santri terpilih.</p><form method="post" action="${base}/bulk-status"><input type="hidden" name="_csrf" value="${esc(csrf)}">${ids.map(i=>`<input type="hidden" name="id_${esc(i)}" value="1">`).join('')}<label class="field">Status <select name="status" required>${statuses.map(s=>`<option value="${esc(s.status)}">${esc(s.status)}</option>`).join('')}</select></label><button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>`};
    if(!statuses.some(row=>row.status===status))return message(422,'Status tidak valid.');
    await c.execute(`UPDATE santris SET status=?,updated_at=NOW() WHERE id IN (${ids.map(()=>'?').join(',')}) AND status NOT IN (${excluded})`,[status,...ids]);
    return {status:303};
   }
   if(['status','note','delete'].includes(action)){
    const [rows]=await c.execute(`SELECT id,nama,status,catatan FROM santris WHERE id=? AND status NOT IN (${excluded})`,[id]);
    if(!rows.length)return message(404,'Calon santri tidak ditemukan.');
    if(action==='delete'){if(data){const [result]=await c.execute(`DELETE FROM santris WHERE id=? AND status NOT IN (${excluded})`,[id]);return result.affectedRows?{status:303}:message(404,'Calon santri tidak ditemukan.');}return {status:200,title:'Hapus Calon Santri',body:`<section><p>Hapus ${esc(rows[0].nama)}?</p><form method="post" action="${base}/${esc(id)}/delete"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button type="submit">Ya, hapus</button> <a href="${base}">Batal</a></form></section>`};}
    if(action==='note'){if(data){if(typeof data.catatan!=='string'||Array.from(data.catatan).length>255)return message(422,'Catatan maksimal 255 karakter.');const [result]=await c.execute(`UPDATE santris SET catatan=?,updated_at=NOW() WHERE id=? AND status NOT IN (${excluded})`,[data.catatan,id]);return result.affectedRows?{status:303}:message(404,'Calon santri tidak ditemukan.');}return {status:200,title:'Ubah Catatan',body:`<section><form method="post" action="${base}/${esc(id)}/note"><input type="hidden" name="_csrf" value="${esc(csrf)}"><p>${esc(rows[0].nama)}</p><label class="field">Catatan <textarea name="catatan" maxlength="255">${esc(rows[0].catatan||'')}</textarea></label><button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>`};}
    if(data){
     if(!statuses.some(row=>row.status===data.status))return message(422,'Status tidak valid.');
     const [result]=await c.execute(`UPDATE santris SET status=?,updated_at=NOW() WHERE id=? AND status NOT IN (${excluded})`,[data.status,id]);
     return result.affectedRows?{status:303}:message(404,'Calon santri tidak ditemukan.');
    }
    const row=rows[0];return {status:200,title:'Ubah Status',body:`<section><form method="post" action="${base}/${esc(id)}/status"><input type="hidden" name="_csrf" value="${esc(csrf)}"><p>${esc(row.nama)}</p><label class="field">Status <select name="status" required>${statuses.map(s=>`<option value="${esc(s.status)}" ${s.status===row.status?'selected':''}>${esc(s.status)}</option>`).join('')}</select></label><button type="submit">Simpan</button> <a href="${base}">Batal</a></form></section>`};
   }
   const query=tableQuery(params,{sorts:['nama','nomor_pendaftaran','created_at','nisn','nik','asal_sekolah','jenis_kelamin','nomor_hp','status','kode_gelombang','catatan'],defaultSort:'created_at'});if(query&&!params.has('direction'))query.direction='desc';if(!query)return message(422,'Pencarian, urutan, atau halaman tidak valid.');
   const [waves]=await c.execute('SELECT id,kode_gelombang FROM penerimaan_santris ORDER BY id DESC');
   const filters=[{name:'status',label:'Status',multiple:true,options:statuses.map(s=>({value:s.status,label:s.status}))},{name:'gelombang',label:'Gelombang',multiple:true,options:waves.map(w=>({value:String(w.id),label:w.kode_gelombang}))},{name:'jenis_kelamin',label:'Jenis Kelamin',options:['Laki-laki','Perempuan'].map(v=>({value:v,label:v}))},{name:'from',label:'Dari tanggal',type:'date'},{name:'until',label:'Sampai tanggal',type:'date'}];
   const values=tableFilters(params,filters);if(!values)return message(422,'Filter tidak valid.');
   const validDate=v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v);if(!validDate(values.from)||!validDate(values.until)||(values.from&&values.until&&values.from>values.until))return message(422,'Rentang tanggal tidak valid.');
   const multi=(column,items)=>items.length?` AND ${column} IN (${items.map(()=>'?').join(',')})`:'';
   const sort={nama:'s.nama',nomor_pendaftaran:'s.nomor_pendaftaran',created_at:'s.created_at',nisn:'s.nisn',nik:'s.nik',asal_sekolah:'s.asal_sekolah',jenis_kelamin:'s.jenis_kelamin',nomor_hp:'s.nomor_hp',status:'s.status',kode_gelombang:'p.kode_gelombang',catatan:'s.catatan'}[query.sort];
   const [rows]=await c.execute(`SELECT COUNT(*) OVER() AS table_total,s.id,s.nama,s.nomor_pendaftaran,s.status,s.nisn,s.nik,s.asal_sekolah,s.jenis_kelamin,s.nomor_hp,s.catatan,s.created_at,s.jenjang,s.foto_akta_lahir,s.foto_kartu_keluarga,s.foto_pembayaran_psb_madrasah,s.foto_pembayaran_psb_darul_ilmi,s.foto_pembayaran_psb_mahad_aly,s.foto_pembayaran_psb_mahdon_tarbawi,s.foto_ijazah_sd,s.foto_ijazah_smp,s.foto_ijazah_sma,(SELECT f.path FROM foto_santris f WHERE f.santri_id=s.id ORDER BY f.id LIMIT 1) AS foto,p.kode_gelombang FROM santris s LEFT JOIN penerimaan_santris p ON p.id=s.penerimaan_santri_id WHERE s.status NOT IN (${excluded}) AND (s.nama LIKE ? ESCAPE '!' OR s.nomor_pendaftaran LIKE ? ESCAPE '!' OR s.nisn LIKE ? ESCAPE '!' OR s.nik LIKE ? ESCAPE '!' OR s.asal_sekolah LIKE ? ESCAPE '!' OR s.catatan LIKE ? ESCAPE '!' OR s.jenis_kelamin LIKE ? ESCAPE '!' OR s.nomor_hp LIKE ? ESCAPE '!' OR CAST(s.created_at AS CHAR) LIKE ? ESCAPE '!' OR s.status LIKE ? ESCAPE '!' OR p.kode_gelombang LIKE ? ESCAPE '!') ${multi('s.status',values.status)}${multi('s.penerimaan_santri_id',values.gelombang)} AND (?='' OR s.jenis_kelamin=?) AND (?='' OR DATE(s.created_at)>=?) AND (?='' OR DATE(s.created_at)<=?) ORDER BY ${sort} ${query.direction.toUpperCase()},s.id DESC LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,[...Array(11).fill(query.pattern),...values.status,...values.gelombang,values.jenis_kelamin,values.jenis_kelamin,values.from,values.from,values.until,values.until]);
   const columns=[{key:'nama',label:'Nama'},{key:'nomor_pendaftaran',label:'No Pendaftaran'},{key:'status',label:'Status'},{key:'nisn',label:'NISN'},{key:'nik',label:'NIK'},{key:'asal_sekolah',label:'Asal Sekolah'},{key:'jenis_kelamin',label:'Jenis Kelamin'},{key:'nomor_hp',label:'No HP',html:r=>{let n=String(r.nomor_hp||'').replace(/\D/g,'');if(n.startsWith('0'))n='62'+n.slice(1);else if(n.startsWith('8'))n='62'+n;return n?`<a href="https://wa.me/${n}?text=${encodeURIComponent('Bismillah, Apakah betul ini dengan abu/ummu dari ananda '+r.nama)}" target="_blank" rel="noopener noreferrer">${esc(r.nomor_hp)}</a>`:'—';}},{key:'kode_gelombang',label:'Gelombang'},{key:'catatan',label:'Catatan'},{key:'created_at',label:'Tanggal Daftar'}];
   const exported=await tableExport(params,rows,columns,'Calon Santri');if(exported)return exported;
   for(const label of ['Pass Foto','Akta Lahir','Kartu Keluarga','Bukti Pembayaran','Ijazah'])columns.push({label,html:r=>{const entry=candidateFiles(r).find(([,name])=>name===label);if(!entry||!r[entry[0]])return '—';const url=`${base}/${encodeURIComponent(r.id)}/berkas/${entry[0]}`;return `<a href="${url}" target="_blank" rel="noopener noreferrer"><img class="document-thumb" src="${url}" alt="${esc(label)}"></a>`;}});
   if(access.permissions.includes('update_calon::santri')||access.permissions.includes('delete_calon::santri'))columns.push({label:'Aksi',html:r=>tableRowActions([...(access.permissions.includes('update_calon::santri')?[{label:'Ubah Status',href:`${base}/${r.id}/status`},{label:'Ubah Catatan',href:`${base}/${r.id}/note`}]:[]),...(access.permissions.includes('delete_calon::santri')?[{label:'Hapus',href:`${base}/${r.id}/delete`}]:[])])});
   return {status:200,title:'Calon Santri',body:`<section>${renderTable({base,query,rows,columns,title:'calon santri',searchLabel:'Cari calon santri',emptyText:'Tidak ada calon santri yang cocok.',filters:filters.map(f=>({...f,value:values[f.name]})),sortOptions:[{value:'nama',label:'Nama'},{value:'nomor_pendaftaran',label:'No Pendaftaran'},{value:'created_at',label:'Tanggal Daftar'},{value:'nisn',label:'NISN'},{value:'nik',label:'NIK'},{value:'asal_sekolah',label:'Asal Sekolah'},{value:'jenis_kelamin',label:'Jenis Kelamin'},{value:'nomor_hp',label:'No HP'},{value:'status',label:'Status'},{value:'kode_gelombang',label:'Gelombang'},{value:'catatan',label:'Catatan'}],exportable:true,bulk:{action:`${base}/bulk-export`,csrf,rowLabel:r=>r.nama,actions:[{label:'Ekspor Excel terpilih',action:`${base}/bulk-export`},...(access.permissions.includes('update_calon::santri')?[{label:'Ubah status terpilih',action:`${base}/bulk-status`}]:[])],confirm:'Lanjutkan aksi untuk calon santri terpilih?'}})}</section>`};
  }finally{c.release();}
 };
}
export const candidates=createCandidates();
