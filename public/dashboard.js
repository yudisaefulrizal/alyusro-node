for(const input of document.querySelectorAll('input[type=password]')){
 const toggle=document.createElement('button');toggle.type='button';toggle.className='password-toggle';toggle.textContent='Lihat';toggle.setAttribute('aria-label','Tampilkan kata sandi');toggle.setAttribute('aria-pressed','false');
 toggle.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';toggle.textContent=show?'Sembunyikan':'Lihat';toggle.setAttribute('aria-label',show?'Sembunyikan kata sandi':'Tampilkan kata sandi');toggle.setAttribute('aria-pressed',String(show));});input.after(toggle);
}
const media=matchMedia('(prefers-color-scheme: dark)');let theme='system';try{theme=localStorage.getItem('theme')||'system';}catch{}
function applyTheme(value){theme=['light','dark','system'].includes(value)?value:'system';document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;for(const button of document.querySelectorAll('[data-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.themeChoice===theme));}
applyTheme(theme);media.addEventListener('change',()=>applyTheme(theme));
for(const button of document.querySelectorAll('[data-theme-choice]'))button.addEventListener('click',()=>{applyTheme(button.dataset.themeChoice);try{localStorage.setItem('theme',theme);}catch{}});
const sidebarButton=document.querySelector('.sidebar-toggle'),overlay=document.querySelector('.sidebar-overlay');
function setSidebar(open){document.body.classList.toggle('sidebar-open',open);sidebarButton?.setAttribute('aria-expanded',String(open));if(overlay)overlay.hidden=!open;}
sidebarButton?.addEventListener('click',()=>setSidebar(!document.body.classList.contains('sidebar-open')));overlay?.addEventListener('click',()=>{setSidebar(false);sidebarButton?.focus();});
const account=document.querySelector('.account-menu');document.addEventListener('click',event=>{if(account&&!account.contains(event.target))account.open=false;});document.addEventListener('keydown',event=>{if(event.key==='Escape'){setSidebar(false);if(account?.open){account.open=false;account.querySelector('summary').focus();}}});
for(const widget of document.querySelectorAll('.kk-widget')){const summary=widget.querySelector('.kk-summary'),editor=widget.querySelector('.kk-editor');function edit(value){summary.hidden=value;editor.hidden=!value;(value?editor.querySelector('input[name=nomor_kk]'):summary.querySelector('button')).focus();}widget.querySelector('[data-kk-edit]')?.addEventListener('click',()=>edit(true));widget.querySelector('[data-kk-cancel]')?.addEventListener('click',()=>edit(false));}

const uploadDialog=document.querySelector('.wali-upload-dialog');
if(uploadDialog){
 const form=uploadDialog.querySelector('form'),input=uploadDialog.querySelector('input[type=file]'),preview=uploadDialog.querySelector('.wali-upload-preview');
 let previewUrl;
 function resetPreview(){if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=undefined;preview.hidden=true;preview.removeAttribute('src');}
 document.querySelectorAll('[data-wali-upload]').forEach(button=>button.addEventListener('click',()=>{form.reset();resetPreview();form.action=button.dataset.waliUpload;uploadDialog.querySelector('h2').textContent='Upload '+button.dataset.waliLabel;uploadDialog.showModal();}));
 uploadDialog.querySelector('[data-wali-cancel]').addEventListener('click',()=>uploadDialog.close());
 uploadDialog.addEventListener('close',resetPreview);
 input.addEventListener('change',()=>{resetPreview();if(input.files[0]){previewUrl=URL.createObjectURL(input.files[0]);preview.src=previewUrl;preview.hidden=false;}});
}
for(const button of document.querySelectorAll('[data-wali-zoom]'))button.addEventListener('click',()=>button.querySelector('img').classList.toggle('zoomed'));
for(const form of document.querySelectorAll('[data-wali-delete]'))form.addEventListener('submit',event=>{if(!confirm('Yakin ingin menghapus foto ini?'))event.preventDefault();});
for(const form of document.querySelectorAll('[data-admission-delete]'))form.addEventListener('submit',event=>{const boxes=form.querySelectorAll('input[type=checkbox]');if((boxes.length&&!form.querySelector('input[type=checkbox]:checked'))||!confirm('Hapus gelombang penerimaan yang dipilih?'))event.preventDefault();});
for(const form of document.querySelectorAll('[data-table-bulk]')){
 const all=form.querySelector('[data-table-select-all]'),rows=[...form.querySelectorAll('[data-table-select-row]')];
 const sync=()=>{all.checked=rows.length>0&&rows.every(row=>row.checked);all.indeterminate=rows.some(row=>row.checked)&&!all.checked;};
 all.addEventListener('change',()=>{for(const row of rows)row.checked=all.checked;sync();});
 for(const row of rows)row.addEventListener('change',sync);
 form.addEventListener('submit',event=>{if(!rows.some(row=>row.checked)||!confirm(form.dataset.confirm))event.preventDefault();});
}
for(const table of document.querySelectorAll('[data-table]')){
 const key='table-columns:'+table.dataset.tableKey;
 let hidden=[];try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))hidden=saved;}catch{}
 for(const toggle of table.querySelectorAll('[data-table-column]')){
  const index=toggle.dataset.tableColumn;
  const apply=()=>{for(const cell of table.querySelectorAll('[data-column]'))if(cell.dataset.column===index)cell.hidden=!toggle.checked;};
  toggle.checked=!hidden.includes(index);apply();
  toggle.addEventListener('change',()=>{apply();try{localStorage.setItem(key,JSON.stringify([...table.querySelectorAll('[data-table-column]')].filter(item=>!item.checked).map(item=>item.dataset.tableColumn)));}catch{}});
 }
}
for(const select of document.querySelectorAll('[data-table-page-size]'))select.addEventListener('change',()=>{location.href=select.value;});

// Rich-text fields keep their textarea as a no-JavaScript fallback.
for (const source of document.querySelectorAll('[data-rich-editor]')) {
 const wrapper = document.createElement('div'); wrapper.className = 'master-rich';
 const toolbar = document.createElement('div'); toolbar.className = 'master-rich-toolbar'; toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Format teks');
 const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.className = 'master-rich-content'; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true'); editor.setAttribute('aria-label', source.name.replaceAll('_', ' '));
 // Server sanitizes the stored HTML before returning this value.
 editor.innerHTML = source.value;
 for (const [command, label] of [['bold', 'Tebal'], ['italic', 'Miring'], ['underline', 'Garis bawah'], ['insertUnorderedList', 'Daftar'], ['insertOrderedList', 'Nomor'], ['undo', 'Urungkan'], ['redo', 'Ulangi']]) {
  const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
  button.addEventListener('click', () => { editor.focus(); document.execCommand(command); sync(); }); toolbar.append(button);
 }
 function sync() { source.value = editor.innerHTML; }
 editor.addEventListener('input', sync);
 editor.addEventListener('paste', event => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); sync(); });
 source.before(wrapper); wrapper.append(toolbar, editor); source.hidden = true; source.required = false;
 source.form.addEventListener('submit', sync);
}
