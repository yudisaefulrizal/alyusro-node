import definitions from '../templates/diploma-fields.json' with {type:'json'};
export { definitions as diplomaDefinitions };
const titles={ijazah:'Ijazah Madrasah','ijazah-darul-ilmi':'Ijazah Darul Ilmi','ijazah-mahad-aly':"Ijazah Ma'had Aly"};
export const gradeLetter=value=>value>=90?'A':value>=80?'B':value>=70?'C':'D';
export const gradePredicate=value=>value>=90?'Mumtaz':value>=80?'Jayyid Jiddan':value>=70?'Jayyid':'Maqbul';
export function diplomaSummary(resource,row) {
 const config=definitions[resource],total=config.grades.reduce((sum,key)=>sum+Number(row[key] || 0),0),average=total/config.grades.length;
 if(!config.hours)return {average:Math.round((average+Number.EPSILON)*100)/100,predicate:gradePredicate(Number(average.toFixed(2))),total};
 const hours=Object.values(config.hours).reduce((sum,value)=>sum+value,0),weighted=config.grades.reduce((sum,key)=>sum+({A:4,B:3,C:2,D:1}[gradeLetter(Number(row[key] || 0))]*config.hours[key]),0),ipk=weighted/hours;
 return {average:Math.round((average+Number.EPSILON)*100)/100,total,ipk,hours,weighted,predicate:ipk>3.75?'Dengan Pujian':ipk>3?'Baik Sekali':ipk>2.5?'Baik':ipk>2?'Cukup':'Kurang'};
}
export async function prepareDiploma({c,resource,values,row,action}) {
 const config=definitions[resource];
 const [students]=await c.execute('SELECT id,nis,jenjang FROM santris WHERE id=? FOR UPDATE',[values.santri_id]);
 const [events]=await c.execute('SELECT id,tahun FROM event_mahads WHERE id=? FOR UPDATE',[values.event_id]);
 if(!students.length||!events.length)return ['Santri atau event tidak tersedia.'];
 if(resource==='ijazah-mahad-aly'&&String(students[0].jenjang).toLowerCase()!=="ma'had 'aly")return ["Pilih santri jenjang Ma'had 'Aly."];
 const [duplicates]=await c.execute(`SELECT id FROM ${config.table} WHERE santri_id=? AND event_id=? AND id<>? LIMIT 1`,[values.santri_id,values.event_id,row.id || 0]);
 if(duplicates.length)return ['Ijazah santri pada event tersebut sudah ada.'];
 if(action==='create') {
  const code=resource==='ijazah-mahad-aly'?({'madrasah':'MD',"darul 'ilmi":'DI',"ma'had 'aly":'MA'}[String(students[0].jenjang).toLowerCase()] || 'ERR'):config.code;
  const prefix=`MATHA-${code}-${events[0].tahun}-`;
  const [issued]=await c.execute(`SELECT nomor_ijazah FROM ${config.table} WHERE event_id=? FOR UPDATE`,[values.event_id]);
  let maximum=0;for(const item of issued){const suffix=String(item.nomor_ijazah || '').split('-').pop();if(/^\d+$/.test(suffix))maximum=Math.max(maximum,Number(suffix));}
  values.nomor_ijazah=prefix+(resource==='ijazah-mahad-aly'?String(students[0].nis || '')+'-':'')+String(maximum+1).padStart(3,'0');
  if(values.nomor_ijazah.length>255)return ['Nomor ijazah terlalu panjang.'];
 }
 const summary=diplomaSummary(resource,values);Object.assign(values,config.hours?{temp_ipk:summary.ipk,temp_predikat:summary.predicate}:{temp_rata_rata:summary.average,temp_predikat:summary.predicate});
 return [];
}
export const diplomaResources=Object.fromEntries(Object.entries(definitions).map(([resource,config])=>[resource,{
 title:titles[resource],table:config.table,permission:resource.replaceAll('-', '::'),fields:config.fields,view:true,singleDelete:true,importable:true,
 search:['nomor_ijazah','santri_id'],searchExpressions:['nomor_ijazah',`(SELECT nama FROM santris WHERE id=${config.table}.santri_id)`],sorts:['santri_id','event_id','nomor_ijazah','created_at'],sortSql:{santri_id:`(SELECT nama FROM santris WHERE id=${config.table}.santri_id)`},filterFields:['event_id','verifikasi_kepala_sekolah','verifikasi_mudir'],
 listFields:['santri_id','event_id','verifikasi_kepala_sekolah','verifikasi_mudir'],extraColumns:['nomor_ijazah',...(config.hours?['temp_ipk']:['temp_rata_rata']),'temp_predikat'],prepareValues:prepareDiploma,
 extraActions:row=>[{label:'Cetak Ijazah',href:`/dashboard/${resource}/${row.id}/print`},{label:'Cetak Transkrip',href:`/dashboard/${resource}/${row.id}/transcript`},{label:'Unduh QR',href:`/dashboard/${resource}/${row.id}/qr`}],
 extraBulk:()=>[{label:'Ekspor terpilih',action:`/dashboard/${resource}/bulk-export`}],
 listIntro:({access})=>access.permissions.includes('update_'+resource.replaceAll('-','::'))?`<p><a href="/dashboard/${resource}/recalculate">Perbarui seluruh ${config.hours?'IPK':'rata-rata dan predikat'}</a></p>`:''

}]));
