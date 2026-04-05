/* ================================
   s.chat — Dashboard JS
   static/js/dashboard.js
   ================================ */

const Dashboard = (() => {
  const $ = id => document.getElementById(id);

  /* ── Navegación ── */
  function showView(name) {
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.dash-nav__item').forEach(i => i.classList.remove('active'));
    const view = $('view-' + name);
    const nav  = $('nav-' + name);
    if (view) view.classList.add('active');
    if (nav)  nav.classList.add('active');

    if (name === 'overview')       loadOverview();
    if (name === 'conversations')  loadConversations();
    if (name === 'channels')       loadChannels();
  }

  /* ── Overview / Stats ── */
  async function loadOverview() {
    try {
      const res  = await fetch('/api/stats');
      const data = await res.json();
      if (!data.ok) return;

      $('stat-today').textContent   = data.total_today;
      $('stat-week').textContent    = data.total_week;
      $('stat-open').textContent    = data.open;
      $('stat-msgs').textContent    = data.total_msgs;

      // Conversaciones recientes
      const list = $('recent-convs');
      if (!list) return;
      if (data.recent.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state__icon">💬</div><h3>Sin conversaciones aún</h3><p>Las conversaciones del chatbot aparecerán aquí.</p></div>';
        return;
      }
      list.innerHTML = data.recent.map(c => `
        <div class="conv-item" onclick="Dashboard.openConversation(${c.id})">
          <div>
            <div class="conv-item__name">${c.visitor}</div>
            <div class="conv-item__time">${formatDate(c.updated)}</div>
          </div>
          <div class="conv-item__meta">
            ${c.channel_name ? `<span class="conv-item__channel">${c.channel_name}</span>` : ''}
            <span class="badge badge--${c.status === 'open' ? 'open' : 'closed'}">${c.status === 'open' ? 'Abierta' : 'Resuelta'}</span>
          </div>
        </div>
      `).join('');

      // Por canal
      const byChannel = $('by-channel');
      if (!byChannel) return;
      if (data.by_channel.length === 0) {
        byChannel.innerHTML = '<p style="font-size:13px;color:var(--gray-400)">Sin datos aún</p>';
        return;
      }
      const max = data.by_channel[0].total;
      byChannel.innerHTML = data.by_channel.map(c => `
        <div class="channel-bar">
          <div class="channel-bar__top"><span>${c.name}</span><span class="channel-bar__pct">${c.total}</span></div>
          <div class="channel-bar__track"><div class="channel-bar__fill" style="width:${Math.round(c.total/max*100)}%"></div></div>
        </div>
      `).join('');

    } catch(e) { console.error(e); }
  }

  /* ── Conversaciones ── */
  async function loadConversations() {
    const body = $('conv-table-body');
    if (!body) return;
    body.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-400);font-size:14px">Cargando...</div>';

    try {
      const res  = await fetch('/api/conversations');
      const data = await res.json();
      if (!data.ok) return;

      if (data.conversations.length === 0) {
        body.innerHTML = '<div class="empty-state"><div class="empty-state__icon">💬</div><h3>Sin conversaciones aún</h3><p>Las conversaciones del chatbot aparecerán aquí.</p></div>';
        return;
      }

      body.innerHTML = data.conversations.map(c => `
        <div class="conv-table-row" onclick="Dashboard.openConversation(${c.id})">
          <div class="visitor">${c.visitor}</div>
          <div class="channel">${c.channel_name || 'Web'}</div>
          <div class="time">${formatDate(c.updated)}</div>
          <div>${c.msg_count} mensajes</div>
          <div><span class="badge badge--${c.status === 'open' ? 'open' : 'closed'}">${c.status === 'open' ? 'Abierta' : 'Resuelta'}</span></div>
        </div>
      `).join('');
    } catch(e) { console.error(e); }
  }

  /* ── Detalle conversación ── */
  async function openConversation(id) {
    $('conv-detail-overlay').classList.add('active');
    $('conv-detail-msgs').innerHTML = '<div style="text-align:center;color:var(--gray-400);font-size:14px;padding:2rem">Cargando...</div>';
    $('conv-detail-id').dataset.id = id;

    try {
      const res  = await fetch(`/api/conversations/${id}/messages`);
      const data = await res.json();
      if (!data.ok) return;

      if (data.messages.length === 0) {
        $('conv-detail-msgs').innerHTML = '<div style="text-align:center;color:var(--gray-400);font-size:14px;padding:2rem">Sin mensajes</div>';
        return;
      }

      $('conv-detail-msgs').innerHTML = data.messages.map(m => `
        <div class="msg ${m.role === 'user' ? 'msg--user' : ''}">
          <div class="msg__av">${m.role === 'user' ? 'U' : 's.c'}</div>
          <div class="msg__bubble">${m.content}</div>
        </div>
      `).join('');

      const el = $('conv-detail-msgs');
      el.scrollTop = el.scrollHeight;
    } catch(e) { console.error(e); }
  }

  async function closeConversation() {
    const id = $('conv-detail-id').dataset.id;
    if (!id) return;
    await fetch(`/api/conversations/${id}/close`, { method: 'PUT' });
    $('conv-detail-overlay').classList.remove('active');
    loadConversations();
    loadOverview();
  }

  /* ── Canales ── */
  async function loadChannels() {
    const list = $('channels-list');
    if (!list) return;
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--gray-400);font-size:14px">Cargando...</div>';

    try {
      const res  = await fetch('/api/channels');
      const data = await res.json();
      if (!data.ok) return;

      if (data.channels.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state__icon">📡</div>
            <h3>Sin canales configurados</h3>
            <p>Añade tu primer canal para empezar a recibir conversaciones.</p>
          </div>`;
        return;
      }

      const colors = { web: '#111', whatsapp: '#25D366', telegram: '#0088cc', slack: '#4A154B', teams: '#0078D4', messenger: '#00B2FF', gmail: '#EA4335', api: '#6ab04c' };

      list.innerHTML = data.channels.map(ch => `
        <div class="channel-item" id="ch-${ch.id}">
          <div class="channel-item__left">
            <span class="channel-item__dot" style="background:${colors[ch.type] || '#888'}"></span>
            <div>
              <div class="channel-item__name">${ch.name}</div>
              <div class="channel-item__type">${ch.type}</div>
            </div>
          </div>
          <div class="channel-item__right">
            <button class="toggle ${ch.active ? 'on' : ''}" onclick="Dashboard.toggleChannel(${ch.id}, this)" title="${ch.active ? 'Desactivar' : 'Activar'}"></button>
            <button class="btn-icon" onclick="Dashboard.deleteChannel(${ch.id})" title="Eliminar">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      `).join('');
    } catch(e) { console.error(e); }
  }

  async function toggleChannel(id, btn) {
    const res  = await fetch(`/api/channels/${id}/toggle`, { method: 'PUT' });
    const data = await res.json();
    if (data.ok) btn.classList.toggle('on', data.active === 1);
  }

  async function deleteChannel(id) {
    if (!confirm('¿Eliminar este canal?')) return;
    await fetch(`/api/channels/${id}`, { method: 'DELETE' });
    loadChannels();
  }

  /* ── Modal nuevo canal ── */
  let selectedType = '';

  function openChannelModal() {
    selectedType = '';
    $('channelName').value = '';
    document.querySelectorAll('.channel-type-btn').forEach(b => b.classList.remove('selected'));
    $('channelModalOverlay').classList.add('active');
  }

  function closeChannelModal() {
    $('channelModalOverlay').classList.remove('active');
  }

  function selectChannelType(type, btn) {
    selectedType = type;
    document.querySelectorAll('.channel-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    $('channelName').value = type.charAt(0).toUpperCase() + type.slice(1);
  }

  async function saveChannel() {
    const name = $('channelName').value.trim();
    if (!name || !selectedType) {
      alert('Selecciona un tipo y escribe un nombre');
      return;
    }
    const res  = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: selectedType })
    });
    const data = await res.json();
    if (data.ok) { closeChannelModal(); loadChannels(); }
  }

  /* ── Perfil ── */
  async function saveProfile() {
    const name     = $('profileName').value.trim();
    const password = $('profilePass').value;
    const msg      = $('profileMsg');
    msg.className  = 'form-msg';

    const res  = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password })
    });
    const data = await res.json();

    if (data.ok) {
      msg.textContent = 'Perfil actualizado correctamente';
      msg.className   = 'form-msg ok';
      $('navUsername').textContent = data.name.split(' ')[0];
      $('navAvatar').textContent   = data.name.charAt(0).toUpperCase();
      $('profilePass').value = '';
    } else {
      msg.textContent = data.error;
      msg.className   = 'form-msg err';
    }
  }

  /* ── Utils ── */
  function formatDate(str) {
    if (!str) return '';
    const d   = new Date(str);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)}h`;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  function init(user) {
    $('profileName').value  = user.name;
    $('profileEmail').value = user.email;
    showView('overview');
  }

  return {
    showView, loadOverview, loadConversations, loadChannels,
    openConversation, closeConversation,
    openChannelModal, closeChannelModal, selectChannelType, saveChannel,
    toggleChannel, deleteChannel,
    saveProfile, init
  };
})();
