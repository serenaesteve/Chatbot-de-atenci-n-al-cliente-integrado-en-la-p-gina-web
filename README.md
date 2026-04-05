# s.chat — Chatbot de atención al cliente

## Estructura del proyecto

```
schat-full/
├── app.py                  ← Backend Flask + API auth
├── requirements.txt
├── database.db             ← Se crea automáticamente al arrancar
├── templates/
│   └── index.html          ← HTML con Jinja2
└── static/
    ├── css/
    │   ├── variables.css
    │   ├── nav.css
    │   ├── modal.css
    │   └── main.css        ← Landing + Dashboard
    └── js/
        ├── auth.js         ← Login/Registro (llama a Flask API)
        ├── chat.js         ← Chatbot con IA
        └── ui.js           ← Gestión de vistas
```

## Cómo arrancar

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Arrancar el servidor
python app.py
```

Abre el navegador en: **http://localhost:5000**

## Base de datos

SQLite — se crea sola en `database.db` al arrancar.

Tabla `users`:
| Campo    | Tipo     | Descripción                  |
|----------|----------|------------------------------|
| id       | INTEGER  | Clave primaria autoincrement |
| name     | TEXT     | Nombre del usuario           |
| email    | TEXT     | Email único                  |
| password | TEXT     | Hash bcrypt (werkzeug)       |
| created  | DATETIME | Fecha de registro            |

## API endpoints

| Método | Ruta           | Descripción              |
|--------|----------------|--------------------------|
| POST   | /api/register  | Crear cuenta nueva       |
| POST   | /api/login     | Iniciar sesión           |
| POST   | /api/logout    | Cerrar sesión            |
| GET    | /api/me        | Datos del usuario activo |

## Notas

- Las contraseñas se guardan con hash (werkzeug `generate_password_hash`)
- La sesión se mantiene con Flask session (cookie firmada)
- Cambia `app.secret_key` en producción por una clave segura
