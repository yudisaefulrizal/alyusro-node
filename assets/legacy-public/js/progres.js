  // Ambil elemen tombol dan progress bar
  const btnSimpan = document.getElementById('btn-simpan-upload');
  const progresBar = document.getElementById('progres-bar-upload');

  btnSimpan.addEventListener('click', function (e) {
    e.preventDefault(); // jika tidak ingin submit form langsung

    // Ganti class
    progresBar.classList.remove('progres-bar-upload');
    progresBar.classList.add('progres-bar-upload-aktiv');
  });

