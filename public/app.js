const toggle = document.querySelector('.menu-toggle');
toggle?.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); document.querySelector('nav').classList.toggle('open', open); });
const form = document.querySelector('#registration');
if (form) {
  const selected = new URLSearchParams(location.search).get('program');
  if ([...form.elements.program.options].some(p => p.value === selected)) form.elements.program.value = selected;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button'); const result = document.querySelector('#form-result');
    result.textContent = ''; result.className = '';
    form.querySelectorAll('.error').forEach(e => e.textContent = '');
    form.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
    button.disabled = true; button.textContent = 'Memeriksa isian…';
    try {
      const response = await fetch('/api/pendaftaran', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.elements.name.value.trim(), phone: form.elements.phone.value.replace(/[\s()-]/g, ''), program: form.elements.program.value, consent: form.elements.consent.checked }) });
      const body = await response.json();
      if (body.errors) {
        for (const [key, message] of Object.entries(body.errors)) { document.getElementById(`${key}-error`).textContent = message; form.elements[key].setAttribute('aria-invalid', 'true'); }
        form.querySelector('[aria-invalid]')?.focus();
      } else { result.className = response.ok ? 'success' : 'notice'; result.textContent = body.message; result.focus(); }
    } catch { result.textContent = 'Tidak dapat menghubungi server. Silakan coba lagi.'; result.className = 'notice'; }
    finally { button.disabled = false; button.textContent = 'Uji formulir pendaftaran ↗'; }
  });
}
