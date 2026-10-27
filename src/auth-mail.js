import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setting } from './db.js';
export async function sendResetMail(user,token) {
  const origin=process.env.NODE_AUTH_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT||8075}`;
  const url=new URL('/dashboard/password-reset/reset',origin);
  url.searchParams.set('email',user.email);url.searchParams.set('token',token);
  const message={from:setting('MAIL_FROM_ADDRESS')||'noreply@mahadalyusro.sch.id',to:user.email,subject:'Permintaan Reset Password',text:`Bismillah, Abu/Ummu ${user.name.toUpperCase()}\n\nKami menerima permintaan untuk mengatur ulang password akun Anda di sistem Al Yusro.\n\nUbah password: ${url}\n\nTautan berlaku 60 menit. Abaikan email ini jika Anda tidak meminta perubahan password.\n\nIT Support Al Yusro`};
  if(setting('MAIL_MAILER')==='smtp') {
    const port=Number(setting('MAIL_PORT')||587);
    const transport=nodemailer.createTransport({host:setting('MAIL_HOST'),port,secure:port===465,requireTLS:setting('MAIL_ENCRYPTION')==='tls',auth:setting('MAIL_USERNAME')?{user:setting('MAIL_USERNAME'),pass:setting('MAIL_PASSWORD')}:undefined,connectionTimeout:10000,socketTimeout:15000});
    await transport.sendMail(message);
  } else if(!setting('MAIL_MAILER') || setting('MAIL_MAILER')==='log') {
    const root=new URL('../storage/private/auth-mail/',import.meta.url);
    await mkdir(root,{recursive:true,mode:0o700});
    await writeFile(new URL(`${randomUUID()}.json`,root),JSON.stringify(message,null,2),{mode:0o600});
  } else throw new Error('Transport email autentikasi belum didukung.');
}
