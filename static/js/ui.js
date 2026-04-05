/* ================================
   s.chat — UI Module
   static/js/ui.js
   ================================ */

const UI = (() => {
  const $ = id => document.getElementById(id);

  function setLoggedIn(user) {
    $('navActions').classList.add('hidden');
    $('navUser').classList.remove('hidden');
    $('navAvatar').textContent   = user.name.charAt(0).toUpperCase();
    $('navUsername').textContent = user.name.split(' ')[0];
    $('landingPage').style.display   = 'none';
    $('dashboardPage').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    Dashboard.init(user);
  }

  function setLoggedOut() {
    $('navActions').classList.remove('hidden');
    $('navUser').classList.add('hidden');
    $('landingPage').style.display   = 'block';
    $('dashboardPage').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initFaq() {
    document.querySelectorAll('.faq-item__q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item   = btn.closest('.faq-item');
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    });
  }

  function init() {
    $('modalOverlay').addEventListener('click', e => {
      if (e.target === $('modalOverlay')) Auth.closeModal();
    });
    $('chatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Chat.send(); }
    });
    $('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') Auth.doLogin(); });
    $('regPass').addEventListener('keydown',   e => { if (e.key === 'Enter') Auth.doRegister(); });
    initFaq();
    Auth.checkSession();
  }

  return { setLoggedIn, setLoggedOut, init };
})();
