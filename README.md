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


## Migrasi Data Santri wali — tahap baca

Menu Data Santri pada grup Wali Santri kini membuka `/dashboard/santri-wali`. Daftar menampilkan nama, nama Arab, jenjang dan status, pencarian literal serta pagination 20 baris. Akses daftar memerlukan `view_any_santri::wali`; detail ringkas `/dashboard/santri-wali/:id` memerlukan `view_santri::wali`. Detail mencakup nomor pendaftaran, NISN dan data lahir. Semua query membatasi `no_kk` pada nomor KK akun saat permintaan berjalan. KK kosong tidak menjalankan query santri; record KK lain/tidak ditemukan mengembalikan 404. Respons memerlukan sesi login dan memakai no-store, termasuk HEAD.

Tahap ini belum mencakup tambah/edit, foto, berkas, cetak, atau widget jadwal penerimaan. Modul penuh tetap belum dicentang pada checklist. Pemeriksaan visual desktop/HP untuk halaman baru belum dilakukan. Perubahan modul Laravel yang sudah ada di workspace tidak diubah.

Verifikasi 27 Oktober 2026: 14 tes autentikasi/rute wali dan SQL wali lulus pada pemeriksaan terarah. Fixture HTTP memakai identitas tiruan; SQL memakai tabel TEMPORARY, tanpa mengubah santri asli. Mencakup penolakan permission, KK kosong/lintas KK, validasi parameter, escaping HTML, pencarian `%` literal, pagination, login redirect, HEAD dan no-store.

Regresi penuh setelah perubahan: `node --test` lulus **44/44 tes** (termasuk tes publik dan SQL autentikasi). `git diff --check` bersih.

### Lanjutan migrasi — widget statistik (27 Oktober 2026)

Widget Santri dan Alumni pada `/dashboard` membaca agregat `santris` untuk Taud, Kuttab, Madrasah, Darul 'Ilmi dan Ma'had 'Aly. Status mengikuti widget Laravel: `santri` untuk santri aktif dan `lulus` untuk alumni. Grafik batang HTML/CSS menyertakan angka per jenjang dan total, termasuk saat data kosong. Query hanya berjalan untuk status widget yang diizinkan oleh `widget_JumlahSantri` / `widget_JumlahAlumni`; data ini merupakan agregat operasional sesuai permission, bukan daftar santri per KK.

Verifikasi: seluruh 46 tes lulus setelah implementasi statistik, termasuk fixture SQL tabel TEMPORARY untuk status, jenjang, agregasi, data kosong dan pembatasan query berdasarkan permission. Tes HTTP tambahan mencakup sesi, permission, no-store dan HEAD. Pemeriksaan visual widget baru desktop/HP masih tertunda. Widget penerimaan, alur tambah/edit santri dan berkas masih mengikuti item terbuka pada checklist.

### Lanjutan migrasi — rekap penerimaan Madrasah (27 Oktober 2026)

Widget `/dashboard` dengan permission `widget_JumlahPsbSantriMadrasah` kini membaca rekap lima status pendaftar, ikhwan/akhwat dan total dari database. Filter GET `psb_year` dan `psb_wave` memilih tahun serta gelombang; tanpa parameter memilih gelombang MD terbaru. Nilai kosong memilih semua. Saat mengganti tahun, pilih semua gelombang lalu terapkan untuk memuat opsi tahun tersebut. Kombinasi tahun/gelombang yang tidak sesuai ditolak dengan pesan dan tautan reset. Semua pilihan tetap membatasi agregat ke penerimaan berkode MD dan jenjang Madrasah, termasuk pilihan semua tahun/gelombang.

Verifikasi: 49 tes penuh lulus, termasuk fixture MySQL TEMPORARY untuk default terbaru, filter tahun/gelombang, penolakan gelombang DI, pemisahan jenjang/status, nilai nol dan permission. Tes HTTP tambahan memeriksa sesi, permission, no-store serta penerusan filter GET. Pemeriksaan visual desktop/HP dan tema terang/gelap masih terbuka; modul tambah/edit santri serta berkas belum selesai.

### Penyesuaian gaya widget (27 Oktober 2026)

Grafik santri/alumni dikembalikan ke batang vertikal dengan lima warna jenjang mengikuti widget Laravel. Filter penerimaan memakai pembungkus input, font, warna tema dan ukuran kontrol dashboard; tabel memakai header/footer, angka rata tengah dan warna ikhwan/akhwat. Preview dengan data tiruan diperiksa pada 1440 dan 390 px, tema terang/gelap: halaman tidak melebar horizontal, tabel dapat digeser di HP. Empat tes statistik SQL/permission lulus. Pemeriksaan ini memvalidasi layout widget, belum menyatakan kesetaraan visual seluruh dashboard dengan Laravel.

### Lanjutan migrasi — widget wali (27 Oktober 2026)

Dasbor kini menampilkan jadwal penerimaan aktif dan mendatang terdekat serta maksimal 20 santri sesuai nomor KK akun. Permission widget mengikuti Laravel (`view_any_santri::wali`); tautan detail memerlukan `view_santri::wali`. KK kosong tidak menjalankan query santri. Tautan daftar lengkap menyediakan pencarian dan pagination yang sudah tersedia. Jadwal dibatasi status aktif dan tanggal Asia/Jakarta, termasuk hari mulai/selesai. Jika beberapa periode aktif bertumpang tindih, dipilih tanggal mulai lalu ID paling awal agar hasil konsisten.

Verifikasi: 53 tes penuh lulus, termasuk SQL tabel TEMPORARY untuk batas tanggal, periode nonaktif/berakhir, pemilihan jadwal terdekat, dan isolasi KK. Fixture HTTP memeriksa permission, KK akun, HEAD dan no-store. `node scripts/check-dashboard-ui.js` memakai contoh widget terisolasi pada desktop 1440 px/HP 390 px serta tema terang/gelap; tidak ada overflow horizontal atau exception JavaScript. Screenshot di `storage/auth-preview/dashboard-{light,dark}-{1440,390}.png`. Tidak mengubah akun atau santri asli.

Widget lengkap tetap belum selesai: catatan/status lanjutan, unggahan/berkas dan tindakan penerimaan menunggu migrasi. Tambah/edit santri juga belum tersedia.

### Penyesuaian tampilan widget wali

Widget memakai susunan sumber Laravel: tombol pendaftaran ketika ada penerimaan aktif, informasi jadwal mendatang jika belum aktif, atau pesan jadwal belum tersedia. Santri ditampilkan sebagai kartu berisi nama, nomor pendaftaran, jenjang, status dan catatan. Tombol pendaftaran masih nonaktif karena alur pendaftaran belum dipindahkan; foto, berkas, edit dan catatan status tambahan juga masih menunggu migrasi. Daftar kartu dibatasi 20 dengan tautan ke daftar lengkap.

Verifikasi: 53 tes lulus termasuk keadaan jadwal dan isolasi KK. Preview browser dengan data tiruan diperiksa pada desktop/HP dan tema terang/gelap; `git diff --check` bersih.

### Lanjutan migrasi — catatan status dan kontak wali

Kartu santri menampilkan catatan tambahan dari `status_catatan` yang cocok dengan status santri. Jika master menyediakan label dan nomor WhatsApp, tombol mengisi `{nama}` dan `{nomor}` dengan data santri; tautan HTTPS yang disimpan di master juga dapat dibuka. Label kosong atau `tidak ada` menyembunyikan tombol. Tautan selain HTTPS ditolak. Query tetap dibatasi KK akun dan tidak mengubah data.

Verifikasi: 53 tes lulus, termasuk fixture MySQL TEMPORARY untuk catatan, substitusi pesan, tautan grup, label nonaktif, penolakan URL berbahaya dan isolasi KK. Preview contoh pada desktop/HP dan tema terang/gelap lulus. Berkas, edit formulir dan pendaftaran tetap belum dipindahkan.

### Lanjutan migrasi — dokumen pada kartu wali

Kartu menampilkan pass foto, akta lahir, kartu keluarga, bukti pembayaran, ijazah dan surat komitmen sesuai jenjang/status sumber Laravel. Gambar dapat dibuka oleh akun dengan `view_any_santri::wali`; unggah/ganti dan hapus juga memerlukan `update_santri::wali`. Semua operasi memeriksa nomor KK dan jenis dokumen yang berlaku pada record. Unggahan PNG/JPEG/WebP maksimal 1 MB dikonversi menjadi JPEG, dengan tinggi maksimal 1080 piksel. Penghapusan mengosongkan hubungan di database; berkas lama dipertahankan di penyimpanan untuk menghindari penghapusan berkas yang mungkin masih dirujuk aplikasi lain.

Database dipakai bersama Laravel, tetapi folder `alyusro-node/storage/uploads` merupakan salinan lokal yang terpisah dari `storage/app/public` Laravel. Unggahan Node.js karena itu belum otomatis tersedia di direktori Laravel; diperlukan penyimpanan bersama atau sinkronisasi sebelum kedua aplikasi dipakai bersamaan. Berkas lama yang tidak lagi dirujuk perlu dikelola saat menyiapkan penyimpanan bersama. Tombol edit formulir dan pendaftaran masih nonaktif.

Verifikasi: 54 tes lulus, termasuk SQL TEMPORARY dan direktori sementara untuk unggah, baca, hapus, validasi gambar/jenis dokumen, permission dan lintas KK, serta HTTP untuk sesi, CSRF dan Origin. Preview contoh pada desktop/HP tema terang/gelap diperiksa tanpa akun asli.

### Penyesuaian kartu dokumen

Gambar dokumen ditata satu kolom dengan gambar `default.jpg` dan ukuran 100 × 133 piksel mengikuti kartu Laravel. Klik gambar kosong membuka modal unggah dan pratinjau; gambar yang tersedia dapat diperbesar dan tombol hapus meminta konfirmasi. Formulir edit dan pendaftaran tetap menunggu migrasi. Pemeriksaan browser mencakup buka/tutup modal pada desktop/HP dan tema terang/gelap; 54 tes lulus.

### Lanjutan migrasi — edit formulir santri wali

Tombol Edit Formulir pada kartu membuka `/dashboard/santri-wali/:id/edit` untuk pengguna dengan `update_santri::wali`. Formulir memindahkan isian santri, sumber informasi, orang tua, wali dan kontak dari resource Laravel; nomor KK dan status dipertahankan di server. Perubahan jenjang hanya diterima bila terdapat penerimaan aktif pada tanggal Asia/Jakarta; server memilih gelombang aktif terbaru, membuat nomor pendaftaran, dan mengubah status `santri` menjadi `belum terverifikasi` seperti sumber Laravel. Jenjang lama tetap bisa disimpan tanpa penerimaan aktif. NIK dan NISN diperiksa untuk duplikasi, dan panjang data mengikuti batas kolom database saat lebih pendek dari formulir lama. Nilai tersembunyi dari browser tidak menentukan status, KK atau nomor pendaftaran.

Verifikasi: 56 tes lulus, termasuk SQL TEMPORARY untuk sukses, validasi gagal, duplikasi, KK lain/kosong, permission, manipulasi KK/status dan perubahan jenjang; HTTP memeriksa sesi, CSRF dan no-store. Formulir diuji pada browser dengan data tiruan. Pengujian operasional bersama Laravel belum dilakukan; pendaftaran santri baru tetap belum tersedia. Database saat ini tidak memiliki indeks unik untuk NIK/NISN, sehingga penulisan bersamaan oleh aplikasi lain masih perlu diselaraskan. Tautan Lihat detail santri dihapus dari kartu sesuai sumber Laravel.

### Lanjutan migrasi — pendaftaran santri wali

Saat ada penerimaan aktif, tombol pada kartu membuka formulir pendaftaran bagi pengguna dengan permission `create_santri::wali`. Formulir memakai aturan validasi yang sama dengan edit dan mengisi data keluarga dari santri sebelumnya dengan KK yang sama. Server memeriksa ulang penerimaan dan sumber informasi, menyimpan KK dari akun, menetapkan status `belum terverifikasi`, serta membuat nomor pendaftaran berdasarkan gelombang. Baris gelombang dikunci selama pembuatan nomor di Node.js; batas unik nomor pendaftaran database menangani benturan dengan penulis lain. Setelah berhasil, pengguna kembali ke dasbor.

Verifikasi: 57 tes lulus. Fixture MySQL TEMPORARY memeriksa pendaftaran berhasil, duplikasi, isian tidak valid, penerimaan tidak aktif, permission, KK kosong dan manipulasi KK/status/nomor; fixture HTTP memeriksa sesi, CSRF dan no-store. Browser memeriksa formulir tiruan. Uji penulisan bersamaan dengan Laravel belum dilakukan. NIK/NISN belum memiliki indeks unik database, sehingga pemeriksaan duplikasi belum menjamin keunikan terhadap penulisan bersamaan lintas aplikasi.

### Lanjutan migrasi — Dokumen santri wali

Menu Dokumen santri membuka `/dashboard/dokumen-wali`, berisi daftar, pencarian nama, pagination dan thumbnail ijazah SD/SMP, akta serta KK. Pengguna dengan `update_berkas::santri::wali` dapat membuka Perbarui Berkas dan mengunggah, mengganti atau menghapus pass foto, akta, KK, ijazah dan bukti PSB sesuai jenjang. Alur unggah disimpan per dokumen; pratinjau berkas memerlukan sesi dan KK yang cocok. Hak akses daftar dan perubahan mengikuti permission resource dokumen (`view_any_berkas::santri::wali` dan `update_berkas::santri::wali`), terpisah dari permission widget santri. Varian penulisan jenjang Darul Ilmi, Ma'had Aly dan TK Taud dinormalisasi agar pilihan dokumen tidak hilang karena tanda baca.

Verifikasi: 58 tes lulus, termasuk fixture MySQL TEMPORARY dan berkas sementara untuk permission, KK kosong/lintas KK, jenis dokumen, unggah/baca/hapus dan fixture HTTP untuk sesi, CSRF dan no-store. Preview browser pada desktop/HP dan tema terang/gelap ada di `storage/auth-preview/dokumen-{light,dark}-{1440,390}.png`. Penyimpanan Node.js masih terpisah dari Laravel seperti dijelaskan di atas; pengujian operasional penyimpanan bersama belum dilakukan.

### Lanjutan migrasi — Status Catatan

Menu Status Catatan kini membuka daftar dengan pencarian literal, pengurutan status/tanggal dan pagination. Pengguna berizin dapat menambah, mengedit, dan menghapus hingga 20 status terpilih sekaligus dengan konfirmasi. Status unik mengikuti constraint database; pesan mendukung `{nama}` dan `{nomor}` pada kartu wali. Nomor kontak harus 9–15 digit atau tautan HTTPS yang valid, sesuai cara kartu Node.js membuka tautan. Hak daftar/tambah/edit/hapus massal menggunakan permission Spatie masing-masing.

Verifikasi: 60 tes lulus, termasuk tabel MySQL TEMPORARY untuk CRUD, status duplikat, escaping, pencarian literal, validasi tautan, permission dan hapus massal; fixture HTTP memeriksa sesi, CSRF, HEAD dan no-store. Pemeriksaan browser dengan data tiruan mencakup desktop/HP serta tema terang/gelap; screenshot berada di `storage/auth-preview/status-catatan-{light,dark}-{1440,390}.png`.

### Lanjutan migrasi — Sumber Informasi

Menu Sumber Informasi menyediakan daftar, pencarian literal, pengurutan nama/jumlah santri, pagination, tambah, edit dan hapus massal. Slug dibuat di server saat tambah dan dipertahankan saat edit, mengikuti field slug nonaktif di resource lama. Slug menggunakan normalisasi Unicode; untuk beberapa aksara hasilnya dapat berbeda dari transliterasi Laravel. Constraint database menolak slug duplikat. Setiap tindakan memerlukan permission Spatie masing-masing.

Penghapusan hingga 20 sumber sekaligus meminta konfirmasi dan memberi tahu bahwa foreign key Laravel mengosongkan `referral_source_id` pada santri terkait (`ON DELETE SET NULL`). Verifikasi: 62 tes lulus, termasuk fixture SQL TEMPORARY untuk jumlah, duplikasi slug, validasi dan permission; fixture HTTP memeriksa sesi, CSRF, HEAD dan no-store. Fixture tabel TEMPORARY tidak memverifikasi aksi foreign key; perilaku tersebut berdasarkan migrasi Laravel. Preview desktop/HP dan tema terang/gelap tersimpan di `storage/auth-preview/sumber-informasi-{light,dark}-{1440,390}.png`.

### Lanjutan migrasi — Penerimaan Santri

Menu Penerimaan Santri kini menyediakan daftar, pencarian kode, pagination, tambah/edit program, tahun, gelombang, tanggal, biaya, kuota, status dan catatan. Kode gelombang dihasilkan server mengikuti prefix model Laravel; kode duplikat ditolak. Validasi juga menolak tanggal tidak valid atau tanggal selesai sebelum mulai, serta angka negatif atau di luar batas database. Permission daftar/tambah/edit/hapus tunggal/hapus massal mengikuti policy Laravel.

Penghapusan meminta konfirmasi dan hanya diperbolehkan jika gelombang tidak mempunyai santri. Perlindungan ini disengaja karena foreign key Laravel `santris_penerimaan_santri_id_foreign` memakai `ON DELETE CASCADE`, yang dapat menghapus santri terkait. Penghapusan menggunakan transaksi dan penguncian record penerimaan sebelum memeriksa santri. Uji tabel TEMPORARY memeriksa penolakan ketika ada santri, tetapi tidak mensimulasikan foreign key atau penulisan bersamaan antar aplikasi.

Verifikasi: 64 tes lulus, termasuk SQL TEMPORARY untuk permission, validasi, duplikasi kode, CRUD, dan penolakan hapus gelombang yang dipakai; fixture HTTP memeriksa sesi, CSRF, HEAD dan no-store. Preview desktop/HP dan tema terang/gelap tersimpan di `storage/auth-preview/penerimaan-{light,dark}-{1440,390}.png`.

### Komponen tabel dashboard

`src/dashboard-table.js` menyediakan `tableQuery`, `renderTable`, dan `selectedTableIds` untuk tabel dashboard baru. Komponen menangani validasi pencarian literal dan halaman, opsi pengurutan yang dibatasi daftar yang ditentukan modul, pagination, escaping teks, tabel responsif, pilihan semua baris pada halaman, serta validasi ID untuk aksi massal. Gunakan `query.pattern` sebagai parameter SQL dan `query.limit`/`query.offset` untuk query yang tetap ditentukan modul. Untuk pengurutan, petakan nilai `query.sort` ke kolom SQL yang sudah diizinkan; jangan mengambil ekspresi SQL langsung dari request.

Definisi kolom mendukung `key` untuk teks, `value` untuk pemformatan teks, dan `html` untuk tautan atau gambar. Callback `html` menghasilkan markup tepercaya dan **wajib** meng-escape setiap nilai record dengan `esc`. Komponen tidak menerapkan permission, pembatasan KK, CSRF, aturan bisnis, atau mutasi database; modul pemanggil tetap harus menerapkan dan mengujinya. Pilih semua hanya memilih baris di halaman yang tampil, maksimal 20 untuk aksi massal yang sudah ada.

Lima daftar sudah menggunakan komponen ini: Data Santri wali, Dokumen santri, Status Catatan, Sumber Informasi, dan Penerimaan Santri. Widget statistik tetap memakai tabel khusus karena merupakan ringkasan, bukan daftar yang dapat dicari atau dipilih. Verifikasi: 66 tes lulus, termasuk fixture SQL/HTTP yang ada dan tes komponen untuk validasi, escaping, pagination, sort dan ID massal. Browser memeriksa tampilan serta pilih semua pada desktop/HP dan tema terang/gelap.

Analisis lanjutan menemukan batas lebar formulir umum ikut menyempitkan tabel dengan aksi massal. CSS sekarang mengecualikan formulir tabel dan pencariannya dari batas itu serta mengecilkan kolom checkbox. Seluruh 66 tes lulus setelah perubahan; pemeriksaan visual perubahan ini di browser masih diperlukan. Perbedaan yang belum selesai dicatat dalam checklist migrasi.

Rancangan tabel berikutnya menambahkan toolbar ringkas, pilihan kolom sementara dan pengurutan lewat judul kolom yang didukung. Preview fixture desktop/HP terang/gelap dan 66 tes lulus. Total hasil, ukuran halaman, filter dan ekspor masih memerlukan implementasi per modul; pilihan kolom kembali ke keadaan awal saat halaman dimuat ulang.

Tabel bersama kini mendukung jumlah hasil dari query, 10/20/50/100 baris per halaman, nomor halaman, menu aksi massal dan pilihan kolom yang disimpan di browser. Filter dan ekspor masih belum diimplementasikan.

Penerimaan Santri memiliki filter status dan ekspor Excel (.xlsx) mengikuti pencarian/filter dan permission daftar, dibatasi 10.000 baris; nilai teks disimpan sebagai teks, bukan rumus. Menu aksi baris tersedia pada daftar dengan tindakan edit. Tes SQL TEMPORARY memeriksa filter, isi workbook Excel dan penolakan tanpa izin; 66 tes lulus dan preview dashboard desktop/HP terang/gelap lulus. Filter lima daftar dan kolom pertama tetap terlihat saat tabel HP digeser.

API tabel bersama: `tableQuery` memvalidasi pagination/pengurutan, `tableFilters` memvalidasi pilihan filter, `renderTable` menerima konfigurasi kolom, filter, ekspor dan aksi massal, `tableRowActions` merender menu aksi, dan `tableExcel` membentuk workbook Excel dengan nilai teks yang tidak menjadi rumus. Setiap modul tetap menyediakan query dan endpoint ekspornya serta memeriksa permission dan batas data; komponen tidak secara otomatis memberikan akses ekspor. Penerimaan Santri adalah contoh integrasi filter dan ekspor yang sudah berfungsi. Kelima daftar yang dipindahkan sudah terhubung ke ekspor Excel; filter dikonfigurasi sesuai data masing-masing daftar.

Kelima daftar memakai ekspor Excel sesuai izin daftar dan pencarian. Data wali dibatasi KK; ekspor dokumen hanya mencantumkan status unggah. Tes fixture memeriksa isi workbook dan isolasi KK.

Filter tersedia pada lima daftar: jenjang/status santri wali, status unggah akta, status penerimaan, label tombol status, dan keberadaan santri terkait pada sumber informasi. Filter juga diterapkan pada ekspor. Kolom pertama tetap terlihat saat tabel digeser di HP.

Tanggal perubahan Status Catatan ditampilkan dalam format `d M Y H:i` seperti resource Laravel dan memakai format yang sama dalam ekspor Excel. Tes terisolasi memeriksa tampilan dan isi workbook tanpa mengubah zona waktu; dua tes Status Catatan, termasuk fixture MySQL TEMPORARY, lulus. Kesetaraan visual tabel secara menyeluruh masih perlu diperiksa.

Daftar Santri Wali mendukung pengurutan nama, nama Arab, jenjang dan status melalui judul kolom. Ekspor mengikuti urutan dan filter yang sama serta tetap dibatasi KK akun. Tes terisolasi memeriksa validasi parameter, query, batas KK dan isi workbook; pemeriksaan visual dan operasional modul masih diperlukan.

### Migrasi Calon Santri (bertahap)

Daftar `/dashboard/calon-santri` mendukung pencarian, pengurutan, filter status/gelombang/jenis kelamin, ekspor Excel dan perubahan status per calon sesuai permission. Tes `node test/candidates.test.js` memeriksa permission, validasi, query dan isi workbook dengan database tiruan. Pengujian SQL/HTTP dengan database nyata, pemeriksaan visual, filter tanggal, aksi massal, berkas dan cetak masih diperlukan sebelum modul dianggap selesai. Pada lingkungan sandbox saat ini pengujian yang membutuhkan MySQL gagal karena koneksi ke 127.0.0.1:3306 ditolak (EPERM).

### Calon Santri: lanjutan migrasi

Filter tanggal inklusif, pilihan beberapa status dan gelombang, edit catatan, dan hapus tunggal tersedia dengan validasi dan permission. Filter dipertahankan pada pencarian, pagination, dan ekspor. Tes unit menggunakan database tiruan; pengujian database/HTTP nyata, relasi penghapusan, dan tampilan masih diperlukan. Aksi massal, berkas/ZIP, dan cetak belum tersedia.

### Calon Santri: status massal dan pencarian

Status calon terpilih dapat diubah sekaligus dengan permission update, pilihan status dari master, konfirmasi dan batas 100 ID. Kandidat yang telah berstatus Santri/Lulus/Di Keluarkan dikecualikan saat penulisan. Nomor HP menyediakan tautan WhatsApp; pencarian juga mencakup jenis kelamin, nomor HP dan tanggal daftar, dan urutan awal menampilkan pendaftar terbaru. Tes modul menggunakan database tiruan memeriksa permission, validasi, query, tautan dan workbook; pengujian SQL/HTTP nyata dan pemeriksaan visual masih diperlukan. Ekspor pilihan massal, ZIP dan cetak belum tersedia.

Verifikasi lanjutan: seluruh 76 tes lulus dengan akses MySQL lokal; tes khusus fitur Calon Santri baru masih menggunakan database tiruan. Server Node.js di port 8075 di-restart dan halaman login merespons HTTP 200.

Pengurutan Calon Santri juga tersedia pada kolom NISN, NIK, asal sekolah, jenis kelamin dan nomor HP, termasuk pada ekspor yang mengikuti filter. Tes `node --test test/candidates.test.js` memeriksa query daftar/ekspor dan penolakan ekspresi sort yang tidak diizinkan menggunakan database tiruan. Verifikasi SQL dan browser tetap terbuka.

Pencarian Calon Santri kini juga mencakup status dan kode gelombang; status, kode gelombang, dan catatan dapat diurutkan pada daftar maupun ekspor. Tes `node --test test/candidates.test.js` memeriksa query, escaping pencarian dan pengurutan menggunakan database tiruan. Verifikasi SQL nyata dan visual masih diperlukan.

Ekspor Excel calon santri terpilih tersedia sebagai aksi massal untuk pengguna dengan izin daftar, maksimal 100 ID dan hanya status calon. Tes terisolasi memeriksa izin, validasi, query dan isi workbook; pengujian SQL/HTTP nyata masih diperlukan.

Pratinjau berkas Calon Santri mencakup pass foto, akta, kartu keluarga, bukti pembayaran dan ijazah sesuai jenjang. Endpoint memerlukan permission daftar, memeriksa status calon dan hanya membaca gambar dalam direktori unggahan; berkas disajikan ulang sebagai JPEG. Tes terisolasi memeriksa pemetaan, izin, batas path, status dan tautan tabel. Surat komitmen, ZIP, cetak serta verifikasi SQL/HTTP dan visual operasional masih belum selesai.

ZIP pendaftaran per calon dan ZIP pembayaran massal tersedia di daftar Calon Santri dengan permission daftar dan pengecualian status non-calon. Arsip dibuat tanpa berkas sementara, path dibatasi ke penyimpanan unggahan Node.js, maksimal 100 calon, 10 MB per berkas dan 50 MB total. Tes fixture memeriksa isi arsip dan penolakan symlink ke luar penyimpanan; pengujian operasional penyimpanan bersama Laravel masih diperlukan.

Pemeriksaan ulang widget statistik dan penerimaan: fixture browser kini benar-benar memuat kedua widget, termasuk nilai contoh dan nol. Preview 1440/390 px dalam tema terang/gelap diperiksa; tabel penerimaan dapat digeser pada HP dan tidak menyebabkan overflow halaman. Skrip `node scripts/check-dashboard-ui.js` dan seluruh 84 tes `npm test` lulus. Pemeriksaan ini memakai data tiruan dan tidak membuktikan kesetaraan seluruh dashboard.

### Lima master dashboard berikutnya

Rute `/dashboard/kategori-artikel`, `/dashboard/kategori-fasilitas`, `/dashboard/struktur-mahad`, `/dashboard/menu`, dan `/dashboard/event-mahad` memigrasikan resource Laravel yang sudah aktif. Semuanya memakai tabel bersama, pencarian literal, pagination/jumlah baris, pilihan kolom tersimpan, pengurutan kolom yang tersedia, serta ekspor Excel mengikuti pencarian/filter. Status kategori artikel dan menu dapat difilter. Menu navigasi dan setiap endpoint memeriksa permission Spatie resource masing-masing.

Kategori artikel menyediakan tambah, perubahan status, dan soft delete massal; nama tidak diedit karena resource lama hanya menyediakan perubahan status. Kategori fasilitas, struktur dan menu menyediakan tambah/edit/hapus massal. Event menyediakan tambah/detail/edit, konfirmasi hapus tunggal dan hapus massal. Penghapusan kategori fasilitas yang masih dirujuk fasilitas dan event yang masih dirujuk tiga jenis ijazah ditolak dalam transaksi dengan penguncian parent, agar foreign key cascade tidak menghapus data terkait. Kategori artikel dihapus lunak tanpa menghapus artikel.

Slug kategori dibuat otomatis memakai normalisasi Unicode yang sama dengan master Sumber Informasi Node.js, dengan suffix untuk benturan dan batas panjang kolom; transliterasi sebagian aksara dapat berbeda dari Laravel. Deskripsi kategori fasilitas disimpan sebagai teks, maksimal 65.535 byte sesuai kolom TEXT; batas formulir endpoint master mengizinkan teks tersebut tanpa menaikkan batas formulir autentikasi lainnya.

Verifikasi: `npm test` (90 tes), termasuk `test/dashboard-masters.test.js` dengan DDL baseline pada MySQL TEMPORARY serta HTTP untuk CRUD, validasi, permission, CSRF/Origin, HEAD/no-store, filter, isi workbook, soft delete dan perlindungan relasi. Fixture memakai sesi sintetis dan tidak mengubah data operasional; tabel TEMPORARY tidak mensimulasikan constraint foreign key maupun penulisan Laravel bersamaan. `node scripts/check-master-ui.js` memeriksa kelima modul pada 1440/390 px dan tema terang/gelap, daftar berisi/kosong, keyboard, kolom tersimpan, pagination, sort/filter, formulir/detail dan tambah/hapus melalui browser. Preview tersimpan di `storage/auth-preview/master-*.png`, dengan ringkasan `masters-contact-sheet.png`. Dropdown tabel bersama pada HP mengikuti lebar toolbar agar pilihan kolom tetap dapat diklik.


### Migrasi Program Pendidikan, Kalender Akademik, Prestasi, Nama Kota, dan Tema Soal

Lima item pada checklist yang sama diselesaikan melalui `/dashboard/program-pendidikan`, `/dashboard/kalender-akademik`, `/dashboard/prestasi`, `/dashboard/nama-kota`, dan `/dashboard/tema-soal`. Seluruh daftar menggunakan tabel bersama: pencarian literal, pengurutan terkontrol, pagination/jumlah baris, pilihan kolom tersimpan, aksi sesuai permission dan ekspor Excel mengikuti pencarian/filter, maksimal 10.000 baris. Navigasi menggunakan permission Spatie resource Laravel masing-masing, termasuk `c::b::t::tema::soal`.

Program Pendidikan menyediakan tambah/edit nama, tautan, biaya, deskripsi/target rich text dan deskripsi biaya. Editor menyediakan format dasar dan fallback textarea ketika JavaScript dimatikan; HTML disanitasi saat baca formulir dan tulis. Program yang masih digunakan kelas atau penerimaan tidak dapat dihapus. Kalender menyediakan tambah/edit kegiatan, rentang tanggal, keterangan dan dua belas warna, serta hapus tunggal dengan konfirmasi/massal. Prestasi menyediakan tambah/detail/edit dan hapus massal; resource Laravel aktif tidak menyediakan unggahan gambar. Nama Kota menyediakan tambah/edit Latin/Arab dan verifikasi melalui formulir serta filter verifikasi. Tema Soal menyediakan tambah/edit nama unik, ID/jumlah soal terkait, serta hapus massal; tema dengan soal ditolak agar cascade tidak menghapus bank soal.

Kalender, Prestasi dan Nama Kota menyediakan formulir unggah multipart dan template `.xlsx`. Impor dibatasi 1 MB, 1.000 baris dan isi ZIP maksimal 8 MB, menolak rumus/objek sel dan memvalidasi seluruh baris sebelum transaksi. Kesalahan satu baris membatalkan seluruh impor. Template kalender memakai tahun/bulan/tanggal mulai dan selesai seperti importer Laravel; nama warna dipetakan ke HEX, warna tak dikenal memakai biru. Impor kota menormalkan Latin ke huruf kecil, memperbarui Arab pada nama yang sama dan mempertahankan verifikasi; memerlukan create dan update. Format biner `.xls` lama perlu disimpan ulang sebagai `.xlsx`. Perubahan kota langsung melalui formulir memerlukan update, tanpa izin create. Pengeditan inline Laravel disediakan melalui formulir edit di Node.js.

Verifikasi: `npm test` lulus 95 tes. Fixture `test/dashboard-masters.test.js` memakai baseline DDL pada MySQL TEMPORARY dan sesi HTTP sintetis: CRUD, validasi, permission, CSRF/Origin, HEAD/no-store, pencarian literal, filter, isi workbook ekspor/template, unggah multipart, hasil impor/upsert, penolakan rumus dan perlindungan relasi. Data operasional tidak diubah. Fixture TEMPORARY tidak mensimulasikan foreign key maupun penulisan bersamaan Laravel. Perlindungan penghapusan memakai transaksi dan penguncian parent; impor kota mempertahankan perilaku pencocokan nama lama tanpa menambahkan indeks unik baru.

`MASTER_UI_RESOURCES=program-pendidikan,kalender-akademik,prestasi,nama-kota,tema-soal node scripts/check-master-ui.js` memeriksa lima master baru pada desktop 1440 px/HP 390 px, tema terang/gelap, daftar berisi/kosong, keyboard, pilihan kolom tersimpan, pagination, sort/filter dan formulir/detail. `MASTER_UI_ACTIONS_ONLY=1 node scripts/check-master-ui.js` mengulangi pengiriman formulir lima modul baru, format rich text, unggah Excel melalui browser dan screenshot formulir. Screenshot tersedia di `storage/auth-preview/master-*.png`, `master-form-*.png` serta `masters-contact-sheet.png`. Pengujian operasional lintas aplikasi tetap terbuka pada checkbox umum yang sudah ada.

Server lokal port 8075 direstart setelah perubahan. `/dashboard/login` merespons HTTP 200; kelima rute baru tanpa sesi mengarah ke login (303). Pembaruan sesi ini mengubah tepat lima checkbox lama dari `[ ]` menjadi `[x]`, tanpa checklist pengganti.


### Migrasi Artikel, Artikel Saya, Fasilitas, Galeri Fasilitas dan Dokumen

Kelima modul tersedia pada `/dashboard/artikel`, `/dashboard/artikel-saya`, `/dashboard/fasilitas`, `/dashboard/galeri-fasilitas` dan `/dashboard/dokumen`. Menu dan endpoint memakai permission resource Laravel masing-masing. Tabel menyediakan pencarian literal, pagination, pengurutan terkontrol, ekspor Excel maksimal 10.000 baris dan hapus massal maksimal 100 pilihan. Artikel menggunakan soft delete; Artikel Saya membatasi seluruh operasi, ekspor dan akses thumbnail ke penulis akun aktif. Penulis ditetapkan server dan tidak dapat diganti melalui payload formulir. Status draft, published dan archived serta kategori diubah melalui formulir edit.

Formulir konten mendukung rich text tersanitasi, pilihan relasi kategori/fasilitas dari database dan unggahan multipart maksimal 10 MB. Gambar diubah ke WebP dengan crop 16:9: thumbnail 360×203 dan galeri 1920×1080. Penulisan data menggunakan transaksi dan penguncian record/relasi; fasilitas yang masih memiliki galeri ditolak ketika dihapus. Dokumen menerima PDF, Office, teks/CSV, gambar dan ZIP/RAR dengan validasi ekstensi serta signature/struktur isi. Berkas baru memakai nama penyimpanan acak untuk mencegah benturan; nama dokumen dipakai pada download dengan ekstensi asli. Endpoint preview/download memeriksa permission per resource/record dan batas path; respons memakai no-store, nosniff dan sandbox.

Unggahan kelima modul ditulis ke `storage/app/public` Laravel, bukan salinan `alyusro-node/storage/uploads`. Deployment harus memberi proses Node.js akses tulis pada direktori tersebut. Halaman publik Node.js dan PDF membaca thumbnail/galeri baru dari penyimpanan bersama setelah pemeriksaan akses publik yang sudah ada. Tautan model dokumen `/preview/…` dan `/download/…` tetap disimpan untuk kompatibilitas Laravel; dashboard Node.js memakai endpoint berkasnya sendiri. Berkas lama yang diganti atau record-nya dihapus tetap disimpan, mengikuti perilaku FileUpload Laravel; pembersihan storage tidak termasuk perubahan ini.

Verifikasi: `npm test` lulus 102 tes, termasuk fixture MySQL TEMPORARY/HTTP `test/content-modules.test.js` untuk lima modul, permission, CSRF/Origin, scope lintas penulis, relasi, isi workbook, validasi unggahan, transformasi gambar dan path/symlink. Satu fixture berkas tanpa penulisan data operasional memeriksa storage bersama dan embedding thumbnail pada PDF. `CONTENT_UI=1 node --test test/content-modules.test.js` memeriksa daftar berisi/kosong dan formulir pada 1440/390 px dalam tema terang/gelap, tanpa overflow halaman atau exception JavaScript, serta mengirim artikel dengan thumbnail melalui browser. Screenshot berada di `storage/auth-preview/content-*.png`. Fixture memakai sesi sintetis dan tidak mengubah record operasional; pengujian TEMPORARY tidak mensimulasikan constraint foreign key atau penulisan Laravel bersamaan. Tepat lima checkbox lama diperbarui pada checklist yang sama.

Server lokal port 8075 direstart setelah perubahan ini. Halaman login merespons HTTP 200 dan kelima rute modul tanpa sesi mengarah ke login (303).


### Perpustakaan Nama, berkas bersama dan formulir Calon Santri

`/dashboard/perpustakaan-nama` memakai tabel bersama dan permission `perpustakaan::nama`: daftar, pencarian literal, pagination, pengurutan, filter status dan nama belum terdefinisi, tambah/edit, hapus massal, ekspor serta impor/template `.xlsx`. Filter awal menampilkan nama Arab yang mengandung “belum terdefinisi”; pilih Semua Nama untuk menampilkan seluruh kamus. Status 1 berarti belum terverifikasi dan 2 terverifikasi. Impor menambah record secara atomik (1 MB/1.000 baris), tidak mengubah entri terverifikasi yang sudah ada. Formulir edit menggantikan edit inline resource lama.

Konversi batch memakai template satu kolom `nama_latin`, menghasilkan workbook Latin/Arab, menggabungkan al/az/el dengan kata berikutnya dan menambahkan istilah tak dikenal berstatus 1. Memerlukan izin daftar dan create kamus. Sel rumus/objek, arsip terlalu besar dan nama terlalu panjang ditolak sebelum penulisan; seluruh konversi memakai satu transaksi. Data teks pada workbook tidak dijalankan sebagai rumus. Endpoint `/convert` hanya menerima POST dengan sesi, CSRF dan pemeriksaan Origin; `/conversion-template` memerlukan izin daftar.

Unggahan santri baru ditulis ke disk public Laravel `storage/app/public/uploads/node-wali/` dengan nama acak. Pembacaan pratinjau serta ZIP mencoba disk bersama terlebih dahulu, lalu unggahan lama Node `alyusro-node/storage/uploads/` agar data lama tetap terbaca. Setiap berkas harus berada di dalam root yang disetujui, termasuk sesudah resolusi symlink, memiliki ekstensi yang diizinkan dan maksimal 10 MB. Unggahan tetap dibatasi gambar 1 MB, ditransformasi ulang menjadi JPEG, diperiksa permission/KK dan record dikunci saat penulisan. Proses Node dan Laravel harus memiliki akses filesystem yang sesuai pada disk bersama. Penghapusan/ganti referensi tidak menghapus berkas lama, mengikuti perilaku unggahan Laravel.

Calon Santri menyediakan surat komitmen sesuai jenjang dan `/dashboard/calon-santri/:id/print` untuk PDF A4 dengan logo, foto, data keluarga, persetujuan serta tanda tangan. Izin daftar dan status calon diperiksa sebelum membaca data; status Santri/Lulus/Di Keluarkan tidak dapat dicetak melalui modul ini. PDF dibuat tanpa JavaScript/permintaan jaringan, maksimal dua render bersamaan. Template menghindari tahun ajaran 2025/2026 yang ditulis tetap pada versi Laravel. ZIP kini menyertakan ijazah SMA, pembayaran Mahad Aly/Mahdon Tarbawi dan surat komitmen Mahad Aly yang tersedia. Hapus calon memerlukan konfirmasi HAPUS, transaksi dan kunci parent; relasi ijazah/sabaq menolak penghapusan, relasi foto dibersihkan saat berhasil.

Verifikasi: 105 tes `npm test` lulus. `test/student-storage.test.js` menulis fixture berkas unik dan menjalankan bootstrap PHP Laravel untuk memeriksa baca/tulis dua arah, kemudian membersihkannya; record operasional tidak diubah. `test/candidate-operational.test.js` memakai DDL baseline MySQL TEMPORARY dan HTTP untuk query/filter, workbook, ZIP, pratinjau, isi PDF melalui pdftotext, permission, CSRF/Origin dan penghapusan dengan relasi. Fixture tidak mensimulasikan constraint foreign key maupun penulisan bersamaan Laravel. `MASTER_UI_RESOURCES=perpustakaan-nama node scripts/check-master-ui.js` memeriksa desktop/HP, terang/gelap, daftar berisi/kosong, keyboard, kolom tersimpan, sort/filter serta formulir; `MASTER_UI_ACTIONS_ONLY=1` mengulang tambah/edit/impor/konversi melalui browser. `CANDIDATE_UI=1 node --test test/candidate-operational.test.js` memeriksa daftar calon pada 1440/390 px dan meraster PDF. Screenshot: `storage/auth-preview/master-perpustakaan-nama-*`, `candidate-*`, `candidate-form.png`.

Checklist yang sama diperbarui untuk pekerjaan yang terverifikasi. Modul Santri, CBT, ijazah/generator lain, administrasi akun/role, Audit Logs, verifikasi operasional umum dan penerimaan SMTP nyata masih terbuka. Migrasi keseluruhan belum selesai.

Server port 8075 direstart setelah perubahan. Login merespons HTTP 200; Perpustakaan Nama dan cetak formulir tanpa sesi mengarah ke login (303).
