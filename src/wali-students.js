import { tableQuery, renderTable, tableExport, tableFilters } from './dashboard-table.js';
import { query } from './db.js';
import { esc } from './dashboard-shell.js';

export function createWaliStudents(read=query) {
  return async function students(user,access,params,id) {
    const detail=id!==undefined;
    if(!access.permissions.includes(detail?'view_santri::wali':'view_any_santri::wali'))
      return {status:403,title:'Akses ditolak',body:'<p>Anda tidak memiliki izin melihat data ini.</p>'};
    if(detail&&!/^[1-9]\d{0,14}$/.test(id))return missing();
    const kk=String(user.nomor_kk??'').trim();
    if(!kk)return detail?missing():{status:200,title:'Data Santri',body:'<section><p>Lengkapi nomor KK akun untuk melihat data santri.</p></section>'};
    if(detail){
      const [row]=await read('SELECT id, nama, nama_arab, jenjang, status, nomor_pendaftaran, nisn, tempat_lahir, tanggal_lahir, bulan_lahir, tahun_lahir FROM santris WHERE no_kk = ? AND id = ? LIMIT 1',[kk,id]);
      if(!row)return missing();
      const labels={nama:'Nama',nama_arab:'Nama Arab',jenjang:'Jenjang',status:'Status',nomor_pendaftaran:'Nomor pendaftaran',nisn:'NISN',tempat_lahir:'Tempat lahir',tanggal_lahir:'Tanggal lahir',bulan_lahir:'Bulan lahir',tahun_lahir:'Tahun lahir'};
      return {status:200,title:'Detail Santri',body:`<section><a href="/dashboard/santri-wali">Kembali ke daftar</a><dl class="student-details">${Object.entries(labels).map(([key,label])=>`<div><dt>${label}</dt><dd>${esc(row[key]||'—')}</dd></div>`).join('')}</dl></section>`};
    }
    const sortOptions=[{value:'nama',label:'Nama'},{value:'nama_arab',label:'Nama Arab'},{value:'jenjang',label:'Jenjang'},{value:'status',label:'Status'}];
    const query=tableQuery(params,{sorts:sortOptions.map(option=>option.value),defaultSort:'nama'});
    if(!query)return {status:422,title:'Data Santri',body:'<p>Pencarian atau halaman tidak valid.</p>'};
    const filters=[{name:'jenjang',label:'Jenjang'},{name:'status',label:'Status'}];const values=tableFilters(params,filters);
    if(!values)return {status:422,title:'Data Santri',body:'<p>Filter tidak valid.</p>'};
    const where="no_kk = ? AND (nama LIKE ? ESCAPE '!' OR nama_arab LIKE ? ESCAPE '!' OR jenjang LIKE ? ESCAPE '!' OR status LIKE ? ESCAPE '!') AND (? = '' OR jenjang = ?) AND (? = '' OR status = ?)";
    const args=[kk,query.pattern,query.pattern,query.pattern,query.pattern,values.jenjang,values.jenjang,values.status,values.status];
    const rows=await read(`SELECT COUNT(*) OVER() AS table_total, id, nama, nama_arab, jenjang, status FROM santris WHERE ${where} ORDER BY ${query.sort} ${query.direction.toUpperCase()}, id ASC LIMIT ${params.has('export')?10001:query.limit} OFFSET ${params.has('export')?0:query.offset}`,args);
    const columns=[{key:'nama',label:'Nama'},{key:'nama_arab',label:'Nama Arab'},{key:'jenjang',label:'Jenjang'},{key:'status',label:'Status'}];
    const exported=await tableExport(params,rows,columns,'Data Santri');if(exported)return exported;
    if(access.permissions.includes('view_santri::wali'))columns[0]={key:'nama',label:'Nama',html:row=>`<a href="/dashboard/santri-wali/${esc(row.id)}">${esc(row.nama)}</a>`};
    const table=renderTable({base:'/dashboard/santri-wali',query,rows,columns,sortOptions,exportable:true,filters:filters.map(f=>({...f,value:values[f.name]})),title:'data santri',searchLabel:'Cari nama, jenjang atau status',emptyText:'Tidak ada santri yang cocok.'});
    return {status:200,title:'Data Santri',body:`<section>${table}</section>`};
  };
}
const missing=()=>({status:404,title:'Santri tidak ditemukan',body:'<p>Data santri tidak ditemukan.</p>'});
export const waliStudents=createWaliStudents();
