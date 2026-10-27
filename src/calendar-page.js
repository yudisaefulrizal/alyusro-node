import {query} from './db.js';
import {monthCells,months,weekdays,dateRange,eventColor} from '../public/calendar-model.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function calendarPage(search){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const get=type=>Number(parts.find(p=>p.type===type).value);
 const currentYear=get('year');const currentMonth=get('month')-1;
 const paramYear=Number(search.get('tahun'));const paramMonth=Number(search.get('bulan'));
 const year=Number.isInteger(paramYear)&&paramYear>=2000&&paramYear<=2100?paramYear:currentYear;
 const month=Number.isInteger(paramMonth)&&paramMonth>=1&&paramMonth<=12?paramMonth-1:currentMonth;
 const cutoff=`${currentYear-1}-${String(currentMonth+1).padStart(2,'0')}-${String(get('day')).padStart(2,'0')}`;
 const rows=await query('SELECT tanggal,tanggal_selesai,kegiatan,warna FROM kalender_akademiks WHERE COALESCE(tanggal_selesai,tanggal) >= ? ORDER BY tanggal,id',[cutoff]);
 const events=rows.map(e=>({tanggal:String(e.tanggal).slice(0,10),tanggal_selesai:e.tanggal_selesai?String(e.tanggal_selesai).slice(0,10):null,kegiatan:e.kegiatan||'',warna:eventColor(e.warna)}));
 const cells=monthCells(year,month,events);
 const grid=`<h2 class="calendar-heading" id="calendar-title">${months[month]} ${year}</h2>${weekdays.map(d=>`<div class="day header-day">${d}</div>`).join('')}${cells.map(c=>`<div class="day ${c.active?'':'empty-day'}" ${c.events.length?`tabindex="0" aria-label="${esc(dateRange(c.date))}: ${esc(c.events.map(e=>e.kegiatan).join('; '))}"`:''}><span class="date-background">${c.day}</span><strong>${c.events.length?`<ul>${c.events.map(e=>`<li style="background-color:${e.warna}">${esc(e.kegiatan)}</li>`).join('')}</ul>`:''}</strong></div>`).join('')}`;
 return {title:'Kalender Akademik',content:`<section class="kalender_kontainer academic-calendar" data-year="${year}" data-month="${month}" data-events="${esc(JSON.stringify(events))}">
  <div class="navigation"><button type="button" class="nav-button" id="prevMonth" aria-label="Bulan sebelumnya">‹ sebelumnya</button><button type="button" class="nav-button" id="nextMonth" aria-label="Bulan selanjutnya">selanjutnya ›</button></div>
  <div class="calendar" id="calendar" aria-labelledby="calendar-title">${grid}</div>
  <div class="flex-container"><label class="sr-only" for="searchInput">Cari tanggal atau kegiatan</label><input type="search" id="searchInput" class="search_kegiatan" placeholder="Cari kegiatan..." aria-controls="kalenderTable"></div>
  <div class="flex-container table-container"><table class="tabel_kalender" id="kalenderTable"><thead><tr><th scope="col">Tanggal</th><th scope="col">Kegiatan</th></tr></thead><tbody>${events.map(e=>`<tr><td>${esc(dateRange(e.tanggal,e.tanggal_selesai))}</td><td>${esc(e.kegiatan)}</td></tr>`).join('')}</tbody></table></div>
  <p id="calendar-empty" role="status" ${events.length?'hidden':''}>${events.length?'Tidak ada kegiatan yang sesuai pencarian.':'Belum ada kegiatan akademik.'}</p>
  <div class="flex-container"><a href="https://mahadalyusro.sch.id/dashboard/kalender-akademiks" class="edit-kalender">Edit Kalender</a></div>
  <noscript>Kalender bulan ini dan tabel kegiatan tetap tersedia. Aktifkan JavaScript untuk berpindah bulan dan mencari kegiatan.</noscript>
 </section><script type="module" src="/calendar-page.js"></script>`};
}
