import { contentRoot, readContentFile } from './content-files.js';
import { handleAuth } from './auth.js';
import { handleArticlePdf } from './article-pdf.js';
import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { handlePublicApi } from './public-api.js';
import { query } from './db.js';
import { renderLegacy } from './legacy.js';
import { resolve, sep, extname } from 'node:path';
import { render, notFound } from './views.js';
import { validateRegistration } from './data.js';
const publicAssets = new Set(JSON.parse(await readFile(new URL('../templates/public-assets.json', import.meta.url), 'utf8').catch(() => '[]')));
const publicRoot = new URL('../public/', import.meta.url);
const assets = { '/dashboard-icons.css': ['dashboard-icons.css','text/css'], '/dashboard.js': ['dashboard.js','text/javascript'], '/dashboard.css': ['dashboard.css','text/css'], '/article-page.js': ['article-page.js','text/javascript'], '/calendar-model.js': ['calendar-model.js','text/javascript'], '/calendar-page.js': ['calendar-page.js','text/javascript'], '/prayer-time.js': ['prayer-time.js','text/javascript'], '/prayer-page.js': ['prayer-page.js','text/javascript'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/assets/default.jpg': ['assets/default.jpg', 'image/jpeg'], '/assets/logo.png': ['assets/logo.png', 'image/png'], '/legacy.css': ['legacy.css', 'text/css'], '/legacy.js': ['legacy.js', 'text/javascript'], '/public-pages.js': ['public-pages.js','text/javascript'] };
for (const weight of [400,500,600,700]) assets[`/dashboard-fonts/inter-${weight}.woff2`] = [`dashboard-fonts/inter-${weight}.woff2`, 'font/woff2'];
export const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` }); res.end(req.method === 'HEAD' ? undefined : body); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (await handleAuth(req,res,path)) return;
    if (await handleArticlePdf(req,res,path)) return;
    if (await handlePublicApi(req,res,send,path,new URL(req.url,'http://localhost').searchParams)) return;
    if (path === '/api/pendaftaran' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, 'application/json', JSON.stringify({ message: 'Gunakan format JSON.' }));
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 8192) return send(413, 'application/json', JSON.stringify({ message: 'Data terlalu besar.' })); }
      let data; try { data = JSON.parse(raw); } catch { return send(400, 'application/json', JSON.stringify({ message: 'Format data tidak valid.' })); }
      const errors = validateRegistration(data && typeof data === 'object' ? data : {});
      if (Object.keys(errors).length) return send(422, 'application/json', JSON.stringify({ errors }));
      return send(200, 'application/json', JSON.stringify({ message: 'Simulasi berhasil. Isian sudah valid. Data tidak disimpan dan belum menjadi pendaftaran resmi.' }));
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'text/plain', 'Metode tidak tersedia.');
    if (assets[path]) { const [file, type] = assets[path]; return send(200, type, await readFile(new URL(file, publicRoot))); }
    const shared = path.match(/^\/(css|fonts|logo|storage|struktur|template|Brosur|pages|js|logo_meta|pkbm|vendor)\/(.+)$/);
    if (shared && (shared[1] !== 'struktur' || /\.(?:jpeg|jpg|png|pdf)$/i.test(shared[2]))) {
      if (shared[1] === 'storage') {
        const assetPath = decodeURIComponent(shared[2]);
        const fixed = ['og/og_360p.webp', 'og/og.webp'];
        const branding = /^(?:fonts|logo|og)\/[^.][^\\]*\.(?:png|jpe?g|webp|svg|woff2?|ttf|otf|eot|ico)$/i.test(assetPath) && !assetPath.split('/').includes('..');
        if (!branding && !fixed.includes(assetPath) && !publicAssets.has(assetPath)) {
          const allowed = await query("SELECT gambar AS path FROM galeri_fasilitas WHERE gambar = ? UNION SELECT thumbnail AS path FROM artikels WHERE thumbnail = ? AND status = 'published' AND deleted_at IS NULL LIMIT 1", [assetPath, assetPath]);
          if (!allowed.length) return send(404, 'text/plain', 'Berkas tidak ditemukan.');
        }
      }
      if (shared[1] === 'storage') {
        const assetPath = decodeURIComponent(shared[2]);
        const directory = assetPath.split('/')[0];
        if (['thumbnail_artikel','galeri_fasilitas'].includes(directory)) {
          const file = await readContentFile({ directory }, assetPath, contentRoot);
          if (file && file.type.startsWith('image/')) return send(200, file.type, file.content);
        }
      }
      const root = new URL(shared[1] === 'storage' ? '../storage/uploads/' : shared[1] === 'pages' ? '../public/pages/' : '../assets/legacy-public/' + shared[1] + '/', import.meta.url);
      try {
        const rootPath = await realpath(root);
        const file = await realpath(resolve(rootPath, decodeURIComponent(shared[2])));
        if (!file.startsWith(rootPath + sep)) return send(404, 'text/plain', 'Berkas tidak ditemukan.');
        const types = { '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.svg':'image/svg+xml', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf', '.otf':'font/otf', '.ico':'image/x-icon', '.eot':'application/vnd.ms-fontobject', '.js':'text/javascript', '.pdf':'application/pdf' };
        const type = extname(file)==='.js' && !['pages','js','vendor'].includes(shared[1]) ? null : types[extname(file).toLowerCase()]; if (!type) return send(404, 'text/plain', 'Berkas tidak ditemukan.');
        return send(200, type, await readFile(file));
      } catch { return send(404, 'text/plain', 'Berkas tidak tersedia di penyimpanan lokal.'); }
    }
    const html = path === '/pendaftaran' ? render(path) : await renderLegacy(path, new URL(req.url, 'http://localhost').searchParams); send(html ? 200 : 404, 'text/html', html ?? notFound());
  } catch (error) { console.error(error.message); send(500, 'text/plain', 'Terjadi kesalahan pada server.'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8075);
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Alyusro Node: http://${process.env.HOST || '127.0.0.1'}:${port}`));
}
