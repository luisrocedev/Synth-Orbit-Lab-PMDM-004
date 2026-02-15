import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "synth_orbit.sqlite3"

app = Flask(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS performers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                dni TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS compositions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                performer_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                bpm INTEGER NOT NULL,
                synth_type TEXT NOT NULL,
                grid_json TEXT NOT NULL,
                scene_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(performer_id) REFERENCES performers(id)
            );

            CREATE TABLE IF NOT EXISTS jam_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                performer_id INTEGER NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                total_hits INTEGER DEFAULT 0,
                total_notes INTEGER DEFAULT 0,
                avg_frequency REAL DEFAULT 0,
                FOREIGN KEY(performer_id) REFERENCES performers(id)
            );

            CREATE TABLE IF NOT EXISTS synth_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                note TEXT,
                frequency REAL DEFAULT 0,
                velocity REAL DEFAULT 0,
                payload_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES jam_sessions(id)
            );
            """
        )


def seed_compositions() -> None:
    with get_db() as connection:
        total = connection.execute("SELECT COUNT(*) AS n FROM compositions").fetchone()["n"]
        if total:
            return

        performer = connection.execute(
            "INSERT INTO performers (name, dni, created_at) VALUES (?, ?, ?)",
            ("Demo", "00000000X", now_iso()),
        ).lastrowid

        demo_grid = [[1 if c in {0, 4} and r in {0, 2, 4} else 0 for c in range(16)] for r in range(7)]
        demo_scene = {
            "balls": [
                {"x": 0.4, "y": 0.5, "dx": 3.2, "dy": -2.4, "radius": 11},
                {"x": 0.6, "y": 0.5, "dx": -2.5, "dy": 3.1, "radius": 12},
            ],
            "rings": 2,
        }

        connection.execute(
            """
            INSERT INTO compositions (
                performer_id, title, bpm, synth_type, grid_json, scene_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (performer, "Demo Orbit", 108, "triangle", json.dumps(demo_grid), json.dumps(demo_scene), now_iso()),
        )


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/performers/register")
def register_performer():
    body = request.get_json(silent=True) or {}
    name = str(body.get("name", "")).strip()
    dni = str(body.get("dni", "")).strip().upper()

    if not name or not dni:
        return jsonify({"ok": False, "error": "Nombre y DNI obligatorios."}), 400

    with get_db() as connection:
        performer_id = connection.execute(
            "INSERT INTO performers (name, dni, created_at) VALUES (?, ?, ?)",
            (name, dni, now_iso()),
        ).lastrowid

    return jsonify({"ok": True, "performerId": performer_id, "name": name, "dni": dni})


@app.post("/api/sessions/start")
def start_session():
    body = request.get_json(silent=True) or {}
    performer_id = body.get("performerId")

    if not performer_id:
        return jsonify({"ok": False, "error": "performerId es obligatorio."}), 400

    with get_db() as connection:
        session_id = connection.execute(
            "INSERT INTO jam_sessions (performer_id, started_at) VALUES (?, ?)",
            (performer_id, now_iso()),
        ).lastrowid

    return jsonify({"ok": True, "sessionId": session_id})


@app.post("/api/sessions/event")
def log_event():
    body = request.get_json(silent=True) or {}
    session_id = body.get("sessionId")
    event_type = str(body.get("eventType", "")).strip()
    note = str(body.get("note", "")).strip() or None
    frequency = float(body.get("frequency", 0) or 0)
    velocity = float(body.get("velocity", 0) or 0)
    payload = body.get("payload", {})

    if not session_id or not event_type:
        return jsonify({"ok": False, "error": "sessionId y eventType obligatorios."}), 400

    with get_db() as connection:
        connection.execute(
            """
            INSERT INTO synth_events (
                session_id, event_type, note, frequency, velocity, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (session_id, event_type, note, frequency, velocity, json.dumps(payload, ensure_ascii=False), now_iso()),
        )

    return jsonify({"ok": True})


@app.post("/api/sessions/end")
def end_session():
    body = request.get_json(silent=True)
    if body is None:
        raw = request.get_data(as_text=True) or "{}"
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = {}
    session_id = body.get("sessionId")
    total_hits = int(body.get("totalHits", 0) or 0)
    total_notes = int(body.get("totalNotes", 0) or 0)
    avg_frequency = float(body.get("avgFrequency", 0) or 0)

    if not session_id:
        return jsonify({"ok": False, "error": "sessionId es obligatorio."}), 400

    with get_db() as connection:
        connection.execute(
            """
            UPDATE jam_sessions
            SET ended_at = ?, total_hits = ?, total_notes = ?, avg_frequency = ?
            WHERE id = ?
            """,
            (now_iso(), total_hits, total_notes, avg_frequency, session_id),
        )

    return jsonify({"ok": True})


@app.post("/api/compositions")
def save_composition():
    body = request.get_json(silent=True) or {}
    performer_id = body.get("performerId")
    title = str(body.get("title", "")).strip()
    bpm = int(body.get("bpm", 100) or 100)
    synth_type = str(body.get("synthType", "triangle")).strip() or "triangle"
    grid = body.get("grid")
    scene = body.get("scene")

    if not performer_id or not title or grid is None or scene is None:
        return jsonify({"ok": False, "error": "Faltan datos para guardar composición."}), 400

    with get_db() as connection:
        comp_id = connection.execute(
            """
            INSERT INTO compositions (
                performer_id, title, bpm, synth_type, grid_json, scene_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (performer_id, title, bpm, synth_type, json.dumps(grid), json.dumps(scene), now_iso()),
        ).lastrowid

    return jsonify({"ok": True, "compositionId": comp_id})


@app.get("/api/compositions")
def list_compositions():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT c.id, c.title, c.bpm, c.synth_type, c.created_at,
                   p.name AS performer_name, p.dni
            FROM compositions c
            JOIN performers p ON p.id = c.performer_id
            ORDER BY c.id DESC
            LIMIT 25
            """
        ).fetchall()

    return jsonify({"ok": True, "compositions": [dict(row) for row in rows]})


@app.get("/api/compositions/<int:composition_id>")
def get_composition(composition_id: int):
    with get_db() as connection:
        row = connection.execute(
            "SELECT * FROM compositions WHERE id = ?",
            (composition_id,),
        ).fetchone()

    if not row:
        return jsonify({"ok": False, "error": "Composición no encontrada."}), 404

    composition = dict(row)
    composition["grid"] = json.loads(composition["grid_json"])
    composition["scene"] = json.loads(composition["scene_json"])
    return jsonify({"ok": True, "composition": composition})


@app.get("/api/leaderboard")
def leaderboard():
    with get_db() as connection:
        rows = connection.execute(
            """
            SELECT p.id, p.name, p.dni,
                   COUNT(s.id) AS sessions,
                   COALESCE(SUM(s.total_hits), 0) AS hits,
                   COALESCE(SUM(s.total_notes), 0) AS notes
            FROM performers p
            LEFT JOIN jam_sessions s ON s.performer_id = p.id
            GROUP BY p.id, p.name, p.dni
            ORDER BY notes DESC, hits DESC, sessions DESC
            LIMIT 10
            """
        ).fetchall()

    return jsonify({"ok": True, "leaders": [dict(row) for row in rows]})


@app.get("/api/stats")
def stats():
    with get_db() as connection:
        totals = connection.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM performers) AS performers,
                (SELECT COUNT(*) FROM compositions) AS compositions,
                (SELECT COUNT(*) FROM jam_sessions) AS sessions,
                (SELECT COUNT(*) FROM synth_events) AS events
            """
        ).fetchone()

    return jsonify({"ok": True, "stats": dict(totals)})


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "db": DB_PATH.name, "utc": now_iso()})


if __name__ == "__main__":
    init_db()
    seed_compositions()
    app.run(debug=True, port=5080)
