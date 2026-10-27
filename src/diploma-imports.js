import { diplomaDefinitions,prepareDiploma } from './diploma-resources.js';

export function diplomaHeaders(resource){const config=diplomaDefinitions[resource];return ['nama','nis',...config.grades,...(config.hours?['judul_karya_ilmiyah_latin','judul_karya_ilmiyah_arab']:[])];}
export async function importDiplomaRows({c,resource,records,message}) {
 const config=diplomaDefinitions[resource];await c.beginTransaction();
 try {
  const [events]=await c.execute('SELECT id,tahun FROM event_mahads ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE');
  if(!events.length){await c.rollback();return message(422,'Tambahkan event wisuda sebelum mengimpor nilai.');}
  for(const item of records){
   const [students]=await c.execute('SELECT id FROM santris WHERE nis=? ORDER BY id LIMIT 1 FOR UPDATE',[item.nis]);
   if(!students.length)continue; // Preserve the active legacy importer: unmatched NIS is skipped.
   const [existing]=await c.execute(`SELECT * FROM ${config.table} WHERE santri_id=? AND event_id=? ORDER BY id LIMIT 1 FOR UPDATE`,[students[0].id,events[0].id]);
   const row=existing[0] || {},values={...item};delete values.nis;delete values.nama;
   if(config.hours)for(const key of config.grades)values[key]=Math.max(70,Number(values[key]));
   values.santri_id=students[0].id;values.event_id=events[0].id;
   const errors=await prepareDiploma({c,resource,values,row,action:row.id?'edit':'create'});
   if(errors.length){await c.rollback();return message(422,errors.join(' '));}
   const keys=Object.keys(values);
   if(row.id)await c.execute(`UPDATE ${config.table} SET ${keys.map(key=>'`'+key+'`=?').join(',')},updated_at=NOW() WHERE id=?`,[...Object.values(values),row.id]);
   else await c.execute(`INSERT INTO ${config.table} (${keys.map(key=>'`'+key+'`').join(',')},created_at,updated_at) VALUES (${keys.map(()=>'?').join(',')},NOW(),NOW())`,Object.values(values));
  }
  await c.commit();return {status:303};
 }catch(error){await c.rollback();throw error;}
}
