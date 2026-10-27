export const weekdays=['Ahad','Sen','Sel','Rab','Kam','Jum','Sab'];
export const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export function dateKey(year,month,day){return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
export function shiftMonth(year,month,delta){const d=new Date(Date.UTC(year,month+delta,1));return {year:d.getUTCFullYear(),month:d.getUTCMonth()};}
export function monthCells(year,month,events){
 const first=new Date(Date.UTC(year,month,1));const offset=first.getUTCDay();const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const length=Math.ceil((offset+count)/7)*7;
 return Array.from({length},(_,i)=>{const d=new Date(Date.UTC(year,month,i-offset+1));const key=d.toISOString().slice(0,10);const active=d.getUTCMonth()===month;return {date:key,day:d.getUTCDate(),active,events:active?events.filter(e=>e.tanggal<=key&&(e.tanggal_selesai||e.tanggal)>=key):[]};});
}
export function dateRange(start,end){
 const parts=s=>{const [y,m,d]=s.slice(0,10).split('-').map(Number);return {y,m,d};};
 const a=parts(start),b=end?parts(end):a;
 const full=p=>`${String(p.d).padStart(2,'0')} ${months[p.m-1]} ${p.y}`;
 if(!end||start.slice(0,10)===end.slice(0,10))return full(a);
 if(a.y===b.y&&a.m===b.m)return `${String(a.d).padStart(2,'0')} - ${full(b)}`;
 if(a.y===b.y)return `${String(a.d).padStart(2,'0')} ${months[a.m-1]} - ${full(b)}`;
 return `${full(a)} - ${full(b)}`;
}
export function eventColor(color){return /^#[a-f0-9]{3}(?:[a-f0-9]{3})?$/i.test(color||'')?color:'#007bff';}
