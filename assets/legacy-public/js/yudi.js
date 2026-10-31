
function toggleZoom(imgElement) {
        imgElement.classList.toggle('zoomed');
    }

function handleImageClick(imgElement, santriId) {
    const isUploaded = imgElement.src.includes('storage'); // Jika sudah ada gambar
    if (!isUploaded) {
        document.getElementById(`fileInput-${santriId}`).click();
    } else {
        toggleZoom(imgElement);
    }
}

function uploadImage(input, santriId) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('foto', file);
    formData.append('_token', document.querySelector('meta[name="csrf-token"]').content);

    fetch(`/upload-berkas/${santriId}`, {
        method: 'POST',
        body: formData,
    })
    .then(res => res.json())
    .then(res => {
        if (res.success) {
            const img = input.previousElementSibling;
            img.src = res.image_url + '?t=' + new Date().getTime(); // prevent cache
        } else {
            alert('Upload gagal');
        }
    })
    .catch(err => {
        console.error(err);
        alert('Terjadi kesalahan saat upload');
    });
}




function bukaModalFotoUpload(title, routeUrl) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('uploadForm').action = routeUrl;
    document.getElementById('modalUploadFoto').classList.remove('hidden');
    document.getElementById('modalUploadFoto').classList.add('flex');
}

function tutupModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

function previewFoto(input) {
    const file = input.files[0];
    const preview = document.getElementById('previewImage');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    } else {
        preview.src = '#';
        preview.classList.add('hidden');
    }
}





// realtime
