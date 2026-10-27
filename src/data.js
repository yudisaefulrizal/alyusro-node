export const programs = [
  { slug: 'taud', name: 'TAUD', level: 'Usia dini', text: 'Mengenal program pendidikan anak usia dini di lingkungan Ma’had Al Yusro.' },
  { slug: 'kuttab', name: 'Kuttab', level: 'Setara SD', text: 'Bagian dari rangkaian pendidikan di Ma’had Tahfizh Al Yusro.' },
  { slug: 'madrasah', name: 'Madrasah', level: 'Setara SMP', text: 'Pendidikan dengan perhatian pada tahfizh Al Qur’an, bahasa Arab, dan pembelajaran umum.' },
  { slug: 'darul-ilmi', name: 'Darul ‘Ilmi', level: 'Setara SMA', text: 'Melanjutkan perjalanan menuntut ilmu di lingkungan pesantren.' },
  { slug: 'mahad-aly', name: 'Ma’had ‘Aly', level: 'Setara Diploma', text: 'Jenjang lanjutan dalam rangkaian program pendidikan Ma’had.' },
];
export function validateRegistration(data) {
  const errors = {};
  if (typeof data.name !== 'string' || data.name.trim().length < 3 || data.name.length > 120) errors.name = 'Isi nama lengkap, 3–120 karakter.';
  if (typeof data.phone !== 'string' || !/^(?:\+62|62|0)8\d{7,12}$/.test(data.phone)) errors.phone = 'Gunakan nomor WhatsApp Indonesia, contoh 081234567890.';
  if (!programs.some(p => p.slug === data.program)) errors.program = 'Pilih program pendidikan.';
  if (data.consent !== true) errors.consent = 'Centang persetujuan simulasi.';
  return errors;
}
