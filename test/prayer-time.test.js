import {test} from 'node:test';
import assert from 'node:assert/strict';
import {followingDate,localDate,locationInfo,nextPrayer} from '../public/prayer-time.js';
const today={subuh:'04:10',dzuhur:'11:40',ashar:'14:52',maghrib:'17:49',isya:'19:00'};
const tomorrow={...today,subuh:'04:09'};
test('setelah Isya memakai Subuh esok hari, bukan jadwal hari ini',()=>{
 const next=nextPrayer(new Date('2026-10-27T20:00:00+07:00'),'2026-10-27',today,tomorrow,7);
 assert.equal(next.tomorrow,true);assert.equal(next.time,'04:09');assert.equal(next.timestamp,Date.parse('2026-10-28T04:09:00+07:00'));
 assert.equal(next.timestamp-Date.parse('2026-10-27T20:00:00+07:00'),8*3600000+9*60000);
});
test('jadwal berikutnya berganti tepat ketika waktu shalat tercapai',()=>{
 assert.equal(nextPrayer(new Date('2026-10-27T11:39:59+07:00'),'2026-10-27',today,tomorrow,7).key,'dzuhur');
 assert.equal(nextPrayer(new Date('2026-10-27T11:40:00+07:00'),'2026-10-27',today,tomorrow,7).key,'ashar');
 assert.equal(nextPrayer(new Date('2026-10-28T00:01:00+07:00'),'2026-10-28',tomorrow,null,7).key,'subuh');
});
test('timezone kota dan pergantian tanggal tidak bergantung timezone perangkat',()=>{
 const now=new Date('2026-10-27T16:30:00Z');
 assert.equal(localDate(now,locationInfo('Kab. Bogor').timeZone),'2026-10-27');
 assert.equal(localDate(now,locationInfo('Kota Makassar').timeZone),'2026-10-28');
 assert.equal(locationInfo('Kota Sorong').label,'WIT');
 assert.equal(followingDate('2026-12-31'),'2027-01-01');
 assert.equal(followingDate('2028-02-28'),'2028-02-29');
});
test('tidak mengarang Subuh besok ketika layanan belum memberi jadwal',()=>{
 assert.equal(nextPrayer(new Date('2026-10-27T20:00:00+07:00'),'2026-10-27',today,null,7),null);
});
