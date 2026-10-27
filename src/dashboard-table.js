import { esc } from './dashboard-shell.js';
import ExcelJS from 'exceljs';

/** Parse only known query values. SQL expressions are supplied by the caller, never by the request. */
export function tableQuery(params,{sorts=[],defaultSort='',pageSize=20}={}) {
 const search=(params.get('q')||'').trim(), pageText=params.get('page')||'1';
 const sort=params.get('sort')||defaultSort, direction=params.get('direction')||'asc';
 const size=params.get('per_page'); if(size!==null){if(!['10','20','50','100'].includes(size))return null;pageSize=Number(size);}
 if(search.length>100||!/^\d{1,6}$/.test(pageText)||Number(pageText)<1||
    (sorts.length&&(!sorts.includes(sort)||!['asc','desc'].includes(direction)))||
    !Number.isInteger(pageSize)||pageSize<1||pageSize>100)return null;
 const page=Number(pageText);
 return {search,page,sort,direction,pageSize,offset:(page-1)*pageSize,limit:pageSize+1,pattern:'%'+search.replace(/[!%_]/g,'!$&')+'%'};
}

/** Validate configured filters before using them in a module query. */
export function tableFilters(params, definitions) {
 const values={};
 for(const filter of definitions){const value=filter.multiple?params.getAll(filter.name).filter(Boolean):(params.get(filter.name)||'');const items=Array.isArray(value)?value:[value];if(items.length>100||items.some(v=>v.length>100||(v&&filter.options&&!filter.options.some(option=>option.value===v))))return null;values[filter.name]=value;}
 return values;
}

/** Produce a workbook using explicit, authorized columns. Strings stay strings, not formulas. */
export async function tableExcel(rows, columns) {
 const workbook=new ExcelJS.Workbook();
 const sheet=workbook.addWorksheet('Data');
 sheet.addRow(columns.map(column=>column.label));
 for(const row of rows)sheet.addRow(columns.map(column=>{const value=column.value?column.value(row):row[column.key];return value==null?'':typeof value==='number'&&Number.isFinite(value)?value:String(value);}));
 sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];
 sheet.columns.forEach((column,index)=>{column.width=Math.min(40,Math.max(14,String(columns[index].label).length+4));});
 return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** A module supplies already-authorized, filtered rows and export columns. */
export async function tableExport(params, rows, columns, title) {
 if(!params.has('export'))return null;
 if(params.get('export')!=='xlsx')return {status:422,title,body:'<section><p>Format ekspor tidak valid.</p></section>'};
 if(rows.length>10000)return {status:422,title,body:'<section><p>Hasil ekspor melebihi 10.000 baris. Persempit pencarian.</p></section>'};
 return {status:200,xlsx:await tableExcel(rows,columns)};
}

/** Shared, permission-filtered row actions. URLs must be supplied by the module. */
export function tableRowActions(actions) {
 if(!actions.length)return '';
 return `<details class="table-row-actions"><summary aria-label="Aksi">•••</summary><div>${actions.map(action=>`<a href="${esc(action.href)}">${esc(action.label)}</a>`).join('')}</div></details>`;
}

/** A text cell is escaped by default. `html` callbacks must return trusted markup and escape their values. */
export function renderTable({base,query,rows,columns,title,searchLabel,emptyText,sortOptions=[],bulk,caption,filters=[],exportable=false}) {
 const {search,page,sort,direction,pageSize}=query;
 const tableId="table-"+Buffer.from(base).toString("hex");
 const url=(n,extra={})=>{const p=new URLSearchParams({q:search,page:String(n),per_page:String(pageSize)});if(sortOptions.length){p.set('sort',sort);p.set('direction',direction);}for(const filter of filters)for(const value of (Array.isArray(filter.value)?filter.value:[filter.value]))if(value)p.append(filter.name,value);for(const [k,v] of Object.entries(extra))p.set(k,v);return base+'?'+p;};
 const pageRows=rows.slice(0,pageSize);
 const searchForm=`<form method="get" class="data-table-search"><label class="sr-only" for="${tableId}-search">${esc(searchLabel)}</label><input id="${tableId}-search" name="q" maxlength="100" placeholder="${esc(searchLabel)}" value="${esc(search)}">${sortOptions.length?`<input type="hidden" name="sort" value="${esc(sort)}"><input type="hidden" name="direction" value="${esc(direction)}">`:''}${filters.flatMap(f=>(Array.isArray(f.value)?f.value:[f.value]).map(v=>`<input type="hidden" name="${esc(f.name)}" value="${esc(v)}">`)).join('')}<input type="hidden" name="per_page" value="${pageSize}"><button type="submit">Cari</button></form>`;
 const filterMenu=filters.length?`<details class="data-table-menu"><summary>Filter${filters.some(f=>Array.isArray(f.value)?f.value.length:f.value)?' •':''}</summary><form method="get" class="data-table-menu-content data-table-filter"><input type="hidden" name="q" value="${esc(search)}"><input type="hidden" name="per_page" value="${pageSize}">${sortOptions.length?`<input type="hidden" name="sort" value="${esc(sort)}"><input type="hidden" name="direction" value="${esc(direction)}">`: ''}${filters.map(f=>`<label>${esc(f.label)}${f.options?`<select name="${esc(f.name)}" ${f.multiple?'multiple':''}>${f.multiple?'':'<option value="">Semua</option>'}${f.options.map(o=>`<option value="${esc(o.value)}" ${(Array.isArray(f.value)?f.value.includes(o.value):f.value===o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`:`<input type="${f.type==='date'?'date':'text'}" name="${esc(f.name)}" maxlength="100" value="${esc(f.value)}">`}</label>`).join('')}<button type="submit">Terapkan</button></form></details>`:'';
 const columnMenu=`<details class="data-table-menu"><summary>Kolom</summary><div class="data-table-menu-content">${columns.map((col,i)=>`<label><input type="checkbox" data-table-column="${i}" checked> ${esc(col.label)}</label>`).join('')}</div></details>`;
 const heading=columns.map((col,i)=>{const option=sortOptions.find(o=>o.value===(col.sort||col.key));return `<th scope="col" data-column="${i}"${option&&sort===option.value?` aria-sort="${direction==='asc'?'ascending':'descending'}"`:''}>${option?`<a href="${esc(url(1,{sort:option.value,direction:sort===option.value&&direction==='asc'?'desc':'asc'}))}">${esc(col.label)} <span aria-hidden="true">${sort===option.value?(direction==='asc'?'↑':'↓'):'↕'}</span></a>`:esc(col.label)}</th>`;}).join('');
 const table=`<div class="student-table" tabindex="0" role="region" aria-label="${esc(title)}"><table>${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${bulk?'<th scope="col"><input type="checkbox" data-table-select-all aria-label="Pilih semua baris di halaman ini"></th>':''}${heading}</tr></thead><tbody>${pageRows.map(row=>`<tr>${bulk?`<td><input type="checkbox" name="id_${esc(row.id)}" value="1" aria-label="Pilih ${esc(bulk.rowLabel(row))}" data-table-select-row></td>`:''}${columns.map((col,i)=>`<td data-column="${i}">${col.html?col.html(row):esc(col.value?col.value(row):row[col.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 const bulkAction=bulk&&pageRows.length?`<details class="data-table-menu"><summary>Aksi massal</summary><div class="data-table-menu-content">${(bulk.actions||[{label:bulk.label||'Hapus yang dipilih'}]).map(a=>`<button form="${tableId}-bulk" type="submit"${a.action?` formaction="${esc(a.action)}"`:``} class="data-table-delete">${esc(a.label)}</button>`).join('')}</div></details>`:'';
 const content=pageRows.length?table:`<p class="data-table-empty">${esc(emptyText)}</p>`;
 const toolbar=`<div class="data-table-toolbar">${searchForm}<div class="data-table-tools">${filterMenu}${columnMenu}${exportable?`<a class="data-table-export" href="${esc(url(1,{export:'xlsx'}))}">Ekspor Excel</a>`:''}${bulkAction}</div></div>`;
 const total=pageRows.length?Number(pageRows[0]?.table_total):(page===1?0:NaN); const hasTotal=Number.isSafeInteger(total)&&total>=0; const pages=hasTotal?Math.ceil(total/pageSize):0;
 const pageLinks=hasTotal&&pages>1?Array.from({length:Math.min(pages,5)},(_,i)=>Math.max(1,Math.min(page-2,pages-4))+i).map(n=>`<a href="${esc(url(n))}" ${n===page?'aria-current="page"':''}>${n}</a>`).join(''):'';
 const count=hasTotal?total?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} dari ${total} data`:'0 data':(pageRows.length?`Halaman ${page}`:emptyText);
 const footer=`<nav class="data-table-pagination" aria-label="Halaman ${esc(title)}"><span>${esc(count)}</span><div class="data-table-page-controls"><label>Baris per halaman <select data-table-page-size>${[10,20,50,100].map(n=>`<option value="${esc(url(1,{per_page:String(n)}))}" ${n===pageSize?'selected':''}>${n}</option>`).join('')}</select></label>${page>1?`<a href="${esc(url(page-1))}">Sebelumnya</a>`:''}${pageLinks}${rows.length>pageSize?`<a href="${esc(url(page+1))}">Selanjutnya</a>`:''}</div></nav>`;
 // The search form cannot be nested inside the bulk form.
 const body=bulk&&pageRows.length?`<form method="post" action="${esc(bulk.action)}" data-table-bulk data-confirm="${esc(bulk.confirm)}"><input type="hidden" name="_csrf" value="${esc(bulk.csrf)}">${content}${bulk.notice?`<p class="data-table-notice">${esc(bulk.notice)}</p>`:''}</form>`:content;
 return `<div class="data-table" data-table data-table-key="${esc(base)}">${toolbar}${body.replace('data-table-bulk',`id="${tableId}-bulk" data-table-bulk`)}${footer}</div>`;
}

export function selectedTableIds(data,{max=100}={}) {
 if(!data)return null;
 const entries=Object.entries(data).filter(([key])=>key!=='_csrf');
 if(!entries.length||entries.length>max||entries.some(([key,value])=>!/^id_[1-9]\d{0,14}$/.test(key)||value!=='1'))return null;
 return entries.map(([key])=>key.slice(3));
}
