import {monthCells,shiftMonth,months,weekdays,dateRange,eventColor} from '/calendar-model.js';
const page=document.querySelector('.academic-calendar');
if(page){
 const events=JSON.parse(page.dataset.events);let year=Number(page.dataset.year),month=Number(page.dataset.month);
 const calendar=page.querySelector('#calendar');const previous=page.querySelector('#prevMonth'),next=page.querySelector('#nextMonth');
 function render(){
  const title=document.createElement('h2');title.className='calendar-heading';title.id='calendar-title';title.textContent=`${months[month]} ${year}`;
  const nodes=[title];
  for(const name of weekdays){const cell=document.createElement('div');cell.className='day header-day';cell.textContent=name;nodes.push(cell);}
  for(const cell of monthCells(year,month,events)){
   const box=document.createElement('div');box.className='day'+(cell.active?'':' empty-day');
   const background=document.createElement('span');background.className='date-background';background.textContent=cell.day;box.append(background);
   const content=document.createElement('strong');
   if(cell.events.length){
    box.tabIndex=0;box.setAttribute('aria-label',dateRange(cell.date)+': '+cell.events.map(e=>e.kegiatan).join('; '));box.title=cell.events.map(e=>e.kegiatan).join('\n');
    const list=document.createElement('ul');for(const event of cell.events){const item=document.createElement('li');item.textContent=event.kegiatan;item.style.backgroundColor=eventColor(event.warna);list.append(item);}content.append(list);
   }
   box.append(content);nodes.push(box);
  }
  calendar.replaceChildren(...nodes);previous.disabled=year===2000&&month===0;next.disabled=year===2100&&month===11;
 }
 function move(delta){const target=shiftMonth(year,month,delta);if(target.year<2000||target.year>2100)return;year=target.year;month=target.month;render();const url=new URL(location.href);url.searchParams.set('tahun',year);url.searchParams.set('bulan',month+1);history.replaceState(null,'',url);}
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 page.querySelector('#searchInput').addEventListener('input',event=>{
  const needle=event.target.value.toLocaleLowerCase('id-ID').trim();let shown=0;
  for(const row of page.querySelectorAll('#kalenderTable tbody tr')){row.hidden=!row.textContent.toLocaleLowerCase('id-ID').includes(needle);if(!row.hidden)shown++;}
  page.querySelector('#calendar-empty').hidden=shown>0;
 });
 render();
}
