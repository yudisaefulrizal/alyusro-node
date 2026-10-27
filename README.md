# Alyusro Node

Daftar kerja dashboard: [Checklist migrasi dashboard Node.js](../docs/checklist-migrasi-nodejs.md).

Prototipe migrasi halaman publik ke Node.js 22+, memakai database MySQL yang sama dengan Laravel dan aset tampilan asli.

```bash
cd alyusro-node
npm install
npm run dev
```

Buka http://127.0.0.1:8075. `npm start` untuk menjalankan tanpa watch. Default port 8075, host 127.0.0.1; dapat diatur lewat PORT/HOST.

## Database dan tampilan

Konfigurasi DB dibaca langsung dari `../.env` Laravel. Variabel DB_* proses dapat mengoverride konfigurasi. Kredensial tidak disalin ke source atau dikirim ke browser. Query konten publik dijalankan dalam transaksi READ ONLY. Modul autentikasi di bawah memiliki jalur tulis khusus untuk akun, role pendaftaran, dan sesi.

Tampilan memakai CSS, ikon, font, logo, struktur HTML, dan isi dari sumber Laravel. HTML rich text disanitasi. Aset dibaca dari salinan di proyek Node.js; konfigurasi database masih dibaca dari `.env` Laravel di direktori induk. Semua halaman memakai noindex selama pengujian.

## Perluasan halaman publik

Seluruh **19 menu publik aktif** dari tabel `menus` kini dilayani Node.js, termasuk kurikulum tahfizh, kurikulum bahasa Arab, ekstrakurikuler, enam jenjang pendidikan, prestasi, struktur organisasi interaktif, pendidik, kalender akademik, jadwal shalat, konversi nama, PSB, artikel, serta fasilitas. Halaman kurikulum bahasa Arab memang kosong pada sumber lama; ekstrakurikuler menampilkan informasi belum tersedia karena modul datanya sudah dihentikan.

Halaman/rute pendukung tambahan:

- `/biaya`: biaya dari seluruh program pendidikan.
- `/kalender/akademikh`: kalender Hijriah berbasis Intl, dengan catatan perbedaan penetapan resmi.
- `/jadwal/shalat/:lokasi`: pilihan lokasi dan jadwal dari MyQuran melalui server; zona waktu Asia/Jakarta.
- `/konversi/nama`: kamus nama database, tanpa menambah nama yang belum dikenal.
- `/psb` dan URL promosi panjang asli: isi halaman PSB/promosi dari Blade lama.
- `/struktur/organisasi`: gambar dan tombol struktur asli dari `public/struktur`.
- `/idulfitri`, `/iduladha`: nama pada template kartu ucapan asli, pratinjau dan unduh PNG dengan canvas.
- `/share-psb`: editor canvas asli beserta upload lokal, zoom, rotasi, dan unduh.
- `/konversi/{facebook,instagram,youtube,whatsapp,map,masuk-grup-info,mencoba-daftar}`: redirect ke tujuan sosial/kontak yang sama dengan Laravel; `mencoba-daftar` menuju `/dashboard/register` Node.js, tanpa tracking.
- `/sitemap.xml`: menu, artikel published, fasilitas, dan halaman tambahan. Atur PUBLIC_URL jika host berbeda.
- `/artikel/:slug/download`: unduhan PDF A4 asli yang dibuat server dengan Chrome dan font lokal tertanam.
- `/cekpsb`: ringkasan agregat jumlah pendaftar per jenjang/status dari database, tanpa identitas santri.
- `/link`, `/shorten`, `/r/:code`: tautan database lama bisa dibuka; tautan baru untuk percobaan disimpan di memori server dan hilang saat restart. Batas 50 per IP/hari selama proses berjalan.
- `/seo-check`: membuka analisis PageSpeed resmi; tidak menyalin API Laravel lama.
- `/app/hapus-bg`: unggah gambar maksimal 2 MB ke layanan eksternal yang sama seperti Laravel, lalu unduh PNG. Belum memindahkan pemilihan warna latar dan metadata wajah.
- `/generate/flayer-berduka`, `/generate/ijazah`: editor contoh nama dengan template lokal. Generator ijazah bukan penerbitan dokumen resmi.
- `/upload-gambar`: mengarahkan pengguna ke login dashboard untuk pengaitan foto dan data santri.

Batas cakupan: rute yang mengakses data pribadi, cetak ijazah/kartu/formulir santri, ZIP bukti pembayaran, ekspor santri, preview/download berkas bebas, template impor admin, dan CBT tetap merupakan modul sistem berakun. Rute tersebut tidak dibuka menjadi akses publik di Node.js. Formulir `/pendaftaran` masih simulasi; tombol pendaftaran utama menuju info `/psb`, lalu akun pendaftaran Node.js melalui `/konversi/mencoba-daftar`.

## Salinan aset dan unggahan

Semua aset dan unggahan lokal telah disalin ke proyek ini:

| Folder Node.js | Isi |
| --- | --- |
| `assets/legacy-public/` | Salinan aset bawaan public Laravel: CSS, JavaScript, font, logo, ikon, template, brosur, gambar struktur, dan aset lain. |
| `storage/uploads/` | Salinan seluruh unggahan dari storage/app/public Laravel, termasuk foto, dokumen, berkas, dan gambar konten. |
| `storage/private/` | Salinan seluruh berkas storage/app/private Laravel. Tidak disajikan lewat HTTP. |
| `storage/asset-copy-manifest.json` | Daftar ukuran, SHA-256, dan hasil verifikasi salinan. |

Salin ulang perubahan lokal dengan:

```bash
python3 scripts/copy-local-assets.py
```

Script memeriksa SHA-256 sumber dan tujuan, tidak menghapus berkas tujuan, tidak mengikuti symlink, dan tidak menyalin kode PHP/backend sebagai aset bawaan. Berkas asli Laravel tetap tersedia. Salinan upload, privat, dan aset besar dikecualikan dari Git; sertakan folder ini secara terpisah saat memindahkan proyek.

`node scripts/sync-public-assets.js` dapat melengkapi gambar konten dari website resmi langsung ke `storage/uploads/`. Membutuhkan curl dan jaringan. `templates/public-assets.json` mencatat path gambar konten publik yang boleh dilayani. CSS/font/logo/ikon dibaca langsung dari `assets/legacy-public`, bukan dari folder Laravel. URL `/storage/...` hanya membuka gambar konten yang disetujui dan aset branding; foto profil hanya disajikan lewat rute autentikasi pemilik akun. Foto dan dokumen santri lainnya tetap belum dibuka oleh dashboard Node.js.

Tes integrasi mencakup 19 menu, halaman tambahan, kategori/detail, versi cetak, agregat PSB, aset, konversi nama, shortener, dan respons jadwal shalat (layanan eksternal dimock dalam tes). Belum dilakukan verifikasi visual browser atau pengujian hasil canvas. Layanan MyQuran dan matha.site bergantung pada ketersediaan pihak ketiga.

## Perbaikan jadwal shalat

Halaman `/jadwal/shalat` dan `/jadwal/shalat/:lokasi` mengikuti susunan template Laravel: pilihan lokasi, tanggal Masehi/Hijriah, tabel lima waktu, hitung mundur, WhatsApp, dan tombol pengingat. CSS halaman diterapkan juga pada URL lokasi. Tidak memakai formulir umum/list paragraf prototipe sebelumnya.

Waktu mengikuti wilayah kota (WIB/WITA/WIT), tanpa menambahkan koreksi lagi ke waktu API. Setelah Isya, hitung mundur menggunakan jadwal Subuh dari tanggal esok hari. Pergantian tanggal memuat ulang jadwal. Bila layanan gagal, pesan dan tombol coba lagi tersedia. Notifikasi memerlukan persetujuan browser dan halaman tetap terbuka. Tanggal Hijriah menggunakan kalender perhitungan, bukan penetapan rukyat resmi.

Verifikasi khusus halaman ini: 21 tes otomatis lulus; Chrome desktop 1440 px dan HP 390 px berhasil memuat jadwal nyata Bogor/Sorong, tombol WhatsApp memuat waktu dan zona yang benar, pergantian lokasi berhasil, tidak ada overflow horizontal atau exception JavaScript. Tombol tetap dapat dijangkau setelah scroll pada HP. Tampilan halaman lain dan generator canvas belum diverifikasi dengan cara ini.

## Perbaikan kalender akademik

`/kalender-akademik` mengikuti tampilan bulanan Laravel: navigasi sebelumnya/selanjutnya, awal pekan Ahad, kotak tanggal kuning, header biru, warna kegiatan asli, pencarian, tabel dua kolom Tanggal/Kegiatan, dan tautan edit menuju dashboard Laravel. Data kegiatan mulai setahun terakhir termasuk kegiatan yang masih berlangsung lintas batas tersebut. Kalender awal mengikuti bulan di Asia/Jakarta; `?tahun=2026&bulan=12` dapat dipakai untuk membuka bulan tertentu. Navigasi memperbarui URL dan tetap menangani pergantian tahun. Rentang kegiatan mencakup tanggal mulai dan selesai tanpa pergeseran zona waktu.

CSS halaman dibatasi pada `.academic-calendar` sehingga tidak mengubah header global. Kalender dan tabel awal dirender server; navigasi serta pencarian menggunakan JavaScript lokal. Kalender Hijriah terpisah belum diubah dalam perbaikan ini.

Verifikasi: 25 tes otomatis lulus; Chrome desktop 1440 px dan HP 390 px memeriksa navigasi, rollover tahun, pencarian kosong/terisi/reset, warna kegiatan asli database, dan tidak ada overflow horizontal atau exception JavaScript. Tabel berisi 36 kegiatan pada database saat pengerjaan.

## Perbaikan daftar dan detail artikel

`/artikel` dan kategori mengikuti susunan Blade lama: empat thumbnail kecil, satu gambar besar pada desktop, daftar sepuluh artikel, metadata, cuplikan, tombol selengkapnya, dan pagination bernomor dengan Terbaru/Terlama. Grid sorotan disembunyikan pada HP seperti sumber. Filter kategori dipertahankan pada pagination, baik URL kategori maupun parameter KategoriArtikel.

Detail memakai stylesheet artikel khusus, judul penuh, thumbnail, informasi suka/views/tanggal, isi rich text, penulis dari relasi users, kategori atas/bawah, WhatsApp, Facebook, salin URL, dan versi cetak. Stylesheet salinan untuk halaman detail memperbaiki ekspresi Blade pada URL font; aset sumber tetap utuh. Format Arab, paragraf, daftar, link, dan format inline aman dipertahankan; script dan event handler konten dibuang. Artikel draft dan soft-deleted tidak dibuka.

Mode prototipe tetap baca-saja: views/like database tidak dinaikkan. Tombol suka menyimpan pilihan lokal di browser dan menjelaskan perilakunya setelah ditekan. Download sekarang memakai PDF asli dari server (lihat bagian PDF artikel). Clipboard membutuhkan localhost/HTTPS; jika akses clipboard gagal, alamat ditampilkan untuk disalin manual.

Verifikasi khusus artikel: 28 tes otomatis lulus. Chrome desktop 1440 px dan HP 390 px memeriksa gambar asli, kategori, perbedaan isi page 1/2, penulis, isi Arab, metadata, tautan WhatsApp, salin URL dengan clipboard mock, dan toggle suka lokal. Tidak ditemukan overflow horizontal atau exception JavaScript.


## PDF artikel

Tombol unduh pada detail artikel memanggil `/artikel/:slug/download` dan langsung mengirim `application/pdf` dengan nama file artikel. Isi mengikuti template PDF Laravel: judul, penulis, tanggal, thumbnail, isi, dan footer sumber. Halaman A4 memiliki margin 15 mm dan nomor halaman. Font DejaVu Sans Condensed dan XBRiyaz ditanam untuk Latin dan Arab; teks Arab dominan ditata RTL tanpa mengubah isi sumber. Berkas font disalin dari vendor mPDF Laravel ke assets/pdf-fonts, mengikuti font aktual pada PDF lama; ukuran paragraf Arab 14 px dengan line-height 2.

Membutuhkan Chrome terpasang dan `puppeteer-core` dari npm. Default binary `/usr/bin/google-chrome`; override dengan `PDF_CHROME_PATH` jika berbeda. PDF dibuat di memori, tidak disimpan permanen dan tidak menulis database. Maksimal dua render bersamaan; permintaan selebihnya menerima respons 503 untuk mencoba lagi. Browser ditutup setelah setiap render.

Renderer membaca gambar/font lokal dari salinan proyek, menonaktifkan JavaScript halaman dan memblokir permintaan jaringan. Hanya artikel published yang belum dihapus dapat diunduh. Berkas di luar direktori unggahan tidak dapat disisipkan sebagai gambar.

Verifikasi: 29 tes lulus, termasuk header attachment/PDF, signature `%PDF-`, HEAD, dan penolakan artikel tidak publik. PDF contoh artikel Mengenal Islam diperiksa dengan pdfinfo, pdffonts, pdftotext, dan render PNG dua halaman; teks Latin/Arab, gambar, footer, serta nomor halaman tampil dan font tertanam.


## Koreksi hasil perbandingan PDF Laravel

Perbandingan langsung PDF dari port 8000 dan 8075 menunjukkan font aktual Laravel adalah **XBRiyaz** untuk Arab dan **DejaVu Sans Condensed** untuk Latin. Alias Aljazeera ke Amiri-Bold.ttf pada template tidak mencerminkan font yang akhirnya dipilih mPDF. Node.js saat perbandingan masih memakai Amiri Bold/Poppins. Sampel Laravel 4 halaman, Node.js 2 halaman. Jadi kesamaan berkas font dalam CSS belum menghasilkan kesamaan PDF.

Pada halaman web, Chrome di mesin pengujian memakai Noto Sans Arabic Regular 14 px pada keduanya dan paragraf sumber Arab cocok. Laporan dan cuplikan ada di `storage/comparison/hasil-perbandingan.md`. Pemeriksaan ini tidak mengubah font produk atau data artikel; hasilnya menjadi dasar penyesuaian berikutnya.


## Penyamaan font PDF aktual

Setelah perbandingan langsung, font Node.js diperbarui ke **XBRiyaz** dan **DejaVu Sans Condensed**. Delapan varian regular, bold, italic, dan bold-italic disalin tanpa modifikasi dari `vendor/mpdf/mpdf/ttfonts` ke `assets/pdf-fonts/`; `sources.json` mencatat SHA-256 yang sudah diverifikasi. Font PDF ini disertakan dalam source proyek dan tidak bergantung pada vendor Laravel saat render.

PDF terbaru diperiksa dengan pdffonts dan render PNG: XBRiyaz dan DejaVu Sans Condensed benar-benar tertanam. Simbol yang tidak tersedia pada font utama dapat memakai fallback font. Mesin PDF tetap Chrome sehingga pemenggalan baris/halaman dapat berbeda dari mPDF. Semua 29 tes lulus setelah penggantian font.


## Autentikasi dashboard Node.js

Buka `/dashboard/login`, `/dashboard/register`, `/dashboard/password-reset/request`, dan `/dashboard/edit-profile`. Login memakai email atau nomor KK dengan password bcrypt Laravel yang sama, tanpa migrasi ulang password. Akun baru otomatis mendapat role `Wali santri` untuk guard `web`; role tersebut harus sudah ada. Setelah pendaftaran pengguna langsung login. Tidak ada verifikasi email, pembatasan domain email, OTP/2FA, atau login sosial.

Persiapan pada mesin baru:

```bash
npm install
npm run auth:setup
npm start
```

Setup hanya membuat `node_auth_sessions`, `node_auth_resets`, dan `node_auth_limits` bila belum tersedia. Tidak mengubah struktur tabel Laravel. Akun dan role tetap memakai tabel `users`, `roles`, `permissions`, serta relasi Spatie lama. Perubahan profil/password/nomor KK dan penghapusan akun berlaku pada akun bersama yang juga dipakai Laravel. Sesi dan token reset Node.js terpisah dari Laravel; keduanya tidak berbagi cookie atau mendukung single sign-on. Ganti/reset password dapat membatalkan sesi Laravel melalui pemeriksaan hash password Laravel.

Fitur aktif: login/ingat saya, daftar wali dan persetujuan formulir, lupa/reset password, logout, edit nama/email, foto profil, ubah password dengan password lama, daftar sesi Node.js dan logout perangkat lain, serta hapus akun dengan password dan teks `HAPUS`. Hak akses menggabungkan permission langsung dan melalui role guard `web`, tanpa bypass berdasarkan nama role. Widget pengubahan KK memerlukan `widget_NomorKkWidget`. Modul data santri dan pengaturan role admin belum dipindahkan; dashboard baru menyediakan ringkasan akun.

Password baru minimal 8 karakter dan maksimal 72 byte sesuai batas bcrypt. Nomor KK pendaftaran mengikuti validasi lama: wajib, unik, maksimal 16 karakter. Formulir pengubahan KK memerlukan angka maksimal 16 digit. Persetujuan wajib dicentang tetapi belum memiliki log persetujuan tersendiri, mengikuti sumber lama. Pengubahan nomor KK mengikuti perilaku lama; hubungan ke data santri tetap perlu diterapkan dan ditinjau saat modul wali dipindahkan.

Sesi menggunakan token acak 256 bit; hanya hash token yang disimpan. Cookie HttpOnly/SameSite=Lax, rotasi sesi setelah login dan penggantian password, serta CSRF pada seluruh POST. Default masa tidak aktif 30 hari; ingat saya memakai cookie 400 hari. Login dibatasi 10 percobaan/menit/IP, pendaftaran dan permintaan/reset password 2/menit/IP. Penghitung tersimpan dalam database sehingga restart tidak menghapusnya. IP berasal dari koneksi langsung, tidak mempercayai header proxy. Jika dipasang di balik proxy, pengguna berbagi IP proxy sampai konfigurasi trusted proxy ditambahkan.

Konfigurasi khusus Node.js melalui environment proses:

- `NODE_AUTH_PUBLIC_URL`: origin tetap untuk tautan email dan pemeriksaan Origin, misalnya `https://contoh.sch.id`; default email `http://127.0.0.1:8075`.
- `NODE_AUTH_SECURE_COOKIE=true`: aktifkan saat memakai HTTPS; cookie menggunakan awalan `__Host-`.
- `NODE_AUTH_SESSION_MINUTES`: masa tidak aktif sesi tanpa ingat saya; default `43200`.

Email membaca `MAIL_*` dari environment proses atau `.env` Laravel. Mendukung `MAIL_MAILER=smtp` dan `log`. Mode log menyimpan email di `storage/private/auth-mail/` dengan izin 0600, tanpa menyajikannya lewat HTTP. SMTP menggunakan konfigurasi host/port/encryption/username/password/from lama. Tautan reset berlaku 60 menit, sekali pakai, token disimpan sebagai hash SHA-256, dengan cooldown 60 detik per akun. Respons permintaan reset sama untuk email terdaftar/tidak terdaftar. Pengiriman SMTP nyata belum diuji dan tes tidak mengirim email.

Foto profil maksimal 1 MB, PNG/JPEG/WebP, divalidasi dan dikonversi ulang ke WebP maksimal 512 piksel; hanya pemilik akun terautentikasi dapat membuka `/dashboard/avatar`. Sesi dan halaman akun memakai `Cache-Control: no-store`. Logout perangkat lain hanya mengelola sesi Node.js. Hapus akun menghapus user, relasi role/permission, token reset dan sesi Node.js; data santri tidak ikut dihapus oleh implementasi ini.

Jalankan `npm run auth:prune` secara berkala, misalnya setiap hari, untuk membersihkan sesi/token/penghitung kedaluwarsa. Email mode log perlu dibersihkan sesuai kebutuhan lingkungan lokal.

Pengujian autentikasi memakai akun tiruan dan tabel MySQL TEMPORARY yang hanya berlaku pada koneksi tes. Tidak mendaftarkan, mengganti password, atau menghapus akun pengguna asli. Cakupan: bcrypt `$2y$`, email/KK, remember, rotasi/expiry sesi, CSRF/Origin, rate limit, pendaftaran, token reset sekali pakai/kedaluwarsa, perubahan profil/password, permission KK, logout perangkat, hapus akun, dan validasi/akses foto.

Verifikasi terakhir: 41 tes lulus (29 tes konten publik dan 12 tes autentikasi/SQL). Chrome desktop 1440 px dan HP 390 px memeriksa login, daftar, lupa password, toggle tampil/sembunyikan password, dan redirect profil tanpa login; tidak ditemukan overflow horizontal atau exception JavaScript. Screenshot lokal tersimpan di `storage/auth-preview/`. Jalankan ulang pemeriksaan browser dengan `node scripts/check-auth-ui.js`.

## Penyamaan tampilan login dan dashboard

Login mengikuti acuan Filament Laravel: kartu 512 px, logo 24 px, font Inter lokal, judul/subjudul asli, tautan lupa kata sandi pada label password, ikon tampil/sembunyikan password, checkbox ingat saya, dan tombol utama. Halaman daftar/reset menggunakan sistem tampilan yang sama. Tema mengikuti sistem dan pilihan terang/gelap/sistem pada menu akun disimpan di browser.

Kerangka dashboard mengikuti topbar 64 px, sidebar 320 px, judul Dasbor, kartu Nomor KK dengan Edit/Simpan/Batal, menu akun, serta sidebar drawer pada HP. `templates/dashboard-navigation.json` menyalin label/group/permission resource Laravel; hanya menu sesuai permission pengguna yang ditampilkan. Menu modul yang belum dipindahkan dinonaktifkan dengan tooltip, termasuk ujian dan pendaftaran santri; tidak menampilkan angka atau data santri tiruan sebagai data produksi. Konten data widget lainnya tetap menunggu migrasi fitur.

`node scripts/check-dashboard-ui.js` memeriksa desktop/HP dan terang/gelap menggunakan identitas tiruan: sidebar, Escape, menu akun, persistensi tema, edit/batal KK, serta overflow dan exception JS. Screenshot ada di `storage/auth-preview/dashboard-{light,dark}-{1440,390}.png`. Pengujian ini tidak membuat akun atau mengubah akun asli.

Ikon halaman public, login, dan dashboard Node.js menggunakan font khusus `alyusro-icon`/kelas `ysr-*`. `public/dashboard-icons.css` menyalin definisi ikon dari CSS lama dengan warna mengikuti teks agar terbaca pada tema terang/gelap. Ikon sidebar dipetakan berdasarkan fungsi menu. Kontrol yang tidak memiliki glyph pada font asli, seperti tampil/sembunyikan password dan pilihan tema, menggunakan label teks. Tidak memakai Heroicons pada versi Node.js.
