from flask import Flask, request, jsonify, session, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from datetime import datetime
import sqlite3
import os
import requests

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "schat-dev-secret")
DB_PATH = "database.db"

# ─────────────────────────────────────────
#  Base de datos
# ─────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                name     TEXT    NOT NULL,
                email    TEXT    NOT NULL UNIQUE,
                password TEXT    NOT NULL,
                created  DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS channels (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT    NOT NULL,
                type       TEXT    NOT NULL,
                active     INTEGER DEFAULT 1,
                created    DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                channel_id INTEGER REFERENCES channels(id),
                visitor    TEXT    DEFAULT 'Visitante',
                status     TEXT    DEFAULT 'open',
                rating     INTEGER DEFAULT NULL,
                created    DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated    DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id),
                role            TEXT    NOT NULL,
                content         TEXT    NOT NULL,
                created         DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        db.commit()

# ─────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"ok": False, "error": "No autenticado"}), 401
        return f(*args, **kwargs)
    return decorated

def user_id():
    return session["user_id"]

# ─────────────────────────────────────────
#  Rutas principales
# ─────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ─────────────────────────────────────────
#  Auth
# ─────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    data     = request.get_json()
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"ok": False, "error": "Todos los campos son obligatorios"}), 400
    if "@" not in email:
        return jsonify({"ok": False, "error": "Email no válido"}), 400
    if len(password) < 6:
        return jsonify({"ok": False, "error": "La contraseña debe tener al menos 6 caracteres"}), 400

    try:
        with get_db() as db:
            db.execute(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                (name, email, generate_password_hash(password))
            )
            db.commit()
        return jsonify({"ok": True})
    except sqlite3.IntegrityError:
        return jsonify({"ok": False, "error": "Este email ya está registrado"}), 409


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"ok": False, "error": "Credenciales incorrectas"}), 401

    session["user_id"]    = user["id"]
    session["user_name"]  = user["name"]
    session["user_email"] = user["email"]
    return jsonify({"ok": True, "name": user["name"], "email": user["email"]})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/me")
def me():
    if "user_id" not in session:
        return jsonify({"ok": False}), 401
    return jsonify({"ok": True, "name": session["user_name"], "email": session["user_email"]})


@app.route("/api/profile", methods=["PUT"])
@login_required
def update_profile():
    data     = request.get_json()
    name     = data.get("name", "").strip()
    password = data.get("password", "")

    if not name:
        return jsonify({"ok": False, "error": "El nombre no puede estar vacío"}), 400

    with get_db() as db:
        if password:
            if len(password) < 6:
                return jsonify({"ok": False, "error": "La contraseña debe tener al menos 6 caracteres"}), 400
            db.execute("UPDATE users SET name=?, password=? WHERE id=?",
                       (name, generate_password_hash(password), user_id()))
        else:
            db.execute("UPDATE users SET name=? WHERE id=?", (name, user_id()))
        db.commit()

    session["user_name"] = name
    return jsonify({"ok": True, "name": name})

# ─────────────────────────────────────────
#  Canales
# ─────────────────────────────────────────

@app.route("/api/channels")
@login_required
def get_channels():
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM channels WHERE user_id=? ORDER BY created DESC", (user_id(),)
        ).fetchall()
    return jsonify({"ok": True, "channels": [dict(r) for r in rows]})


@app.route("/api/channels", methods=["POST"])
@login_required
def add_channel():
    data = request.get_json()
    name = data.get("name", "").strip()
    type_ = data.get("type", "").strip()

    if not name or not type_:
        return jsonify({"ok": False, "error": "Nombre y tipo son obligatorios"}), 400

    with get_db() as db:
        cur = db.execute(
            "INSERT INTO channels (user_id, name, type) VALUES (?, ?, ?)",
            (user_id(), name, type_)
        )
        db.commit()
        channel = db.execute("SELECT * FROM channels WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify({"ok": True, "channel": dict(channel)})


@app.route("/api/channels/<int:cid>", methods=["DELETE"])
@login_required
def delete_channel(cid):
    with get_db() as db:
        db.execute("DELETE FROM channels WHERE id=? AND user_id=?", (cid, user_id()))
        db.commit()
    return jsonify({"ok": True})


@app.route("/api/channels/<int:cid>/toggle", methods=["PUT"])
@login_required
def toggle_channel(cid):
    with get_db() as db:
        ch = db.execute("SELECT active FROM channels WHERE id=? AND user_id=?", (cid, user_id())).fetchone()
        if not ch:
            return jsonify({"ok": False, "error": "Canal no encontrado"}), 404
        new_state = 0 if ch["active"] else 1
        db.execute("UPDATE channels SET active=? WHERE id=?", (new_state, cid))
        db.commit()
    return jsonify({"ok": True, "active": new_state})

# ─────────────────────────────────────────
#  Conversaciones
# ─────────────────────────────────────────

@app.route("/api/conversations")
@login_required
def get_conversations():
    with get_db() as db:
        rows = db.execute("""
            SELECT c.*, ch.name as channel_name,
                   (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as msg_count
            FROM conversations c
            LEFT JOIN channels ch ON c.channel_id = ch.id
            WHERE c.user_id = ?
            ORDER BY c.updated DESC
            LIMIT 50
        """, (user_id(),)).fetchall()
    return jsonify({"ok": True, "conversations": [dict(r) for r in rows]})


@app.route("/api/conversations/<int:cid>/messages")
@login_required
def get_messages(cid):
    with get_db() as db:
        conv = db.execute("SELECT * FROM conversations WHERE id=? AND user_id=?", (cid, user_id())).fetchone()
        if not conv:
            return jsonify({"ok": False, "error": "No encontrado"}), 404
        msgs = db.execute(
            "SELECT * FROM messages WHERE conversation_id=? ORDER BY created ASC", (cid,)
        ).fetchall()
    return jsonify({"ok": True, "messages": [dict(m) for m in msgs]})


@app.route("/api/conversations/<int:cid>/close", methods=["PUT"])
@login_required
def close_conversation(cid):
    with get_db() as db:
        db.execute("UPDATE conversations SET status='closed', updated=? WHERE id=? AND user_id=?",
                   (datetime.now(), cid, user_id()))
        db.commit()
    return jsonify({"ok": True})

# ─────────────────────────────────────────
#  Estadísticas
# ─────────────────────────────────────────

@app.route("/api/stats")
@login_required
def get_stats():
    with get_db() as db:
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = datetime.now().strftime("%Y-%m-%d")  # simplificado

        total_today = db.execute(
            "SELECT COUNT(*) as n FROM conversations WHERE user_id=? AND date(created)=date('now')",
            (user_id(),)
        ).fetchone()["n"]

        total_week = db.execute(
            "SELECT COUNT(*) as n FROM conversations WHERE user_id=? AND date(created)>=date('now','-7 days')",
            (user_id(),)
        ).fetchone()["n"]

        total_all = db.execute(
            "SELECT COUNT(*) as n FROM conversations WHERE user_id=?", (user_id(),)
        ).fetchone()["n"]

        open_count = db.execute(
            "SELECT COUNT(*) as n FROM conversations WHERE user_id=? AND status='open'", (user_id(),)
        ).fetchone()["n"]

        total_msgs = db.execute(
            """SELECT COUNT(*) as n FROM messages m
               JOIN conversations c ON m.conversation_id=c.id
               WHERE c.user_id=?""", (user_id(),)
        ).fetchone()["n"]

        # Últimas conversaciones
        recent = db.execute("""
            SELECT c.*, ch.name as channel_name
            FROM conversations c
            LEFT JOIN channels ch ON c.channel_id=ch.id
            WHERE c.user_id=?
            ORDER BY c.updated DESC LIMIT 5
        """, (user_id(),)).fetchall()

        # Por canal
        by_channel = db.execute("""
            SELECT ch.name, ch.type, COUNT(*) as total
            FROM conversations c
            JOIN channels ch ON c.channel_id=ch.id
            WHERE c.user_id=?
            GROUP BY ch.id ORDER BY total DESC LIMIT 5
        """, (user_id(),)).fetchall()

    return jsonify({
        "ok": True,
        "total_today": total_today,
        "total_week":  total_week,
        "total_all":   total_all,
        "open":        open_count,
        "total_msgs":  total_msgs,
        "recent":      [dict(r) for r in recent],
        "by_channel":  [dict(r) for r in by_channel]
    })

# ─────────────────────────────────────────
#  Chat con LLaMA 3 (guarda en BD)
# ─────────────────────────────────────────

SYSTEM_PROMPT = """Eres el asistente virtual de s.chat, empresa de chatbots de atención al cliente.
Información del producto:
- Integra chatbots IA en webs y canales: WhatsApp, Telegram, Slack, Messenger, Teams, Web Widget
- Precios: Starter 29€/mes (1 canal, 1.000 conv.), Pro 79€/mes (5 canales, 10.000 conv.), Enterprise personalizado
- Integración: snippet de código o API REST
- Funciones: respuestas automáticas, escalado a agente humano, analítica, multilingüe, GDPR
- Prueba gratis 14 días sin tarjeta
Responde en español, breve y directo (máx. 2-3 frases). No inventes datos."""


@app.route("/api/chat", methods=["POST"])
def chat():
    data            = request.get_json()
    messages        = data.get("messages", [])
    conversation_id = data.get("conversation_id")
    uid             = session.get("user_id")

    # Crear conversación si no existe
    if uid and not conversation_id:
        with get_db() as db:
            cur = db.execute(
                "INSERT INTO conversations (user_id, visitor, status) VALUES (?, ?, 'open')",
                (uid, "Visitante web")
            )
            db.commit()
            conversation_id = cur.lastrowid

    # Guardar mensaje del usuario
    if uid and conversation_id and messages:
        last_msg = messages[-1]
        with get_db() as db:
            db.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                (conversation_id, last_msg["role"], last_msg["content"])
            )
            db.execute("UPDATE conversations SET updated=? WHERE id=?",
                       (datetime.now(), conversation_id))
            db.commit()

    try:
        res = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model":    "llama3",
                "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                "stream":   False
            },
            timeout=60
        )
        res.raise_for_status()
        reply = res.json()["message"]["content"]

        # Guardar respuesta del bot
        if uid and conversation_id:
            with get_db() as db:
                db.execute(
                    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
                    (conversation_id, "assistant", reply)
                )
                db.execute("UPDATE conversations SET updated=? WHERE id=?",
                           (datetime.now(), conversation_id))
                db.commit()

        return jsonify({"ok": True, "reply": reply, "conversation_id": conversation_id})

    except requests.exceptions.ConnectionError:
        return jsonify({"ok": False, "error": "Ollama no está activo. Ejecuta: ollama serve"}), 500
    except requests.exceptions.Timeout:
        return jsonify({"ok": False, "error": "LLaMA tardó demasiado. Inténtalo de nuevo."}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ─────────────────────────────────────────
#  Arranque
# ─────────────────────────────────────────

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
