
    // Mendapatkan URL saat ini
    const currentUrlPost = window.location.href;

    // Mendapatkan semua tautan kategori
    const links = document.querySelectorAll('.kategori');

    links.forEach(function(link) {
        // Jika href tautan cocok dengan URL saat ini, tambahkan kelas 'aktif'
        if (link.href === currentUrlPost) {
            link.classList.add('aktif');
        }
    });
