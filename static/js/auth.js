/* ================================
   s.chat — Auth Module
   static/js/auth.js
   ================================ */

const Auth = (() => {
  const $ = id => document.getElementById(id);

  function showErr(id, msg) {
    const el = $(id);
    if (msg) el.textContent = msg;
    el.classList.add('visible');
  }
  function hideErr(id) { $(id).classList.remove('visible'); }
  function clearErrs(...ids) { ids.forEach(hideErr); }

  function openLogin() {
    $('loginSuccess').classList.remove('visible');
    clearErrs('loginError');
    $('loginEmail').value = $('loginPass').value = '';
    $('loginForm').style.display    = 'block';
    $('registerForm').style.display = 'none';
    $('modalOverlay').classList.add('active');
    setTimeout(() => $('loginEmail').focus(), 100);
  }

  function openRegister() {
    clearErrs('regNameErr', 'regEmailErr', 'regPassErr');
    $('regName').value = $('regEmail').value = $('regPass').value = '';
    $('loginForm').style.display    = 'none';
    $('registerForm').style.display = 'block';
    $('modalOverlay').classList.add('active');
    setTimeout(() => $('regName').focus(), 100);
  }

  function closeModal() { $('modalOverlay').classList.remove('active'); }
  function showLoginView()    { $('loginForm').style.display='block';  $('registerForm').style.display='none'; }
  function showRegisterView() { $('loginForm').style.display='none';   $('registerForm').style.display='block'; }

  async function doRegister() {
    const name  = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const pass  = $('regPass').value;

    clearErrs('regNameErr', 'regEmailErr', 'regPassErr');
    let ok = true;
    if (!name)                          { showErr('regNameErr', 'El nombre es obligatorio'); ok = false; }
    if (!email || !email.includes('@')) { showErr('regEmailErr', 'Introduce un email válido'); ok = false; }
    if (pass.length < 6)                { showErr('regPassErr', 'Mínimo 6 caracteres'); ok = false; }
    if (!ok) return;

    const btn = $('btnRegister');
    btn.disabled = true; btn.textContent = 'Creando cuenta...';

    try {
      const res  = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password: pass })
      });
      const data = await res.json();
      if (data.ok) {
        showLoginView();
        $('loginSuccess').classList.add('visible');
        $('loginEmail').value = email;
        $('loginPass').focus();
      } else {
        showErr('regEmailErr', data.error);
      }
    } catch { showErr('regEmailErr', 'Error de conexión.'); }
    finally  { btn.disabled = false; btn.textContent = 'Crear cuenta gratis'; }
  }

  async function doLogin() {
    const email = $('loginEmail').value.trim();
    const pass  = $('loginPass').value;
    clearErrs('loginError');
    if (!email || !pass) { showErr('loginError', 'Rellena todos los campos'); return; }

    const btn = $('btnLogin');
    btn.disabled = true; btn.textContent = 'Entrando...';

    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (data.ok) { closeModal(); UI.setLoggedIn({ name: data.name, email: data.email }); }
      else          { showErr('loginError', data.error); }
    } catch { showErr('loginError', 'Error de conexión.'); }
    finally  { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
  }

  async function doLogout() {
    await fetch('/api/logout', { method: 'POST' });
    UI.setLoggedOut();
  }

  async function checkSession() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) UI.setLoggedIn({ name: data.name, email: data.email });
      }
    } catch { /* no session */ }
  }

  return { openLogin, openRegister, closeModal, showLoginView, showRegisterView, doRegister, doLogin, doLogout, checkSession };
})();
