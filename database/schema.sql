-- Structure only: no users, credentials, sessions or production records.
SET FOREIGN_KEY_CHECKS=0;
CREATE TABLE `artikels` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `judul` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `isi` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `penulis_id` bigint unsigned NOT NULL,
  `kategori_artikel_id` bigint unsigned NOT NULL,
  `status` enum('draft','published','archived') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `views` int unsigned NOT NULL DEFAULT '0',
  `like` int unsigned NOT NULL DEFAULT '0',
  `share` int unsigned NOT NULL DEFAULT '0',
  `komen` int unsigned NOT NULL DEFAULT '0',
  `thumbnail` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `artikels_slug_unique` (`slug`),
  KEY `artikels_penulis_id_foreign` (`penulis_id`),
  KEY `artikels_kategori_artikel_id_foreign` (`kategori_artikel_id`),
  CONSTRAINT `artikels_kategori_artikel_id_foreign` FOREIGN KEY (`kategori_artikel_id`) REFERENCES `kategori_artikels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `artikels_penulis_id_foreign` FOREIGN KEY (`penulis_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `asatidzs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `no_hp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `actor_type` enum('USER','SYSTEM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'USER',
  `action` enum('INSERT','UPDATE','DELETE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `table_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `record_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `new_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `request_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_index` (`user_id`),
  KEY `audit_logs_table_name_record_id_index` (`table_name`,`record_id`),
  KEY `audit_logs_created_at_index` (`created_at`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `audit_logs_chk_1` CHECK (json_valid(`old_data`)),
  CONSTRAINT `audit_logs_chk_2` CHECK (json_valid(`new_data`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` int NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cbt_peserta` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nomor_pendaftaran` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ujian_id` bigint unsigned NOT NULL,
  `status` enum('pending','ongoing','finished') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `started_at` timestamp NULL DEFAULT NULL,
  `finished_at` timestamp NULL DEFAULT NULL,
  `j1` text COLLATE utf8mb4_unicode_ci,
  `j2` text COLLATE utf8mb4_unicode_ci,
  `j3` text COLLATE utf8mb4_unicode_ci,
  `j4` text COLLATE utf8mb4_unicode_ci,
  `j5` text COLLATE utf8mb4_unicode_ci,
  `j6` text COLLATE utf8mb4_unicode_ci,
  `j7` text COLLATE utf8mb4_unicode_ci,
  `j8` text COLLATE utf8mb4_unicode_ci,
  `j9` text COLLATE utf8mb4_unicode_ci,
  `j10` text COLLATE utf8mb4_unicode_ci,
  `j11` text COLLATE utf8mb4_unicode_ci,
  `j12` text COLLATE utf8mb4_unicode_ci,
  `j13` text COLLATE utf8mb4_unicode_ci,
  `j14` text COLLATE utf8mb4_unicode_ci,
  `j15` text COLLATE utf8mb4_unicode_ci,
  `j16` text COLLATE utf8mb4_unicode_ci,
  `j17` text COLLATE utf8mb4_unicode_ci,
  `j18` text COLLATE utf8mb4_unicode_ci,
  `j19` text COLLATE utf8mb4_unicode_ci,
  `j20` text COLLATE utf8mb4_unicode_ci,
  `j21` text COLLATE utf8mb4_unicode_ci,
  `j22` text COLLATE utf8mb4_unicode_ci,
  `j23` text COLLATE utf8mb4_unicode_ci,
  `j24` text COLLATE utf8mb4_unicode_ci,
  `j25` text COLLATE utf8mb4_unicode_ci,
  `j26` text COLLATE utf8mb4_unicode_ci,
  `j27` text COLLATE utf8mb4_unicode_ci,
  `j28` text COLLATE utf8mb4_unicode_ci,
  `j29` text COLLATE utf8mb4_unicode_ci,
  `j30` text COLLATE utf8mb4_unicode_ci,
  `j31` text COLLATE utf8mb4_unicode_ci,
  `j32` text COLLATE utf8mb4_unicode_ci,
  `j33` text COLLATE utf8mb4_unicode_ci,
  `j34` text COLLATE utf8mb4_unicode_ci,
  `j35` text COLLATE utf8mb4_unicode_ci,
  `j36` text COLLATE utf8mb4_unicode_ci,
  `j37` text COLLATE utf8mb4_unicode_ci,
  `j38` text COLLATE utf8mb4_unicode_ci,
  `j39` text COLLATE utf8mb4_unicode_ci,
  `j40` text COLLATE utf8mb4_unicode_ci,
  `j41` text COLLATE utf8mb4_unicode_ci,
  `j42` text COLLATE utf8mb4_unicode_ci,
  `j43` text COLLATE utf8mb4_unicode_ci,
  `j44` text COLLATE utf8mb4_unicode_ci,
  `j45` text COLLATE utf8mb4_unicode_ci,
  `j46` text COLLATE utf8mb4_unicode_ci,
  `j47` text COLLATE utf8mb4_unicode_ci,
  `j48` text COLLATE utf8mb4_unicode_ci,
  `j49` text COLLATE utf8mb4_unicode_ci,
  `j50` text COLLATE utf8mb4_unicode_ci,
  `j51` text COLLATE utf8mb4_unicode_ci,
  `j52` text COLLATE utf8mb4_unicode_ci,
  `j53` text COLLATE utf8mb4_unicode_ci,
  `j54` text COLLATE utf8mb4_unicode_ci,
  `j55` text COLLATE utf8mb4_unicode_ci,
  `j56` text COLLATE utf8mb4_unicode_ci,
  `j57` text COLLATE utf8mb4_unicode_ci,
  `j58` text COLLATE utf8mb4_unicode_ci,
  `j59` text COLLATE utf8mb4_unicode_ci,
  `j60` text COLLATE utf8mb4_unicode_ci,
  `j61` text COLLATE utf8mb4_unicode_ci,
  `j62` text COLLATE utf8mb4_unicode_ci,
  `j63` text COLLATE utf8mb4_unicode_ci,
  `j64` text COLLATE utf8mb4_unicode_ci,
  `j65` text COLLATE utf8mb4_unicode_ci,
  `j66` text COLLATE utf8mb4_unicode_ci,
  `j67` text COLLATE utf8mb4_unicode_ci,
  `j68` text COLLATE utf8mb4_unicode_ci,
  `j69` text COLLATE utf8mb4_unicode_ci,
  `j70` text COLLATE utf8mb4_unicode_ci,
  `j71` text COLLATE utf8mb4_unicode_ci,
  `j72` text COLLATE utf8mb4_unicode_ci,
  `j73` text COLLATE utf8mb4_unicode_ci,
  `j74` text COLLATE utf8mb4_unicode_ci,
  `j75` text COLLATE utf8mb4_unicode_ci,
  `j76` text COLLATE utf8mb4_unicode_ci,
  `j77` text COLLATE utf8mb4_unicode_ci,
  `j78` text COLLATE utf8mb4_unicode_ci,
  `j79` text COLLATE utf8mb4_unicode_ci,
  `j80` text COLLATE utf8mb4_unicode_ci,
  `j81` text COLLATE utf8mb4_unicode_ci,
  `j82` text COLLATE utf8mb4_unicode_ci,
  `j83` text COLLATE utf8mb4_unicode_ci,
  `j84` text COLLATE utf8mb4_unicode_ci,
  `j85` text COLLATE utf8mb4_unicode_ci,
  `j86` text COLLATE utf8mb4_unicode_ci,
  `j87` text COLLATE utf8mb4_unicode_ci,
  `j88` text COLLATE utf8mb4_unicode_ci,
  `j89` text COLLATE utf8mb4_unicode_ci,
  `j90` text COLLATE utf8mb4_unicode_ci,
  `j91` text COLLATE utf8mb4_unicode_ci,
  `j92` text COLLATE utf8mb4_unicode_ci,
  `j93` text COLLATE utf8mb4_unicode_ci,
  `j94` text COLLATE utf8mb4_unicode_ci,
  `j95` text COLLATE utf8mb4_unicode_ci,
  `j96` text COLLATE utf8mb4_unicode_ci,
  `j97` text COLLATE utf8mb4_unicode_ci,
  `j98` text COLLATE utf8mb4_unicode_ci,
  `j99` text COLLATE utf8mb4_unicode_ci,
  `j100` text COLLATE utf8mb4_unicode_ci,
  `j101` text COLLATE utf8mb4_unicode_ci,
  `j102` text COLLATE utf8mb4_unicode_ci,
  `j103` text COLLATE utf8mb4_unicode_ci,
  `j104` text COLLATE utf8mb4_unicode_ci,
  `j105` text COLLATE utf8mb4_unicode_ci,
  `j106` text COLLATE utf8mb4_unicode_ci,
  `j107` text COLLATE utf8mb4_unicode_ci,
  `j108` text COLLATE utf8mb4_unicode_ci,
  `j109` text COLLATE utf8mb4_unicode_ci,
  `j110` text COLLATE utf8mb4_unicode_ci,
  `j111` text COLLATE utf8mb4_unicode_ci,
  `j112` text COLLATE utf8mb4_unicode_ci,
  `j113` text COLLATE utf8mb4_unicode_ci,
  `j114` text COLLATE utf8mb4_unicode_ci,
  `j115` text COLLATE utf8mb4_unicode_ci,
  `j116` text COLLATE utf8mb4_unicode_ci,
  `j117` text COLLATE utf8mb4_unicode_ci,
  `j118` text COLLATE utf8mb4_unicode_ci,
  `j119` text COLLATE utf8mb4_unicode_ci,
  `j120` text COLLATE utf8mb4_unicode_ci,
  `nilai` int unsigned DEFAULT NULL,
  `nilai_essay` int unsigned DEFAULT NULL,
  `nilai_total` int unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cbt_peserta_nomor_pendaftaran_ujian_id_unique` (`nomor_pendaftaran`,`ujian_id`),
  KEY `cbt_peserta_ujian_id_foreign` (`ujian_id`),
  CONSTRAINT `cbt_peserta_ujian_id_foreign` FOREIGN KEY (`ujian_id`) REFERENCES `cbt_ujian` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cbt_soal` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tema_soal_id` bigint unsigned NOT NULL,
  `pertanyaan` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipe_soal` enum('pilihan_ganda','essay','benar_salah') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pilihan_ganda',
  `jawaban_benar` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jawaban_salah_1` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jawaban_salah_2` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jawaban_salah_3` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jawaban_salah_4` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jawaban_salah_5` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jawaban_salah_6` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bobot` int unsigned NOT NULL DEFAULT '1',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint unsigned NOT NULL,
  `verifikasi` enum('pending','verified','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `jumlah_benar` int unsigned NOT NULL DEFAULT '0',
  `jumlah_salah` int unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cbt_soal_tema_soal_id_foreign` (`tema_soal_id`),
  KEY `cbt_soal_created_by_foreign` (`created_by`),
  CONSTRAINT `cbt_soal_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cbt_soal_tema_soal_id_foreign` FOREIGN KEY (`tema_soal_id`) REFERENCES `cbt_tema_soal` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cbt_tema_soal` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_tema` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cbt_tema_soal_nama_tema_unique` (`nama_tema`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cbt_ujian` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_ujian` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `durasi` int unsigned NOT NULL DEFAULT '60',
  `aktif` tinyint(1) NOT NULL DEFAULT '1',
  `privasi` enum('privat','publik','latihan') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'privat',
  `q1` bigint unsigned DEFAULT NULL,
  `q2` bigint unsigned DEFAULT NULL,
  `q3` bigint unsigned DEFAULT NULL,
  `q4` bigint unsigned DEFAULT NULL,
  `q5` bigint unsigned DEFAULT NULL,
  `q6` bigint unsigned DEFAULT NULL,
  `q7` bigint unsigned DEFAULT NULL,
  `q8` bigint unsigned DEFAULT NULL,
  `q9` bigint unsigned DEFAULT NULL,
  `q10` bigint unsigned DEFAULT NULL,
  `q11` bigint unsigned DEFAULT NULL,
  `q12` bigint unsigned DEFAULT NULL,
  `q13` bigint unsigned DEFAULT NULL,
  `q14` bigint unsigned DEFAULT NULL,
  `q15` bigint unsigned DEFAULT NULL,
  `q16` bigint unsigned DEFAULT NULL,
  `q17` bigint unsigned DEFAULT NULL,
  `q18` bigint unsigned DEFAULT NULL,
  `q19` bigint unsigned DEFAULT NULL,
  `q20` bigint unsigned DEFAULT NULL,
  `q21` bigint unsigned DEFAULT NULL,
  `q22` bigint unsigned DEFAULT NULL,
  `q23` bigint unsigned DEFAULT NULL,
  `q24` bigint unsigned DEFAULT NULL,
  `q25` bigint unsigned DEFAULT NULL,
  `q26` bigint unsigned DEFAULT NULL,
  `q27` bigint unsigned DEFAULT NULL,
  `q28` bigint unsigned DEFAULT NULL,
  `q29` bigint unsigned DEFAULT NULL,
  `q30` bigint unsigned DEFAULT NULL,
  `q31` bigint unsigned DEFAULT NULL,
  `q32` bigint unsigned DEFAULT NULL,
  `q33` bigint unsigned DEFAULT NULL,
  `q34` bigint unsigned DEFAULT NULL,
  `q35` bigint unsigned DEFAULT NULL,
  `q36` bigint unsigned DEFAULT NULL,
  `q37` bigint unsigned DEFAULT NULL,
  `q38` bigint unsigned DEFAULT NULL,
  `q39` bigint unsigned DEFAULT NULL,
  `q40` bigint unsigned DEFAULT NULL,
  `q41` bigint unsigned DEFAULT NULL,
  `q42` bigint unsigned DEFAULT NULL,
  `q43` bigint unsigned DEFAULT NULL,
  `q44` bigint unsigned DEFAULT NULL,
  `q45` bigint unsigned DEFAULT NULL,
  `q46` bigint unsigned DEFAULT NULL,
  `q47` bigint unsigned DEFAULT NULL,
  `q48` bigint unsigned DEFAULT NULL,
  `q49` bigint unsigned DEFAULT NULL,
  `q50` bigint unsigned DEFAULT NULL,
  `q51` bigint unsigned DEFAULT NULL,
  `q52` bigint unsigned DEFAULT NULL,
  `q53` bigint unsigned DEFAULT NULL,
  `q54` bigint unsigned DEFAULT NULL,
  `q55` bigint unsigned DEFAULT NULL,
  `q56` bigint unsigned DEFAULT NULL,
  `q57` bigint unsigned DEFAULT NULL,
  `q58` bigint unsigned DEFAULT NULL,
  `q59` bigint unsigned DEFAULT NULL,
  `q60` bigint unsigned DEFAULT NULL,
  `q61` bigint unsigned DEFAULT NULL,
  `q62` bigint unsigned DEFAULT NULL,
  `q63` bigint unsigned DEFAULT NULL,
  `q64` bigint unsigned DEFAULT NULL,
  `q65` bigint unsigned DEFAULT NULL,
  `q66` bigint unsigned DEFAULT NULL,
  `q67` bigint unsigned DEFAULT NULL,
  `q68` bigint unsigned DEFAULT NULL,
  `q69` bigint unsigned DEFAULT NULL,
  `q70` bigint unsigned DEFAULT NULL,
  `q71` bigint unsigned DEFAULT NULL,
  `q72` bigint unsigned DEFAULT NULL,
  `q73` bigint unsigned DEFAULT NULL,
  `q74` bigint unsigned DEFAULT NULL,
  `q75` bigint unsigned DEFAULT NULL,
  `q76` bigint unsigned DEFAULT NULL,
  `q77` bigint unsigned DEFAULT NULL,
  `q78` bigint unsigned DEFAULT NULL,
  `q79` bigint unsigned DEFAULT NULL,
  `q80` bigint unsigned DEFAULT NULL,
  `q81` bigint unsigned DEFAULT NULL,
  `q82` bigint unsigned DEFAULT NULL,
  `q83` bigint unsigned DEFAULT NULL,
  `q84` bigint unsigned DEFAULT NULL,
  `q85` bigint unsigned DEFAULT NULL,
  `q86` bigint unsigned DEFAULT NULL,
  `q87` bigint unsigned DEFAULT NULL,
  `q88` bigint unsigned DEFAULT NULL,
  `q89` bigint unsigned DEFAULT NULL,
  `q90` bigint unsigned DEFAULT NULL,
  `q91` bigint unsigned DEFAULT NULL,
  `q92` bigint unsigned DEFAULT NULL,
  `q93` bigint unsigned DEFAULT NULL,
  `q94` bigint unsigned DEFAULT NULL,
  `q95` bigint unsigned DEFAULT NULL,
  `q96` bigint unsigned DEFAULT NULL,
  `q97` bigint unsigned DEFAULT NULL,
  `q98` bigint unsigned DEFAULT NULL,
  `q99` bigint unsigned DEFAULT NULL,
  `q100` bigint unsigned DEFAULT NULL,
  `q101` bigint unsigned DEFAULT NULL,
  `q102` bigint unsigned DEFAULT NULL,
  `q103` bigint unsigned DEFAULT NULL,
  `q104` bigint unsigned DEFAULT NULL,
  `q105` bigint unsigned DEFAULT NULL,
  `q106` bigint unsigned DEFAULT NULL,
  `q107` bigint unsigned DEFAULT NULL,
  `q108` bigint unsigned DEFAULT NULL,
  `q109` bigint unsigned DEFAULT NULL,
  `q110` bigint unsigned DEFAULT NULL,
  `q111` bigint unsigned DEFAULT NULL,
  `q112` bigint unsigned DEFAULT NULL,
  `q113` bigint unsigned DEFAULT NULL,
  `q114` bigint unsigned DEFAULT NULL,
  `q115` bigint unsigned DEFAULT NULL,
  `q116` bigint unsigned DEFAULT NULL,
  `q117` bigint unsigned DEFAULT NULL,
  `q118` bigint unsigned DEFAULT NULL,
  `q119` bigint unsigned DEFAULT NULL,
  `q120` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `dokumens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_preview_public` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link_download` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `event_mahads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal` int NOT NULL,
  `bulan` int NOT NULL,
  `tahun` int NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `failed_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `queue` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `exception` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fasilitas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kategori_fasilitas_id` bigint unsigned NOT NULL,
  `nama_fasilitas` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deskripsi` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `gambar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('aktif','non-aktif') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fasilitas_slug_unique` (`slug`),
  KEY `fasilitas_kategori_fasilitas_id_foreign` (`kategori_fasilitas_id`),
  CONSTRAINT `fasilitas_kategori_fasilitas_id_foreign` FOREIGN KEY (`kategori_fasilitas_id`) REFERENCES `kategori_fasilitas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `flayers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `foto_santris` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `santri_id` bigint unsigned NOT NULL,
  `path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `foto_santris_santri_id_foreign` (`santri_id`),
  CONSTRAINT `foto_santris_santri_id_foreign` FOREIGN KEY (`santri_id`) REFERENCES `santris` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `galeri_fasilitas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `fasilitas_id` bigint unsigned NOT NULL,
  `gambar` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deskripsi_gambar` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `galeri_fasilitas_fasilitas_id_foreign` (`fasilitas_id`),
  CONSTRAINT `galeri_fasilitas_fasilitas_id_foreign` FOREIGN KEY (`fasilitas_id`) REFERENCES `fasilitas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `hafalans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ijazah_darul_ilmis` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `santri_id` bigint unsigned NOT NULL,
  `event_id` bigint unsigned NOT NULL,
  `alquran` double NOT NULL,
  `hadits` double NOT NULL,
  `tauhid` double NOT NULL,
  `tafsir` double NOT NULL,
  `fiqih` double NOT NULL,
  `b_arab` double NOT NULL,
  `nahwu` double NOT NULL,
  `imla_kitabah` double NOT NULL,
  `tajwid` double NOT NULL,
  `tarikh` double NOT NULL,
  `adab_araby` double NOT NULL,
  `mushtalah_hadits` double NOT NULL,
  `ushul_fiqih` double NOT NULL,
  `khot` double NOT NULL,
  `manhaj` double NOT NULL,
  `faraidh` double NOT NULL,
  `qawaidh_fiqhiyah` double NOT NULL,
  `balaghah` double NOT NULL,
  `temp_rata_rata` decimal(5,2) DEFAULT NULL,
  `temp_predikat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomor_ijazah` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gambar_qr` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verifikasi_kepala_sekolah` tinyint(1) NOT NULL DEFAULT '0',
  `verifikasi_mudir` tinyint(1) NOT NULL DEFAULT '0',
  `catatan_mudir` text COLLATE utf8mb4_unicode_ci,
  `catatan_kepsek` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ijazah_darul_ilmis_nomor_ijazah_unique` (`nomor_ijazah`),
  KEY `ijazah_darul_ilmis_santri_id_foreign` (`santri_id`),
  KEY `ijazah_darul_ilmis_event_id_foreign` (`event_id`),
  CONSTRAINT `ijazah_darul_ilmis_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `event_mahads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ijazah_darul_ilmis_santri_id_foreign` FOREIGN KEY (`santri_id`) REFERENCES `santris` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ijazah_mahad_alies` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `santri_id` bigint unsigned NOT NULL,
  `event_id` bigint unsigned NOT NULL,
  `tahsin_1` double NOT NULL,
  `tahsin_2` double NOT NULL,
  `tahsin_3` double NOT NULL,
  `tahsin_4` double NOT NULL,
  `Tajwid` double NOT NULL,
  `tahfizh_1` double NOT NULL,
  `tahfizh_2` double NOT NULL,
  `Tauhid_1` double NOT NULL,
  `Tauhid_2` double NOT NULL,
  `Tauhid_3` double NOT NULL,
  `Tauhid_4` double NOT NULL,
  `bahasa_arab_dasar` double NOT NULL,
  `bahsa_arab_lanjutan` double NOT NULL,
  `tafsir_1` double NOT NULL,
  `tafsir_2` double NOT NULL,
  `tafsir_3` double NOT NULL,
  `hadits_ahkam_1` double NOT NULL,
  `hadits_ahkam_2` double NOT NULL,
  `hadits_ahkam_3` double NOT NULL,
  `fikih_1` double NOT NULL,
  `fikih_2` double NOT NULL,
  `fikih_3` double NOT NULL,
  `nahu_sorf_1` double NOT NULL,
  `nahu_sorf_2` double NOT NULL,
  `nahu_sorf_3` double NOT NULL,
  `mustholahul_hadits_1` double NOT NULL,
  `mustholahul_hadits_2` double NOT NULL,
  `ushulul_fiqh_1` double NOT NULL,
  `ushulul_fiqh_2` double NOT NULL,
  `sastra_arab_1` double NOT NULL,
  `sastra_arab_2` double NOT NULL,
  `ulumul_quran` double NOT NULL,
  `qowaid_fiqhiyah` double NOT NULL,
  `balagoh` double NOT NULL,
  `akhlak` double NOT NULL,
  `manhaj` double NOT NULL,
  `metodologi_penelitian` double NOT NULL,
  `karya_ilmiyah` double NOT NULL,
  `praktek_microteaching` double NOT NULL,
  `judul_karya_ilmiyah_latin` text COLLATE utf8mb4_unicode_ci,
  `judul_karya_ilmiyah_arab` text COLLATE utf8mb4_unicode_ci,
  `nomor_ijazah` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gambar_qr` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `temp_ipk` double DEFAULT NULL,
  `temp_predikat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verifikasi_kepala_sekolah` tinyint(1) NOT NULL DEFAULT '0',
  `verifikasi_mudir` tinyint(1) NOT NULL DEFAULT '0',
  `catatan_mudir` text COLLATE utf8mb4_unicode_ci,
  `catatan_kepsek` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ijazah_mahad_alies_nomor_ijazah_unique` (`nomor_ijazah`),
  KEY `ijazah_mahad_alies_santri_id_foreign` (`santri_id`),
  KEY `ijazah_mahad_alies_event_id_foreign` (`event_id`),
  CONSTRAINT `ijazah_mahad_alies_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `event_mahads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ijazah_mahad_alies_santri_id_foreign` FOREIGN KEY (`santri_id`) REFERENCES `santris` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ijazahs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `santri_id` bigint unsigned NOT NULL,
  `event_id` bigint unsigned NOT NULL,
  `nilai_quran` double NOT NULL,
  `nilai_bahasa_arab` double NOT NULL,
  `nilai_tajwid` double NOT NULL,
  `nilai_khot` double NOT NULL,
  `nilai_tauhid` double NOT NULL,
  `nilai_hadist` double NOT NULL,
  `nilai_fiqih` double NOT NULL,
  `nilai_tafsir` double NOT NULL,
  `nilai_nahwu` double NOT NULL,
  `temp_rata_rata` double DEFAULT NULL,
  `temp_predikat` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomor_ijazah` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gambar_qr` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verifikasi_kepala_sekolah` tinyint(1) NOT NULL DEFAULT '0',
  `verifikasi_mudir` tinyint(1) NOT NULL DEFAULT '0',
  `catatan_mudir` text COLLATE utf8mb4_unicode_ci,
  `catatan_kepsek` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ijazahs_nomor_ijazah_unique` (`nomor_ijazah`),
  KEY `ijazahs_santri_id_foreign` (`santri_id`),
  KEY `ijazahs_event_id_foreign` (`event_id`),
  CONSTRAINT `ijazahs_event_id_foreign` FOREIGN KEY (`event_id`) REFERENCES `event_mahads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ijazahs_santri_id_foreign` FOREIGN KEY (`santri_id`) REFERENCES `santris` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jadwal_gurus` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jadwal_imams` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `job_batches` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_jobs` int NOT NULL,
  `pending_jobs` int NOT NULL,
  `failed_jobs` int NOT NULL,
  `failed_job_ids` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `options` mediumtext COLLATE utf8mb4_unicode_ci,
  `cancelled_at` int DEFAULT NULL,
  `created_at` int NOT NULL,
  `finished_at` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` tinyint unsigned NOT NULL,
  `reserved_at` int unsigned DEFAULT NULL,
  `available_at` int unsigned NOT NULL,
  `created_at` int unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `juzs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `juz` tinyint unsigned NOT NULL,
  `halaman_awal` smallint unsigned NOT NULL,
  `halaman_akhir` smallint unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `juzs_juz_unique` (`juz`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kalender_akademiks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tanggal` date NOT NULL,
  `tanggal_selesai` date DEFAULT NULL,
  `kegiatan` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `warna` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `waktu_mulai` time DEFAULT NULL,
  `waktu_selesai` time DEFAULT NULL,
  `lokasi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keterangan` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'akan_datang',
  `tipe_kegiatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `link_terkait` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `catatan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kas_santris` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kategori_artikels` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('aktif','tidak aktif') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kategori_artikels_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kategori_fasilitas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_kategori` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deskripsi_kategori` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kategori_fasilitas_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kehadiran_asatidzs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kehadiran_santris` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kelas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_program_pendidikan` bigint unsigned NOT NULL,
  `nama_kelas` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keterangan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `kelas_id_program_pendidikan_foreign` (`id_program_pendidikan`),
  CONSTRAINT `kelas_id_program_pendidikan_foreign` FOREIGN KEY (`id_program_pendidikan`) REFERENCES `program_pendidikans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `kurikulum_tahfizhs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `deskripsi` text COLLATE utf8mb4_unicode_ci,
  `kegiatan` text COLLATE utf8mb4_unicode_ci,
  `kriteria_muhaffizh` text COLLATE utf8mb4_unicode_ci,
  `target_hafalan` text COLLATE utf8mb4_unicode_ci,
  `metode_tahfizh` text COLLATE utf8mb4_unicode_ci,
  `ujian_tahfizh` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `landing_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mata_pelajarans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `kelas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `menus` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `route` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `views` int DEFAULT '0',
  `waktu` int DEFAULT '0',
  `status` enum('aktif','tidak','ditinjau') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'aktif',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `model_has_permissions` (
  `permission_id` bigint unsigned NOT NULL,
  `model_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `model_has_roles` (
  `role_id` bigint unsigned NOT NULL,
  `model_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nama_kota` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_latin` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_arab` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `node_auth_limits` (
  `key` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int unsigned NOT NULL,
  `expires_at` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `node_auth_resets` (
  `user_id` bigint unsigned NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token_hash` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`user_id`),
  KEY `email` (`email`),
  KEY `created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `node_auth_sessions` (
  `id` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `csrf` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` bigint NOT NULL,
  `last_activity` bigint NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` varchar(512) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `node_cbt_attempts` (
  `peserta_id` bigint unsigned NOT NULL,
  `attempt_key` char(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `snapshot` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `answers` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `deadline` bigint NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`peserta_id`),
  CONSTRAINT `node_cbt_attempts_chk_1` CHECK (json_valid(`snapshot`)),
  CONSTRAINT `node_cbt_attempts_chk_2` CHECK (json_valid(`answers`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pelanggarans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `penanganan_sakits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pendaftarans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nisn` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bukti_pembayaran` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `penerimaan_santris` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `program_pendidikan_id` bigint unsigned NOT NULL,
  `tahun` varchar(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gelombang` tinyint unsigned NOT NULL,
  `kode_gelombang` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal_mulai` date NOT NULL,
  `tanggal_selesai` date NOT NULL,
  `tanggal_tes` date NOT NULL,
  `biaya_pendaftaran` bigint unsigned NOT NULL,
  `kuota` int unsigned DEFAULT NULL,
  `status` enum('aktif','nonaktif') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'nonaktif',
  `catatan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `penerimaan_santris_kode_gelombang_unique` (`kode_gelombang`),
  KEY `penerimaan_santris_program_pendidikan_id_foreign` (`program_pendidikan_id`),
  CONSTRAINT `penerimaan_santris_program_pendidikan_id_foreign` FOREIGN KEY (`program_pendidikan_id`) REFERENCES `program_pendidikans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `permissions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guard_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `perpustakaan_namas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_latin` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_arab` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prestasis` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `peringkat` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_lomba` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tingkat` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `penyelenggara` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tahun` int NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `program_pendidikans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nama_program` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deskripsi` longtext COLLATE utf8mb4_unicode_ci,
  `list_target` longtext COLLATE utf8mb4_unicode_ci,
  `target_hafalan` longtext COLLATE utf8mb4_unicode_ci,
  `link_pendaftaran` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biaya_pendaftaran` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biaya_daftar_ulang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biaya_tahunan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biaya_spp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deskripsi_biaya` longtext COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `referral_sources` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referral_sources_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `role_has_permissions` (
  `permission_id` bigint unsigned NOT NULL,
  `role_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `guard_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sabaq` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `santri_id` bigint unsigned NOT NULL,
  `index_quran_id` bigint unsigned NOT NULL,
  `tanggal` date NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nilai` int DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `catatan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sabaq_santri_id_foreign` (`santri_id`),
  KEY `sabaq_index_quran_id_foreign` (`index_quran_id`),
  KEY `sabaq_user_id_foreign` (`user_id`),
  CONSTRAINT `sabaq_index_quran_id_foreign` FOREIGN KEY (`index_quran_id`) REFERENCES `tabel_index_quran` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sabaq_santri_id_foreign` FOREIGN KEY (`santri_id`) REFERENCES `santris` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sabaq_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `santris` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `referral_source_id` bigint unsigned DEFAULT NULL,
  `npsn` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_surat_komitment_madrasah` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_surat_komitment_darul_ilmi` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_surat_komitment_mahad_aly` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama_arab` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jenis_kelamin` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nis` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pengampu_tahfizh_id` bigint unsigned DEFAULT NULL,
  `nis_taud` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nis_kuttab` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nis_madrasah` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nis_darul_ilmi` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nis_mahad_aly` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tempat_lahir` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tanggal_lahir` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bulan_lahir` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tahun_lahir` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `jenjang` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agama` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `alamat` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `anak_ke` int DEFAULT NULL,
  `asal_sekolah` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `berat_badan` int DEFAULT NULL,
  `berkebutuhan_khusus` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `berkebutuhan_khusus_ayah` tinyint(1) DEFAULT NULL,
  `berkebutuhan_khusus_ibu` tinyint(1) DEFAULT NULL,
  `catatan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hobi` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jarak_ke_sekolah` decimal(8,2) DEFAULT NULL,
  `jalur` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `jumlah_nilai` int DEFAULT NULL,
  `jumlah_saudara_kandung` int DEFAULT NULL,
  `kecamatan` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kewarganegaraan` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `kode_pos` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `longitude` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `moda_transportasi` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_ayah` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_dusun` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_kelurahan` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_peserta` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_ibu` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_tertera_di_kip` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nama_wali` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nisn` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik_ayah` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik_ibu` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nik_wali` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_kk` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_kks` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_kip` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_kps_pkh` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_pendaftaran` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_registrasi_akta_lahir` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_seri_ijazah` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_seri_skhu` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_un` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `no_telepon_rumah` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nomor_hp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pendidikan_ayah` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pendidikan_ibu` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pendidikan_wali` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `penerima_kip` tinyint(1) DEFAULT NULL,
  `penerima_kps_pkh` tinyint(1) DEFAULT NULL,
  `pekerjaan_ayah` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pekerjaan_ibu` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pekerjaan_wali` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `penghasilan_bulanan_ayah` int DEFAULT NULL,
  `penghasilan_bulanan_ibu` int DEFAULT NULL,
  `penghasilan_bulanan_wali` int DEFAULT NULL,
  `poin_jarak` int DEFAULT NULL,
  `poin_prestasi` int DEFAULT NULL,
  `rt` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rw` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '-',
  `status_daftar_ulang` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_hasil` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tanggal_daftar` int DEFAULT NULL,
  `tempat_tinggal` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `terima_fisik_kartu_kip` tinyint(1) DEFAULT NULL,
  `tinggi_badan` int DEFAULT NULL,
  `usia` int DEFAULT NULL,
  `tahun` int DEFAULT NULL,
  `tahun_lahir_ayah` int DEFAULT NULL,
  `tahun_lahir_ibu` int DEFAULT NULL,
  `tahun_lahir_wali` int DEFAULT NULL,
  `foto_ijazah_sd` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_ijazah_smp` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_ijazah_sma` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_akta_lahir` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_kartu_keluarga` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `berkas_kelulusan_taud` text COLLATE utf8mb4_unicode_ci,
  `berkas_kelulusan_kuttab` text COLLATE utf8mb4_unicode_ci,
  `berkas_kelulusan_madrasah` text COLLATE utf8mb4_unicode_ci,
  `berkas_kelulusan_darul_ilmi` text COLLATE utf8mb4_unicode_ci,
  `berkas_kelulusan_mahad_aly` text COLLATE utf8mb4_unicode_ci,
  `berkas_kelulusan` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status_berkas` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `kelas_id` bigint unsigned DEFAULT NULL,
  `penerimaan_santri_id` bigint unsigned DEFAULT NULL,
  `nomor_pendaftaran` char(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_tk_taud` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_kuttab` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_madrasah` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_darul_ilmi` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_mahad_aly` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `foto_pembayaran_psb_mahdon_tarbawi` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `santris_nomor_pendaftaran_unique` (`nomor_pendaftaran`),
  KEY `santris_user_id_foreign` (`user_id`),
  KEY `santris_kelas_id_foreign` (`kelas_id`),
  KEY `santris_pengampu_tahfizh_id_foreign` (`pengampu_tahfizh_id`),
  KEY `santris_penerimaan_santri_id_foreign` (`penerimaan_santri_id`),
  KEY `santris_referral_source_id_foreign` (`referral_source_id`),
  CONSTRAINT `santris_kelas_id_foreign` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `santris_penerimaan_santri_id_foreign` FOREIGN KEY (`penerimaan_santri_id`) REFERENCES `penerimaan_santris` (`id`) ON DELETE CASCADE,
  CONSTRAINT `santris_pengampu_tahfizh_id_foreign` FOREIGN KEY (`pengampu_tahfizh_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `santris_referral_source_id_foreign` FOREIGN KEY (`referral_source_id`) REFERENCES `referral_sources` (`id`) ON DELETE SET NULL,
  CONSTRAINT `santris_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `payload` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_activity` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `short_links` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `original_url` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `short_code` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `clicks` bigint unsigned NOT NULL DEFAULT '0',
  `creator_ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creator_user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `short_links_short_code_unique` (`short_code`),
  KEY `short_links_short_code_index` (`short_code`),
  KEY `short_links_creator_ip_index` (`creator_ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `status_catatan` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pesan_whatsapp` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `label_tombol` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomor_wa` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `catatan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `status_catatan_status_unique` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `struktur_mahads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `struktur` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nama` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `level` int NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `subkelas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_kelas` bigint unsigned NOT NULL,
  `nama_subkelas` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keterangan` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `subkelas_id_kelas_foreign` (`id_kelas`),
  CONSTRAINT `subkelas_id_kelas_foreign` FOREIGN KEY (`id_kelas`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tabel_index_quran` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `halaman_ke` int NOT NULL,
  `juz_awal` int NOT NULL,
  `juz_akhir` int DEFAULT NULL,
  `surat_awal` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `surat_akhir` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tahfizhs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tasmis` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `uang_jajans` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nomor_kk` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `custom_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  `avatar_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_nomor_kk_unique` (`nomor_kk`),
  CONSTRAINT `users_chk_1` CHECK (json_valid(`custom_fields`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
