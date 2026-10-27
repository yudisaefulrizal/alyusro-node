export const locations = [
 ['Kota Bogor','Asia/Jakarta',7,'WIB'],['Kab. Bogor','Asia/Jakarta',7,'WIB'],
 ['Kota Tangerang','Asia/Jakarta',7,'WIB'],['Kab. Tangerang','Asia/Jakarta',7,'WIB'],
 ['Kota Jakarta','Asia/Jakarta',7,'WIB'],['Kota Sukabumi','Asia/Jakarta',7,'WIB'],
 ['Kab. Sukabumi','Asia/Jakarta',7,'WIB'],['Kota Bekasi','Asia/Jakarta',7,'WIB'],
 ['Kab. Bekasi','Asia/Jakarta',7,'WIB'],['Kota Bandung','Asia/Jakarta',7,'WIB'],
 ['Kota Sorong','Asia/Jayapura',9,'WIT'],['Kota Makassar','Asia/Makassar',8,'WITA'],
];
export const prayers = [['subuh','Subuh'],['dzuhur','Dzuhur'],['ashar','Ashar'],['maghrib','Maghrib'],['isya','Isya']];
export function locationInfo(name) {
 const row=locations.find(row=>row[0].toLowerCase()===name.toLowerCase());
 return row ? {name:row[0],timeZone:row[1],offset:row[2],label:row[3]} : null;
}
export function localDate(now,timeZone) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');
}
export function followingDate(date) { return new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10); }
export function nextPrayer(now,date,today,tomorrow,offset) {
 const at=(day,time)=>Date.parse(`${day}T${time}:00+${String(offset).padStart(2,'0')}:00`);
 for(const [key,name] of prayers) {
  if(!/^\d{2}:\d{2}$/.test(today?.[key]||''))continue;
  const timestamp=at(date,today[key]);
  if(timestamp>now.getTime())return {key,name,time:today[key],timestamp,tomorrow:false};
 }
 if(/^\d{2}:\d{2}$/.test(tomorrow?.subuh||''))return {key:'subuh',name:'Subuh',time:tomorrow.subuh,timestamp:at(followingDate(date),tomorrow.subuh),tomorrow:true};
 return null;
}
