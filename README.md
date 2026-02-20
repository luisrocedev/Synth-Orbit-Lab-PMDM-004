<div align="center">

# 🎛️ Synth Orbit Lab

**Sintetizador musical interactivo con física de rebotes, secuenciador 16-step y telemetría en tiempo real**

![Python](https://img.shields.io/badge/Python_3-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask_3-000000?style=flat-square&logo=flask&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Web Audio](https://img.shields.io/badge/Web_Audio_API-E34F26?style=flat-square&logo=html5&logoColor=white)
![Canvas](https://img.shields.io/badge/Canvas_2D-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/Licencia-MIT-green?style=flat-square)

*PMDM · Actividad 004 — Síntesis de Sonido · DAM2 2025 / 2026*

</div>

---

## 📋 Índice

1. [Descripción](#-descripción)
2. [Características](#-características)
3. [Arquitectura](#-arquitectura)
4. [Inicio rápido](#-inicio-rápido)
5. [Cómo funciona](#-cómo-funciona)
6. [API REST](#-api-rest)
7. [Modelo de datos](#-modelo-de-datos)
8. [Estructura del proyecto](#-estructura-del-proyecto)
9. [Contexto académico](#-contexto-académico)

---

## 🎯 Descripción

Synth Orbit Lab es un laboratorio de síntesis sonora que combina tres conceptos:

- **Rebotes musicales** → Bolas que colisionan contra anillos orbitales y disparan notas
- **Secuenciador tipo step** → Grid 16×7 editable que reproduce patrones a BPM configurable
- **Telemetría completa** → Cada nota, colisión y acción se registra en base de datos

Todo se ejecuta como una SPA servida por Flask con persistencia SQLite.

---

## ✨ Características

| Categoría | Detalle |
|-----------|---------|
| **Síntesis de audio** | 4 tipos de oscilador: `sine`, `triangle`, `sawtooth`, `square` |
| **Física de rebotes** | 2 órbitas (graves C3–B3, agudos C5–B5) con detección de colisión angular |
| **Secuenciador** | Grid 16 pasos × 7 notas (C5 → D4), BPM ajustable (60–220) |
| **Drag & launch** | Arrastra en el canvas para lanzar bolas con dirección y velocidad |
| **Composiciones** | Guarda grid + escena física completa y recárgala desde la BD |
| **Telemetría** | Eventos `note` y `spawn_ball` con frecuencia, velocidad y contexto |
| **Leaderboard** | Ranking por notas, hits y sesiones con `LEFT JOIN` + `GROUP BY` |
| **Métricas globales** | KPIs: performers, composiciones, sesiones, eventos totales |
| **Envolvente ADSR** | Attack/Decay con `exponentialRampToValueAtTime` |
| **Session Guard** | `navigator.sendBeacon()` cierra sesión al cerrar pestaña |
| **Responsive** | `@media (max-width: 1100px)` adapta a una columna |

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────┐
│  FRONTEND  (SPA)                                 │
│  ┌─────────┐  ┌───────────┐  ┌──────────────┐   │
│  │ Canvas  │  │ Grid 16×7 │  │  Paneles     │   │
│  │ Órbitas │  │  Editor   │  │  Stats/Rank  │   │
│  └────┬────┘  └─────┬─────┘  └──────┬───────┘   │
│       │             │               │            │
│  ┌────┴─────────────┴───────────────┴────┐       │
│  │      Web Audio API (OscillatorNode)   │       │
│  └────────────────┬──────────────────────┘       │
│                   │  fetch JSON                  │
├───────────────────┼──────────────────────────────┤
│  BACKEND  Flask   │                              │
│  ┌────────────────┴──────────────────┐           │
│  │    REST API  (port 5080)          │           │
│  │  /performers · /sessions · /comps │           │
│  └─────────────────┬─────────────────┘           │
│                    │                             │
│  ┌─────────────────┴─────────────────┐           │
│  │   SQLite  (synth_orbit.sqlite3)   │           │
│  │  performers · compositions        │           │
│  │  jam_sessions · synth_events      │           │
│  └───────────────────────────────────┘           │
└──────────────────────────────────────────────────┘
```

---

## 🚀 Inicio rápido

```bash
# 1. Clonar
git clone https://github.com/luisrocedev/Synth-Orbit-Lab-PMDM-004.git
cd Synth-Orbit-Lab-PMDM-004

# 2. Entorno virtual
python -m venv .venv && source .venv/bin/activate

# 3. Dependencias
pip install -r requirements.txt

# 4. Arrancar
python app.py
```

Abrir **http://127.0.0.1:5080** en el navegador.

> La base de datos se crea automáticamente con una composición demo.

---

## 🎹 Cómo funciona

### Órbitas y rebotes

El canvas muestra dos anillos circulares. El **izquierdo** contiene 7 notas graves (C3–B3) y el **derecho** 7 agudas (C5–B5). Al hacer clic-arrastrar dentro de un anillo, se lanza una bola con velocidad proporcional al drag. Cuando la bola choca con el borde del anillo:

1. Se calcula el **ángulo** de colisión con `Math.atan2`
2. Se determina la **nota** correspondiente al segmento del arco
3. Se sintetiza el **sonido** con `OscillatorNode`
4. Se **refleja** la velocidad (reflexión especular con producto punto)

### Secuenciador 16-step

El grid de 16 columnas × 7 filas actúa como una partitura simplificada. Cada celda activa dispara su nota al reproducir esa columna. El tempo se controla con BPM (60–220). La columna actual se resalta visualmente con la clase `.playing`.

### Persistencia

Una composición guarda: el estado del grid (matriz 7×16), la escena física (posición, velocidad y radio de cada bola normalizada), BPM y tipo de sintetizador. Se puede recargar cualquier composición anterior desde el panel.

---

## 📡 API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/performers/register` | Registrar performer `{name, dni}` |
| `POST` | `/api/sessions/start` | Iniciar jam session `{performerId}` |
| `POST` | `/api/sessions/event` | Registrar evento `{sessionId, eventType, note, frequency, velocity}` |
| `POST` | `/api/sessions/end` | Cerrar sesión `{sessionId, totalHits, totalNotes, avgFrequency}` |
| `POST` | `/api/compositions` | Guardar composición `{performerId, title, bpm, synthType, grid, scene}` |
| `GET`  | `/api/compositions` | Listar composiciones (últimas 25) |
| `GET`  | `/api/compositions/:id` | Obtener composición por ID con grid y escena |
| `GET`  | `/api/leaderboard` | Top 10 performers por notas/hits/sesiones |
| `GET`  | `/api/stats` | Métricas globales (performers, compositions, sessions, events) |
| `GET`  | `/api/health` | Health check con timestamp UTC |

---

## 🗄️ Modelo de datos

```
performers          compositions            jam_sessions         synth_events
─────────────       ────────────────        ──────────────       ──────────────
id (PK)             id (PK)                 id (PK)              id (PK)
name                performer_id (FK)       performer_id (FK)    session_id (FK)
dni                 title                   started_at           event_type
created_at          bpm                     ended_at             note
                    synth_type              total_hits           frequency
                    grid_json               total_notes          velocity
                    scene_json              avg_frequency        payload_json
                    created_at                                   created_at
```

---

## 📁 Estructura del proyecto

```
Synth-Orbit-Lab-PMDM-004/
├── app.py                                  # Backend Flask + SQLite (304 líneas)
├── requirements.txt                        # flask>=3.0
├── synth_orbit.sqlite3                     # BD auto-generada
├── README.md
├── templates/
│   └── index.html                          # SPA: canvas + grid + paneles
├── static/
│   ├── app.js                              # Motor: Web Audio + Canvas + secuenciador (546 líneas)
│   └── styles.css                          # Design System con CSS custom properties
└── docs/
    └── Actividad_SintesisSonido_53945291X.md
```

---

## 🎓 Contexto académico

| Campo | Valor |
|-------|-------|
| **Módulo** | PMDM — Programación Multimedia y Dispositivos Móviles |
| **Actividad** | 004 — Síntesis de Sonido |
| **Ciclo** | DAM2 · Curso 2025 / 2026 |
| **Alumno** | Luis Jahir Rodriguez Cedeño |
| **DNI** | 53945291X |

---

<div align="center">

*Synth Orbit Lab — Donde la física encuentra la música*

</div>
