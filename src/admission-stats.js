import { query } from './db.js';
import { esc } from './dashboard-shell.js';
const statuses=['belum terverifikasi','sudah terverifikasi','diterima','Tidak lulus seleksi','sudah daftar ulang'];
export function createAdmissionStats(read=query) {
  return async function admissionStats(access,params=new URLSearchParams()) {
    if(!access.permissions.includes('widget_JumlahPsbSantriMadrasah'))return '';
    const title='<section class="widget full admission-widget"><h2>Penerimaan Santri Madrasah</h2>';
    const invalid=()=>title+'<p role="alert">Filter penerimaan tidak valid.</p><a href="/dashboard">Atur ulang filter</a></section>';
    for(const key of ['psb_year','psb_wave'])if(params.getAll(key).length>1)return invalid();
    if(params.has('psb_year')&&!/^(?:[0-9]{4})?$/.test(params.get('psb_year')))return invalid();
    if(params.has('psb_wave')&&!/^(?:[1-9][0-9]{0,14})?$/.test(params.get('psb_wave')))return invalid();
    const waves=await read("SELECT id, kode_gelombang FROM penerimaan_santris WHERE kode_gelombang LIKE 'MD%' ORDER BY id DESC");
    const yearOf=wave=>String(wave.kode_gelombang).split('-')[1]||'';
    const years=[...new Set(waves.map(yearOf).filter(year=>/^[0-9]{4}$/.test(year)))].sort().reverse();
    const initial=!params.has('psb_year')&&!params.has('psb_wave');
    const year=initial?(yearOf(waves[0]||{})||''):(params.get('psb_year')||'');
    const wave=initial?String(waves[0]?.id||''):(params.get('psb_wave')||'');
    if(year&&!years.includes(year))return invalid();
    const options=waves.filter(w=>!year||yearOf(w)===year);
    if(wave&&!options.some(w=>String(w.id)===wave))return invalid();
    // Always join MD admissions, including when both filters select all.
    const args=['madrasah',...statuses];
    let where="p.kode_gelombang LIKE 'MD%' AND s.jenjang = ? AND s.status IN (?,?,?,?,?)";
    if(year){where+=" AND SUBSTRING_INDEX(SUBSTRING_INDEX(p.kode_gelombang, '-', 2), '-', -1) = ?";args.push(year);}
    if(wave){where+=' AND p.id = ?';args.push(wave);}
    const rows=await read(`SELECT s.status, SUM(CASE WHEN s.jenis_kelamin = 'laki-laki' THEN 1 ELSE 0 END) AS ikhwan, SUM(CASE WHEN s.jenis_kelamin = 'perempuan' THEN 1 ELSE 0 END) AS akhwat, COUNT(*) AS total FROM santris s INNER JOIN penerimaan_santris p ON p.id = s.penerimaan_santri_id WHERE ${where} GROUP BY s.status`,args);
    const values=statuses.map(status=>rows.filter(r=>String(r.status).toLowerCase()===status.toLowerCase()).reduce((a,r)=>a.map((n,i)=>n+Number(r[['ikhwan','akhwat','total'][i]])),[0,0,0]));
    const cells=v=>v.map(n=>`<td>${n}</td>`).join('');
    return title+`<form method="get" action="/dashboard" class="psb-filters"><label class="field"><span class="field-label">Tahun</span><span class="input-wrap"><select name="psb_year"><option value="">Semua tahun</option>${years.map(y=>`<option value="${y}" ${year===y?'selected':''}>${y}</option>`).join('')}</select></span></label><label class="field"><span class="field-label">Gelombang</span><span class="input-wrap"><select name="psb_wave"><option value="">Semua gelombang</option>${options.map(w=>`<option value="${esc(w.id)}" ${wave===String(w.id)?'selected':''}>${esc(w.kode_gelombang)}</option>`).join('')}</select></span></label><button type="submit">Terapkan</button><a href="/dashboard">Terbaru</a></form><p class="filter-hint">Pilih semua gelombang saat mengganti tahun.</p><div class="student-table"><table><caption>Rekap status pendaftar Madrasah</caption><thead><tr><th scope="col">Status</th><th scope="col">Ikhwan</th><th scope="col">Akhwat</th><th scope="col">Total</th></tr></thead><tbody>${statuses.map((s,i)=>`<tr><th scope="row">${esc(s)}</th>${cells(values[i])}</tr>`).join('')}</tbody><tfoot><tr><th scope="row">Total</th>${cells(values.reduce((a,v)=>a.map((n,i)=>n+v[i]),[0,0,0]))}</tr></tfoot></table></div></section>`;
  };
}
export const admissionStats=createAdmissionStats();
