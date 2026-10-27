import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthCells,shiftMonth,dateRange,eventColor} from '../public/calendar-model.js';
test('kalender dimulai Ahad dan mengisi tanggal bulan tetangga',()=>{
 const cells=monthCells(2026,9,[]);assert.equal(cells.length%7,0);assert.equal(cells[0].date,'2026-09-27');assert.equal(cells[0].active,false);assert.equal(cells[4].date,'2026-10-01');assert.equal(cells.filter(c=>c.active).length,31);assert.equal(cells.at(-1).date,'2026-10-31');
});
test('kegiatan lintas bulan dan tahun muncul di semua tanggal inklusif',()=>{
 const events=[{tanggal:'2026-12-30',tanggal_selesai:'2027-01-02',kegiatan:'Libur',warna:'#ff0000'},{tanggal:'2027-01-01',tanggal_selesai:null,kegiatan:'Tahun baru'}];
 const cells=monthCells(2027,0,events);
 assert.equal(cells.find(c=>c.date==='2027-01-01').events.length,2);assert.equal(cells.find(c=>c.date==='2027-01-02').events.length,1);assert.equal(cells.find(c=>c.date==='2027-01-03').events.length,0);
 assert.deepEqual(shiftMonth(2026,11,1),{year:2027,month:0});assert.deepEqual(shiftMonth(2027,0,-1),{year:2026,month:11});
 assert.equal(monthCells(2028,1,[]).filter(c=>c.active).length,29);
});
test('rentang tanggal tabel sesuai format template Laravel',()=>{
 assert.equal(dateRange('2026-10-01',null),'01 Oktober 2026');
 assert.equal(dateRange('2026-10-01','2026-10-03'),'01 - 03 Oktober 2026');
 assert.equal(dateRange('2026-10-30','2026-11-03'),'30 Oktober - 03 November 2026');
 assert.equal(dateRange('2026-12-30','2027-01-03'),'30 Desember 2026 - 03 Januari 2027');
 assert.equal(eventColor('red; background:url(evil)'),'#007bff');assert.equal(eventColor('#abC123'),'#abC123');
});
