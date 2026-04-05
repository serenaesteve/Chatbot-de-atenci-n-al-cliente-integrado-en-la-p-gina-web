/* ================================
   s.chat — Chat Module
   static/js/chat.js
   ================================ */

const Chat = (() => {
  const messages = [];
  let loading = false;
  let conversationId = null;
  const $ = id => document.getElementById(id);

  function addMessage(role, text) {
    const container = $('chatMessages');
    const div = document.createElement('div');
    div.className = `msg ${role === 'user' ? 'msg--user' : ''}`;
    const av = document.createElement('div');
    av.className = 'msg__av';
    av.textContent = role === 'bot' ? 's.c' : 'Tú';
    const bubble = document.createElement('div');
    bubble.className = 'msg__bubble';
    bubble.textContent = text;
    div.appendChild(av);
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = $('chatMessages');
    const div = document.createElement('div');
    div.className = 'msg'; div.id = 'typingIndicator';
    const av = document.createElement('div');
    av.className = 'msg__av'; av.textContent = 's.c';
    const t = document.createElement('div');
    t.className = 'typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    div.appendChild(av); div.appendChild(t);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const t = $('typingIndicator');
    if (t) t.remove();
  }

  async function send() {
    if (loading) return;
    const input = $('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const qb = $('quickBtns');
    if (qb) qb.style.display = 'none';

    addMessage('user', text);
    messages.push({ role: 'user', content: text });
    loading = true;
    $('sendBtn').disabled = true;
    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, conversation_id: conversationId })
      });
      const data = await res.json();

      removeTyping();

      if (data.ok) {
        conversationId = data.conversation_id;
        addMessage('bot', data.reply);
        messages.push({ role: 'assistant', content: data.reply });
      } else {
        addMessage('bot', data.error || 'Lo siento, algo salió mal.');
      }
    } catch {
      removeTyping();
      addMessage('bot', 'Error de conexión. Comprueba que el servidor está activo.');
    } finally {
      loading = false;
      $('sendBtn').disabled = false;
      $('chatInput').focus();
    }
  }

  function sendQuick(text) {
    $('chatInput').value = text;
    send();
  }

  return { send, sendQuick };
})();
