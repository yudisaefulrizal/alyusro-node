const strukturData = {
        mahad: '/struktur/mahad.jpeg',
        kesantrian: '/struktur/kesantrian.jpeg',
        kensantriawatian: '/struktur/kensantriawatian.jpeg',
        humas: '/struktur/humas.jpeg',
        tahfizh: '/struktur/tahfizh.jpeg'
    };

    const gambarElement = document.getElementById('gambarStruktur');
    const headerElement = document.getElementById('headerStruktur');
    const tombols = document.querySelectorAll('.btn-struktur');

    function gantiStruktur(id, title) {
        const gambar = strukturData[id];
        if (gambar) {
            gambarElement.style.opacity = '0';
            setTimeout(() => {
                gambarElement.src = gambar;
                headerElement.textContent = title;
                gambarElement.style.opacity = '1';
            }, 200);
        }
    }

    tombols.forEach(tombol => {
        tombol.addEventListener('click', function() {
            tombols.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            const strukturId = this.getAttribute('data-struktur');
            const title = this.getAttribute('data-title');

            gantiStruktur(strukturId, title);
        });
    });

    function samakanLebarTombol() {
        const buttons = document.querySelectorAll('.btn-struktur');
        let maxWidth = 0;

        buttons.forEach(btn => btn.style.width = 'auto');

        buttons.forEach(btn => {
            const width = btn.offsetWidth;
            if (width > maxWidth) {
                maxWidth = width;
            }
        });

        buttons.forEach(btn => {
            btn.style.width = maxWidth + 'px';
        });
    }

    window.addEventListener('load', samakanLebarTombol);
    window.addEventListener('resize', samakanLebarTombol);
