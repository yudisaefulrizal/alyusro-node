
        document.getElementById('copy-url-btn').addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(function() {
                alert('URL telah disalin: ' + url);
            }).catch(function(err) {
                alert('Gagal menyalin URL');
            });
        });

        const currentUrlPost = window.location.href;
        const navLinks1 = document.querySelectorAll('.kategori');

        navLinks1.forEach(link => {
            if (link.href === currentUrlPost) {
                link.parentElement.classList.add('tombol_informasi_aktif');
            }
        });
