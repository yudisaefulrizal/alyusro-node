import { diplomas, diplomaRoute } from './diplomas.js';
import { cbtAdmin, cbtAdminRoute } from './cbt-admin.js';
import { cbtRuntime, cbtRuntimeRoute } from './cbt-runtime.js';
import { studentsAdmin, studentsAdminRoute } from './students-admin.js';
import { adminResources, adminRoute } from './admin-resources.js';
import { runAudit, auditActor } from './audit.js';
import { masterResources, dashboardMasters, masterRoute } from './dashboard-masters.js';
import { candidates } from './candidates.js';
import { admissionsAdmin } from './admissions-admin.js';
import { referralSources } from './referral-sources.js';
import { statusNotes } from './status-notes.js';
import { waliDocuments } from './wali-documents.js';
import { waliRegistration } from './wali-create.js';
import { waliEdit } from './wali-edit.js';
import { waliFiles } from './wali-files.js';
import { waliWidget } from './wali-widget.js';
import { admissionStats } from './admission-stats.js';
import { dashboardStats } from './dashboard-stats.js';
import bcrypt from 'bcryptjs';
import { waliStudents } from './wali-students.js';
import { randomBytes,createHash,timingSafeEqual } from 'node:crypto';
import { mkdir,writeFile,realpath,readFile } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
import Busboy from 'busboy';
import sharp from 'sharp';
import { authStore } from './auth-store.js';
import { authPage } from './auth-views.js';
import { sendResetMail } from './auth-mail.js';
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const token=()=>randomBytes(32).toString('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const emailValid=value=>typeof value==='string'&&value.length<=255&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const passwordValid=value=>typeof value==='string'&&Array.from(value).length>=8&&Buffer.byteLength(value)<=72;
export async function verifyPassword(value,encoded) {
  if(typeof value!=='string'||Buffer.byteLength(value)>72||typeof encoded!=='string'||!/^\$2[aby]\$/.test(encoded))return false;
  return bcrypt.compare(value,encoded.replace(/^\$2y\$/,'$2b$'));
}
const dummyHash=bcrypt.hashSync('nonexistent-account-dummy-password',12);
class FormError extends Error { constructor(message,status=422){super(message);this.status=status;} }
async function readForm(req, maxEncodedSize=16384, fileField='avatar', contentUpload=false, masterForm=false) {
  const max=contentUpload?11534336:Math.max(1100000,maxEncodedSize);let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>max)throw new FormError('Data terlalu besar.',413);chunks.push(chunk);}
  const buffer=Buffer.concat(chunks);
  if(req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
    if(size>maxEncodedSize)throw new FormError('Data terlalu besar.',413);
    const entries=[...new URLSearchParams(buffer.toString())];
    if(new Set(entries.map(([k])=>k)).size!==entries.length)throw new FormError('Formulir tidak valid.',400);
    return Object.fromEntries(entries);
  }
  if(req.headers['content-type']?.startsWith('multipart/form-data')) {
    return new Promise((resolve,reject)=>{
      let parser;try{parser=Busboy({headers:req.headers,limits:{files:1,fileSize:contentUpload?10485760:1048576,fields:masterForm?20:2,fieldSize:masterForm?1000000:256,parts:masterForm?21:3}});}catch{return reject(new FormError('Formulir tidak valid.',400));}
      const data={};let invalid=false;
      parser.on('field',(name,value,info)=>{if(name in data||info.valueTruncated)invalid=true;data[name]=value;});
      parser.on('file',(name,file,info)=>{const parts=[];if(contentUpload)data.upload_name=info.filename;if(name!==fileField)invalid=true;file.on('limit',()=>invalid=true);file.on('data',chunk=>parts.push(chunk));file.on('end',()=>{data[fileField]=Buffer.concat(parts);});});
      for(const event of ['filesLimit','fieldsLimit','partsLimit'])parser.on(event,()=>invalid=true);
      parser.on('error',()=>reject(new FormError('Formulir tidak valid.',400)));
      parser.on('close',()=>invalid?reject(new FormError('Berkas terlalu besar atau formulir tidak valid.')):resolve(data));parser.end(buffer);
    });
  }
  throw new FormError('Format formulir tidak didukung.',415);
}
export function createAuthHandler({store=authStore,students=waliStudents,editStudent=waliEdit,registerStudent=waliRegistration,wali=waliWidget,files=waliFiles,documents=waliDocuments,notes=statusNotes,referrals=referralSources,admissionsAdminHandler=admissionsAdmin,candidatesHandler=candidates,admin=adminResources,studentAdmin=studentsAdmin,cbt=cbtRuntime,cbtManagement=cbtAdmin,diploma=diplomas,masters=dashboardMasters,stats=dashboardStats,admissions=admissionStats,sendMail=sendResetMail,now=()=>Math.floor(Date.now()/1000),sessionMinutes=Number(process.env.NODE_AUTH_SESSION_MINUTES||43200),auditEnabled=store===authStore,secure=process.env.NODE_AUTH_SECURE_COOKIE==='true',uploadRoot=new URL('../storage/uploads/',import.meta.url)}={}) {
  const cookieName=secure?'__Host-alyusro_node_session':'alyusro_node_session';
  const duration=s=>s.user_id?(s.remember?400*86400:sessionMinutes*60):3600;
  return function handleAuth(req,res,path) { return runAudit({enabled:auditEnabled,ip:req.socket.remoteAddress,userAgent:String(req.headers['user-agent'] || '')},async()=>{
    if(path!=='/dashboard'&&!path.startsWith('/dashboard/'))return false;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
    const send=(status,body,type='text/html; charset=utf-8')=>{res.writeHead(status,{'Content-Type':type});res.end(req.method==='HEAD'?undefined:body);return true;};
    const redirect=to=>{res.writeHead(303,{Location:to});res.end();return true;};
    const ip=req.socket.remoteAddress||'';
    const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    let formData={};
    let s,user,access={roles:[],permissions:[]};
    const setCookie=raw=>res.setHeader('Set-Cookie',`${cookieName}=${raw}; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}${s.remember?`; Max-Age=${duration(s)}`:''}`);
    const fresh=async(account=null,remember=false)=>{
      const raw=token();const previous=s;
      s={id:hash(raw),csrf:token(),user_id:account?.id??null,password_hash:account?hash(account.password):null,remember:remember?1:0,last_activity:now(),ip_address:ip.slice(0,45),user_agent:String(req.headers['user-agent']||'').slice(0,512)};
      s.expires_at=now()+duration(s);await store.putSession(s);if(previous)await store.deleteSession(previous.id);setCookie(raw);
    };
    const page=async(view,message='',status=200,details={})=>send(status,authPage(view,s,user,access,message,status,details));
    const moduleResult=(result,filename)=>{if(result.json!==undefined)return send(result.status,JSON.stringify(result.json),'application/json');if(result.content!==undefined){res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.setHeader('Content-Disposition',`${result.attachment?'attachment':'inline'}; filename="${String(result.filename).replace(/[^a-zA-Z0-9._-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);return send(result.status,result.content,result.type);}if(result.xlsx!==undefined){res.setHeader('Content-Disposition',`attachment; filename="${filename}.xlsx"`);return send(200,result.xlsx,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');}if(result.zip!==undefined){res.setHeader('Content-Disposition',`attachment; filename="${filename}.zip"`);return send(200,result.zip,'application/zip');}return page(path,'',result.status,{module:result});};
    try {
      if(!['GET','HEAD','POST'].includes(req.method))return send(405,'Metode tidak tersedia.','text/plain');
      if(cookie&&/^[a-f0-9]{64}$/.test(cookie))s=await store.session(hash(cookie));
      if(s?.user_id){user=await store.user(s.user_id);if(!user||!equal(s.password_hash,hash(user.password))){await store.deleteSession(s.id);s=null;user=null;}}
      if(!s){
        if(!await store.rate(hash('session|'+ip),120))return send(429,'Terlalu banyak permintaan. Coba lagi sebentar.','text/plain');
        await fresh();
      }
      if(user){access=await store.access(user.id);auditActor(user.id);}
      const publicPaths=['/dashboard/login','/dashboard/register','/dashboard/password-reset/request','/dashboard/password-reset/reset'];
      if(!user&&!publicPaths.includes(path))return redirect('/dashboard/login');
      if(user&&publicPaths.includes(path))return redirect('/dashboard');
      if(req.method!=='POST'){
        await store.touch(s.id,now()+duration(s));
        if(path==='/dashboard/avatar'&&user){
          if(!user.avatar_url)return send(404,'Foto tidak ditemukan.','text/plain');
          const root=await realpath(uploadRoot);let file;
          try {file=await realpath(resolve(root,user.avatar_url));}catch{return send(404,'Foto tidak ditemukan.','text/plain');}
          if(!file.startsWith(root+sep)||!/^fotoProfil\//.test(user.avatar_url)||!['.png','.jpg','.jpeg','.webp'].includes(extname(file).toLowerCase()))return send(404,'Foto tidak ditemukan.','text/plain');
          const image=await sharp(await readFile(file),{limitInputPixels:16000000}).rotate().resize(512,512,{fit:'inside',withoutEnlargement:true}).webp().toBuffer();return send(200,image,'image/webp');
        }
        const diplomaPage=diplomaRoute(path);
        if(diplomaPage){const result=await diploma({...diplomaPage,user,access,csrf:s.csrf});return moduleResult(result,diplomaPage.resource);}
        const examPage=cbtRuntimeRoute(path),cbtPage=cbtAdminRoute(path);
        if(examPage){if(['start','save','submit'].includes(examPage.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await cbt({...examPage,user,csrf:s.csrf});return result.status===303?redirect(result.redirect):moduleResult(result,'ujian');}
        if(cbtPage){const result=await cbtManagement({...cbtPage,user,access,csrf:s.csrf});return moduleResult(result,'cbt');}
        const studentPage=studentsAdminRoute(path);
        if(studentPage){if(studentPage.action==='file'){if(studentPage.fileAction!=='read')return send(405,'Metode tidak tersedia.','text/plain');const result=await files({user,access,id:studentPage.id,field:studentPage.field,scope:'admin'});return result.status===200?send(200,result.content,'image/jpeg'):send(result.status,'Berkas tidak ditemukan.','text/plain');}const result=await studentAdmin({...studentPage,user,access,csrf:s.csrf});return moduleResult(result,'santri');}
        const adminPage=adminRoute(path);
        if(adminPage){const result=await admin({...adminPage,user,access,params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,adminPage.resource);}
        const masterPage=masterRoute(path);
        if(masterPage){const result=await masters({...masterPage,user,access,params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,masterPage.resource);}
        const candidateFile=path.match(/^\/dashboard\/calon-santri\/([1-9]\d{0,14})\/berkas\/([a-z_]+)$/);
        if(candidateFile){const result=await files({user,access,id:candidateFile[1],field:candidateFile[2],scope:'candidate'});return result.status===200?send(200,result.content,'image/jpeg'):send(result.status,'Berkas tidak ditemukan.','text/plain');}
        const candidatePage=path.match(/^\/dashboard\/calon-santri(?:\/([1-9]\d{0,14})\/(status|note|delete|zip|print))?$/);
        if(candidatePage){const result=await candidatesHandler({access,action:candidatePage[2]||'list',id:candidatePage[1],params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,'calon-santri');}
        const admissionPage=path.match(/^\/dashboard\/penerimaan-santri(?:\/(create)|\/([1-9]\d{0,14})\/(edit))?$/);
        if(admissionPage){const action=admissionPage[1]?'create':admissionPage[3]?'edit':'list';const result=await admissionsAdminHandler({access,action,id:admissionPage[2],params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,'penerimaan-santri');}
        const referralPage=path.match(/^\/dashboard\/sumber-informasi(?:\/(create)|\/([1-9]\d{0,14})\/(edit))?$/);
        if(referralPage){const action=referralPage[1]?'create':referralPage[3]?'edit':'list';const result=await referrals({access,action,id:referralPage[2],params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,'sumber-informasi');}
        const statusPage=path.match(/^\/dashboard\/status-catatan(?:\/(create)|\/([1-9]\d{0,14})\/(edit))?$/);
        if(statusPage){const action=statusPage[1]?'create':statusPage[3]?'edit':'list';const result=await notes({access,action,id:statusPage[2],params:new URL(req.url,'http://localhost').searchParams,csrf:s.csrf});return moduleResult(result,'status-catatan');}
        const documentFile=path.match(/^\/dashboard\/dokumen-wali\/([1-9]\d{0,14})\/([a-z_]+)$/);
        if(documentFile && documentFile[2]!=='edit'){const result=await files({user,access,id:documentFile[1],field:documentFile[2],scope:'documents'});return result.status===200?send(200,result.content,'image/jpeg'):send(result.status,'Berkas tidak ditemukan.','text/plain');}
        const documentPage=path.match(/^\/dashboard\/dokumen-wali(?:\/([1-9]\d{0,14})\/edit)?$/);
        if(documentPage){const result=await documents(user,access,new URL(req.url,'http://localhost').searchParams,documentPage[1],s.csrf);return moduleResult(result,'dokumen-santri');}
        const fileMatch=path.match(/^\/dashboard\/wali-berkas\/([1-9]\d{0,14})\/([a-z_]+)$/);
        if(fileMatch){const result=await files({user,access,id:fileMatch[1],field:fileMatch[2]});return result.status===200?send(200,result.content,'image/jpeg'):send(result.status,'Berkas tidak ditemukan.','text/plain');}
        if(path==='/dashboard/santri-wali/create'){const result=await registerStudent({user,access,csrf:s.csrf});return page(path,'',result.status,{module:result});}
        const editMatch=path.match(/^\/dashboard\/santri-wali\/([1-9]\d{0,14})\/edit$/);
        if(editMatch){const result=await editStudent({user,access,id:editMatch[1],csrf:s.csrf});return page(path,'',result.status,{module:result});}
        if(path==='/dashboard/santri-wali'||path.startsWith('/dashboard/santri-wali/')){
          const id=path==='/dashboard/santri-wali'?undefined:path.slice('/dashboard/santri-wali/'.length);
          const result=await students(user,access,new URL(req.url,'http://localhost').searchParams,id);
          return moduleResult(result,'data-santri');
        }
        if(path==='/dashboard')return page(path,'',200,{wali:await wali(user,access,s.csrf),stats:await stats(access),admissions:await admissions(access,new URL(req.url,'http://localhost').searchParams)});
        if(path==='/dashboard/edit-profile')return page(path,'',200,{sessions:await store.sessions(user.id)});
        if(path==='/dashboard/password-reset/reset'){const params=new URL(req.url,'http://localhost').searchParams;return page(path,'',200,{email:params.get('email'),token:params.get('token')});}
        return page(path,'',['/dashboard',...publicPaths].includes(path)?200:404);
      }
      const route=masterRoute(path), contentUpload=!!route && masterResources[route.resource].fields.some(f=>f.type==='file');
      const data=await readForm(req,cbtRuntimeRoute(path)?5242880:route||adminRoute(path)||cbtAdminRoute(path)||diplomaRoute(path)?1000000:16384,['import','convert'].includes(route?.action)?'workbook':contentUpload?'upload':'avatar',contentUpload,!!route);formData=data;
      if(!equal(data._csrf,s.csrf))throw new FormError('Sesi formulir kedaluwarsa. Muat ulang halaman dan coba lagi.',403);
      const origin=req.headers.origin;
      const allowedOrigin=process.env.NODE_AUTH_PUBLIC_URL ? new URL(process.env.NODE_AUTH_PUBLIC_URL).origin : `${secure?'https':'http'}://${req.headers.host}`;
      if(origin&&origin!==allowedOrigin)throw new FormError('Asal permintaan tidak sesuai.',403);
      const limited=async(key,max)=>{if(!await store.rate(hash(key+'|'+ip),max))throw new FormError('Terlalu banyak percobaan. Coba lagi dalam satu menit.',429);};
      const validateNew=()=>{if(!passwordValid(data.password))throw new FormError('Password minimal 8 karakter dan maksimal 72 byte.');if(data.password!==data.passwordConfirmation)throw new FormError('Konfirmasi password tidak cocok.');};
      const currentPassword=async()=>{await limited('password-check',10);if(!await verifyPassword(data.current_password,user.password))throw new FormError('Password saat ini salah.');};
      if(path==='/dashboard/login'){
        await limited('login',10);const login=String(data.login||'').trim();const account=login.length<=255?await store.login(login):null;
        const valid=await verifyPassword(data.password,account?.password||dummyHash);
        if(!account||!valid)throw new FormError('Password, email atau nomor KK salah.');
        await fresh(account,data.remember==='1');return redirect('/dashboard');
      }
      if(path==='/dashboard/register'){
        await limited('register',2);validateNew();
        if(!data.name?.trim()||data.name.length>255||!emailValid(data.email)||!data.nomor_kk?.trim()||data.nomor_kk.length>16||data.terms!=='1')throw new FormError('Isi nama wali, email, nomor KK maksimal 16 karakter, dan setujui pernyataan pendaftaran.');
        const id=await store.register({name:data.name.trim(),email:data.email.trim(),nomor_kk:data.nomor_kk.trim(),password:await bcrypt.hash(data.password,12)});
        await fresh(await store.user(id));return redirect('/dashboard');
      }
      if(path==='/dashboard/password-reset/request'){
        await limited('reset-request',2);if(!emailValid(data.email))throw new FormError('Format email tidak valid.');
        const account=await store.email(data.email.trim());
        if(account){const raw=token();if(await store.createReset(account,hash(raw)))await sendMail(account,raw);}
        return page(path,'Jika email terdaftar, tautan reset password akan dikirim. Periksa email Anda.');
      }
      if(path==='/dashboard/password-reset/reset'){
        await limited('reset',2);validateNew();
        if(!emailValid(data.email)||!/^\w{64}$/.test(data.token||''))throw new FormError('Tautan reset tidak valid atau sudah kedaluwarsa.');
        if(!await store.reset(data.email,hash(data.token),await bcrypt.hash(data.password,12),token()))throw new FormError('Tautan reset tidak valid atau sudah kedaluwarsa.');
        return redirect('/dashboard/login');
      }
      const diplomaAction=diplomaRoute(path);
      if(diplomaAction){if(['print','transcript','qr'].includes(diplomaAction.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await diploma({...diplomaAction,user,access,csrf:s.csrf,data});return result.status===303?redirect(result.redirect):moduleResult(result,diplomaAction.resource);}
      const examAction=cbtRuntimeRoute(path),cbtAction=cbtAdminRoute(path);
      if(examAction){if(!['start','save','submit'].includes(examAction.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await cbt({...examAction,user,csrf:s.csrf,data});return result.status===303?redirect(result.redirect):moduleResult(result,'ujian');}
      if(cbtAction){if(cbtAction.action==='results')return send(405,'Metode tidak tersedia.','text/plain');const result=await cbtManagement({...cbtAction,user,access,csrf:s.csrf,data});return result.status===303?redirect(result.redirect || '/dashboard/cbt-soal'):moduleResult(result,'cbt');}
      const studentAction=studentsAdminRoute(path);
      if(studentAction){if(studentAction.action==='file'){if(studentAction.fileAction==='read')return send(405,'Metode tidak tersedia.','text/plain');const result=await files({user,access,id:studentAction.id,field:studentAction.field,scope:'admin',action:studentAction.fileAction,image:data.avatar});return result.status===303?redirect(`/dashboard/santri/${studentAction.id}/documents`):send(result.status,'Berkas tidak dapat diproses.','text/plain');}if(['card','documents'].includes(studentAction.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await studentAdmin({...studentAction,user,access,csrf:s.csrf,data});return result.status===303?redirect('/dashboard/santri'):moduleResult(result,'santri');}
      const adminAction=adminRoute(path);
      if(adminAction){if(['list','view'].includes(adminAction.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await admin({...adminAction,user,access,csrf:s.csrf,data});return result.status===303?redirect(`/dashboard/${adminAction.resource}`):moduleResult(result,adminAction.resource);}
      const masterAction=masterRoute(path);
      if(masterAction){if(['list','view','template','conversion-template','file','download'].includes(masterAction.action))return send(405,'Metode tidak tersedia.','text/plain');const result=await masters({...masterAction,user,access,csrf:s.csrf,data});return result.status===303?redirect(`/dashboard/${masterAction.resource}`):moduleResult(result,masterAction.resource);}
      if(path==='/dashboard/santri-wali/create'){const result=await registerStudent({user,access,csrf:s.csrf,data});return result.status===303?redirect('/dashboard'):page(path,'',result.status,{module:result});}
      const editMatch=path.match(/^\/dashboard\/santri-wali\/([1-9]\d{0,14})\/edit$/);
      if(editMatch){const result=await editStudent({user,access,id:editMatch[1],csrf:s.csrf,data});return result.status===303?redirect('/dashboard'):page(path,'',result.status,{module:result});}
      if(path==='/dashboard/calon-santri/bulk-export'){const result=await candidatesHandler({access,action:'bulkExport',data});return moduleResult(result,'calon-santri-terpilih');}
      if(path==='/dashboard/calon-santri/bulk-zip'){const result=await candidatesHandler({access,action:'bulkZip',data});return moduleResult(result,'bukti-pembayaran');}
      if(path==='/dashboard/calon-santri/bulk-status'){const result=await candidatesHandler({access,action:'bulkStatus',csrf:s.csrf,data});return result.status===303?redirect('/dashboard/calon-santri'):page(path,'',result.status,{module:result});}
      const candidateAction=path.match(/^\/dashboard\/calon-santri\/([1-9]\d{0,14})\/(status|note|delete)$/);
      if(candidateAction){const result=await candidatesHandler({access,action:candidateAction[2],id:candidateAction[1],csrf:s.csrf,data});return result.status===303?redirect('/dashboard/calon-santri'):page(path,'',result.status,{module:result});}
      const admissionAction=path.match(/^\/dashboard\/penerimaan-santri\/(create|delete|([1-9]\d{0,14})\/(edit|delete))$/);
      if(admissionAction){const action=admissionAction[2]?admissionAction[3]:admissionAction[1]==='delete'?'bulkDelete':'create';const result=await admissionsAdminHandler({access,action,id:admissionAction[2],csrf:s.csrf,data});return result.status===303?redirect('/dashboard/penerimaan-santri'):page(path,'',result.status,{module:result});}
      const referralAction=path.match(/^\/dashboard\/sumber-informasi\/(create|delete|([1-9]\d{0,14})\/edit)$/);
      if(referralAction){const action=referralAction[2]?'edit':referralAction[1];const result=await referrals({access,action,id:referralAction[2],csrf:s.csrf,data});return result.status===303?redirect('/dashboard/sumber-informasi'):page(path,'',result.status,{module:result});}
      const statusAction=path.match(/^\/dashboard\/status-catatan\/(create|delete|([1-9]\d{0,14})\/edit)$/);
      if(statusAction){const action=statusAction[2]?'edit':statusAction[1];const result=await notes({access,action,id:statusAction[2],csrf:s.csrf,data});return result.status===303?redirect('/dashboard/status-catatan'):page(path,'',result.status,{module:result});}
      const documentAction=path.match(/^\/dashboard\/dokumen-wali\/([1-9]\d{0,14})\/([a-z_]+)\/(upload|delete)$/);
      if(documentAction){
        const result=await files({user,access,id:documentAction[1],field:documentAction[2],action:documentAction[3],image:data.avatar,scope:'documents'});
        if(result.status===303)return redirect(`/dashboard/dokumen-wali/${documentAction[1]}/edit`);
        const module=await documents(user,access,new URLSearchParams(),documentAction[1],s.csrf);
        const message=result.status===422?'Pilih gambar PNG, JPEG, atau WebP yang valid, maksimal 1 MB.':result.status===403?'Anda tidak memiliki izin mengubah berkas.':'Berkas tidak ditemukan.';
        return page(path,message,result.status,{module});
      }
      const fileAction=path.match(/^\/dashboard\/wali-berkas\/([1-9]\d{0,14})\/([a-z_]+)\/(upload|delete)$/);
      if(fileAction){
        const result=await files({user,access,id:fileAction[1],field:fileAction[2],action:fileAction[3],image:data.avatar});
        if(result.status===303)return redirect('/dashboard');
        throw new FormError(result.status===422?'Pilih gambar PNG, JPEG, atau WebP yang valid, maksimal 1 MB.':result.status===403?'Anda tidak memiliki izin mengubah berkas.':'Berkas tidak ditemukan.',result.status);
      }
      if(path==='/dashboard/logout'){
        await store.deleteSession(s.id);res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`);return redirect('/');
      }
      if(path==='/dashboard/profile'){
        if(!data.name?.trim()||data.name.length>255||!emailValid(data.email))throw new FormError('Nama dan email yang valid wajib diisi.');
        await store.profile(user.id,{name:data.name.trim(),email:data.email.trim()});return redirect('/dashboard/edit-profile');
      }
      if(path==='/dashboard/password'){
        await currentPassword();validateNew();await store.changePassword(user.id,await bcrypt.hash(data.password,12),token());
        await store.revokeOthers(user.id,s.id);await fresh(await store.user(user.id),!!s.remember);return redirect('/dashboard/edit-profile');
      }
      if(path==='/dashboard/nomor-kk'){
        if(!access.permissions.includes('widget_NomorKkWidget'))throw new FormError('Anda tidak memiliki akses.',403);
        if(!/^\d{1,16}$/.test(data.nomor_kk||''))throw new FormError('Nomor KK wajib berupa angka, maksimal 16 digit.');
        await store.kk(user.id,data.nomor_kk);return redirect('/dashboard');
      }
      if(path==='/dashboard/sessions/revoke'){await currentPassword();await store.revokeOthers(user.id,s.id);return redirect('/dashboard/edit-profile');}
      if(path==='/dashboard/account/delete'){
        await currentPassword();if(data.confirmation!=='HAPUS')throw new FormError('Ketik HAPUS untuk mengonfirmasi penghapusan akun.');
        await store.deleteUser(user.id);res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`);return redirect('/');
      }
      if(path==='/dashboard/avatar'){
        if(!Buffer.isBuffer(data.avatar)||!data.avatar.length)throw new FormError('Pilih foto profil.');
        let image;try{const source=sharp(data.avatar,{limitInputPixels:16000000});const meta=await source.metadata();if(!['png','jpeg','webp'].includes(meta.format))throw Error();image=await source.rotate().resize(512,512,{fit:'inside',withoutEnlargement:true}).webp().toBuffer();}catch{throw new FormError('Foto harus berupa PNG, JPEG, atau WebP yang valid.');}
        const dir=new URL('fotoProfil/',uploadRoot);await mkdir(dir,{recursive:true});const filename=token()+'.webp';await writeFile(new URL(filename,dir),image,{mode:0o600});await store.avatar(user.id,'fotoProfil/'+filename);return redirect('/dashboard/edit-profile');
      }
      return send(404,'Halaman tidak ditemukan.','text/plain');
    }catch(error){
      const destination=path.startsWith('/dashboard/wali-berkas/')?'/dashboard':path==='/dashboard/nomor-kk'?'/dashboard':path.startsWith('/dashboard/password-reset/')?path:user?'/dashboard/edit-profile':path;
      const message=error.code==='ER_DUP_ENTRY'?'Email atau nomor KK sudah digunakan.':error instanceof FormError?error.message:'Layanan autentikasi belum dapat diproses. Silakan coba lagi.';
      if(!(error instanceof FormError)&&error.code!=='ER_DUP_ENTRY')console.error('Auth:',error.code||error.name);
      if(!s)return send(503,'Layanan autentikasi belum siap.','text/plain');
      return page(destination,message,error instanceof FormError?error.status:error.code==='ER_DUP_ENTRY'?422:503,{email:formData.email,token:formData.token,...(destination==='/dashboard'&&user?{wali:await wali(user,access,s.csrf)}:{})});
    }
  });};
}
export const handleAuth=createAuthHandler();
