# 📝 Plantilla Examen PMDM — Synth Orbit Lab
## Actividad 004 · Síntesis de Sonido

**Alumno:** Luis Jahir Rodriguez Cedeño
**DNI:** 53945291X
**Módulo:** PMDM — Programación Multimedia y Dispositivos Móviles
**Ciclo:** DAM2 · Curso 2025 / 2026

---

## 1. Descripción del proyecto

Synth Orbit Lab es un sintetizador musical interactivo con:
- **2 órbitas** con 7 notas cada una (graves C3–B3, agudos C5–B5)
- **Bolas que rebotan** dentro de las órbitas y disparan notas al colisionar
- **Secuenciador 16-step** (grid 16×7) con BPM configurable
- **4 tipos de oscilador:** sine, triangle, sawtooth, square
- **Backend Flask + SQLite** con persistencia completa y telemetría

**Puerto:** 5080
**Base de datos:** SQLite (synth_orbit.sqlite3)

---

## 2. Web Audio API — Conceptos clave

### 2.1 Crear el contexto de audio

```javascript
function ensureAudio() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.masterGain = state.audioCtx.createGain();
    state.masterGain.gain.value = 0.8;
    state.masterGain.connect(state.audioCtx.destination);
  }
  if (state.audioCtx.state !== "running") {
    state.audioCtx.resume();
  }
}
```

**Explicación:**
- `AudioContext` es el motor de sonido del navegador. Solo se crea UNA instancia.
- `webkitAudioContext` es el fallback para navegadores antiguos (Safari viejo).
- `createGain()` → crea un nodo de volumen maestro (0.0 silencio – 1.0 máximo).
- `masterGain.connect(state.audioCtx.destination)` → conecta al altavoz del dispositivo.
- `audioCtx.resume()` es necesario porque los navegadores **bloquean el audio** hasta que hay interacción del usuario (política de autoplay).

**Cadena de audio:**
```
OscillatorNode → GainNode (volumen nota) → GainNode (master) → destination (altavoz)
```

### 2.2 Sintetizar una nota con OscillatorNode

```javascript
function playTone(note, frequency, velocity = 0.6, duration = 0.3, source = "manual") {
  ensureAudio();
  const now = state.audioCtx.currentTime;

  // 1. Crear oscilador (genera la onda sonora)
  const osc = state.audioCtx.createOscillator();
  osc.type = state.synthType;                           // sine | triangle | sawtooth | square
  osc.frequency.setValueAtTime(frequency, now);         // Frecuencia en Hz (ej: 440 = La4)

  // 2. Crear envolvente de volumen (Attack-Decay)
  const gain = state.audioCtx.createGain();
  gain.gain.setValueAtTime(0.0001, now);                // Empieza en silencio
  gain.gain.exponentialRampToValueAtTime(               // Attack: sube rápido
    Math.max(0.05, velocity), now + 0.02
  );
  gain.gain.exponentialRampToValueAtTime(               // Decay: baja gradualmente
    0.0001, now + duration
  );

  // 3. Conectar cadena: osc → gain → master → altavoz
  osc.connect(gain);
  gain.connect(state.masterGain);

  // 4. Programar inicio y fin
  osc.start(now);
  osc.stop(now + duration + 0.02);

  // 5. Registrar telemetría
  state.totalNotes += 1;
  state.frequencyAcc += frequency;
}
```

**Explicación línea por línea:**
- `createOscillator()` genera una onda periódica pura. Es la base de la síntesis.
- `osc.type` define la forma de onda: `sine` (suave), `triangle` (medio), `sawtooth` (brillante), `square` (retro/8-bit).
- `frequency.setValueAtTime(freq, time)` → programa la frecuencia de forma precisa con el reloj de audio (NO con `setTimeout`).
- `exponentialRampToValueAtTime` → transición logarítmica de volumen. Usamos esto en vez de `linearRamp` porque el oído humano percibe el volumen de forma logarítmica.
- `0.0001` en vez de `0` → `exponentialRamp` NO puede llegar a 0 (lanzaría error), se usa un valor muy pequeño.
- `osc.start()` / `osc.stop()` → el oscilador es **desechable**: una vez parado no se puede reusar, hay que crear otro.

### 2.3 Mapa de frecuencias (notas → Hz)

```javascript
const noteFreq = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61,
  G3: 196.0,  A3: 220.0,  B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.0,  A4: 440.0,  B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
  G5: 783.99, A5: 880.0,  B5: 987.77,
};
```

**Explicación:** Cada nota musical tiene una frecuencia fija en Hz. La4 = 440 Hz es la referencia universal. Cada octava superior DUPLICA la frecuencia (A3=220, A4=440, A5=880).

**Fórmula:** $f = 440 \times 2^{(n-69)/12}$ donde $n$ es el número MIDI de la nota.

---

## 3. Canvas 2D — Física de rebotes

### 3.1 Dibujar las órbitas

```javascript
function drawRing(cx, cy, notes, color) {
  const arc = (Math.PI * 2) / notes.length;  // Ángulo por nota (2π/7)

  for (let i = 0; i < notes.length; i += 1) {
    ctx.strokeStyle = color(i);
    ctx.beginPath();
    ctx.arc(cx, cy, centers.radius, i * arc, (i + 1) * arc);
    ctx.stroke();
  }
}
```

**Explicación:**
- Cada órbita es un círculo dividido en 7 arcos (uno por nota).
- `Math.PI * 2` = 360° en radianes. Dividido entre 7 notas = ~51.4° por segmento.
- `ctx.arc(cx, cy, radius, startAngle, endAngle)` dibuja un arco del círculo.
- `color(i)` es una función que genera colores HSL distintos por segmento.

### 3.2 Lanzar bola con drag (clic-arrastrar)

```javascript
stage.addEventListener("mousedown", (event) => {
  const rect = stage.getBoundingClientRect();
  const x = event.clientX - rect.left;   // Posición relativa al canvas
  const y = event.clientY - rect.top;
  const ring = ringOfPoint(x, y);         // ¿Está dentro de un anillo?
  if (!ring) return;

  drag = { active: true, x0: x, y0: y, x1: x, y1: y, ring };
});

stage.addEventListener("mouseup", () => {
  if (!drag.active) return;
  // Velocidad = distancia del arrastre × factor
  const dx = (drag.x0 - drag.x1) * 0.08;
  const dy = (drag.y0 - drag.y1) * 0.08;
  spawnBall(drag.x0, drag.y0, dx, dy, drag.ring);
  drag.active = false;
});
```

**Explicación:**
- `getBoundingClientRect()` convierte coordenadas de pantalla a coordenadas del canvas.
- La dirección de la bola es **opuesta** al arrastre (como una honda): `drag.x0 - drag.x1`.
- El factor `0.08` escala la velocidad para que no sea excesiva.
- `ringOfPoint(x, y)` calcula la distancia al centro de cada anillo para determinar en cuál se hizo clic.

### 3.3 Detectar en qué anillo está un punto

```javascript
function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);   // √((Δx)² + (Δy)²)
}

function ringOfPoint(x, y) {
  const dL = distance(x, y, centers.leftX, centers.centerY);
  const dR = distance(x, y, centers.rightX, centers.centerY);
  if (dL <= centers.radius) return "left";
  if (dR <= centers.radius) return "right";
  return null;   // Fuera de ambos anillos
}
```

**Explicación:** `Math.hypot(a, b)` calcula la hipotenusa $\sqrt{a^2 + b^2}$. Si la distancia del punto al centro del anillo es menor que el radio, el punto está dentro.

### 3.4 Colisión y reflexión de la bola

```javascript
function collideBall(ball) {
  const cx = ball.ring === "left" ? centers.leftX : centers.rightX;
  const cy = centers.centerY;
  const notes = ball.ring === "left" ? ringA : ringB;

  const d = distance(ball.x, ball.y, cx, cy);
  if (d + ball.radius < centers.radius) return;  // Aún dentro, no hay colisión

  // 1. Ángulo de la bola respecto al centro
  const angle = Math.atan2(ball.y - cy, ball.x - cx);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);  // 0 a 2π

  // 2. ¿Qué nota del arco golpeó?
  const arc = (Math.PI * 2) / notes.length;
  const idx = Math.floor(normalized / arc);
  const note = notes[idx];

  // 3. Reproducir la nota
  playTone(note, noteFreq[note], 0.5, 0.28, "collision");

  // 4. Reflexión especular
  const nx = (ball.x - cx) / d;  // Normal unitaria X
  const ny = (ball.y - cy) / d;  // Normal unitaria Y
  const dot = ball.dx * nx + ball.dy * ny;  // Producto punto
  ball.dx = ball.dx - 2 * dot * nx;         // Reflejo X
  ball.dy = ball.dy - 2 * dot * ny;         // Reflejo Y

  // 5. Corregir overlap (evitar que se quede pegada al borde)
  const overlap = d + ball.radius - centers.radius;
  ball.x -= overlap * nx;
  ball.y -= overlap * ny;
}
```

**Explicación detallada:**
- `Math.atan2(dy, dx)` devuelve el ángulo en radianes (-π a π). Lo normalizamos a 0–2π.
- Dividimos el ángulo entre el arco por nota para saber **qué segmento** del anillo golpea.
- **Reflexión especular:** la fórmula $\vec{v'} = \vec{v} - 2(\vec{v} \cdot \hat{n})\hat{n}$ refleja el vector velocidad respecto a la normal de la superficie.
- `nx, ny` es el **vector normal unitario** (dirección desde el centro al punto de impacto).
- `dot` es el **producto punto** que mide cuánto de la velocidad va "hacia" la normal.
- La corrección de overlap mueve la bola hacia dentro para que no se quede fuera del anillo.

### 3.5 Bucle de física y renderizado

```javascript
function updatePhysics() {
  for (const ball of balls) {
    ball.x += ball.dx;    // Mover en X
    ball.y += ball.dy;    // Mover en Y
    collideBall(ball);    // Comprobar y resolver colisión
  }
}

function render() {
  drawBackground();
  drawRing(centers.leftX, centers.centerY, ringA, (i) => `hsl(${190 + i * 10},90%,62%)`);
  drawRing(centers.rightX, centers.centerY, ringB, (i) => `hsl(${320 - i * 10},90%,64%)`);
  drawBalls();
  drawDragPreview();
  requestAnimationFrame(render);   // ~60 FPS
}

// En boot():
setInterval(updatePhysics, 16);    // ~60 updates/segundo
```

**Explicación:**
- `requestAnimationFrame(render)` → el navegador llama a `render()` justo antes de pintar cada frame (~60 FPS). Es más eficiente que `setInterval` para dibujo.
- `setInterval(updatePhysics, 16)` → 16ms ≈ 60 Hz para la física. Se separa de render para que la física sea independiente del framerate.
- **¿Por qué dos bucles separados?** Si el navegador pierde frames de render (pestaña en segundo plano), la física sigue avanzando correctamente.

### 3.6 Efecto de glow en las bolas

```javascript
function drawBalls() {
  for (const ball of balls) {
    // 1. Halo luminoso (gradiente radial)
    const glow = ctx.createRadialGradient(
      ball.x, ball.y, 2,                 // Centro del gradiente, radio interior
      ball.x, ball.y, ball.radius * 2.2  // Mismo centro, radio exterior
    );
    glow.addColorStop(0, ball.color);     // Color sólido en el centro
    glow.addColorStop(1, "transparent");  // Transparente en el borde
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Bola sólida encima
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

**Explicación:** Cada bola tiene dos capas: un gradiente radial grande (glow) que va de color a transparente, y un círculo sólido pequeño encima. Esto crea un efecto de "neón" o "resplandor" sin usar filtros CSS costosos.

---

## 4. Secuenciador 16-step

### 4.1 Construir el grid interactivo

```javascript
const gridRows = 7;    // 7 notas: C5, B4, A4, G4, F4, E4, D4
const gridCols = 16;   // 16 pasos
let grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));

function buildGridUI() {
  el.grid.innerHTML = "";
  for (let r = 0; r < gridRows; r += 1) {
    for (let c = 0; c < gridCols; c += 1) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      if (grid[r][c]) cell.classList.add("active");

      cell.addEventListener("click", () => {
        grid[r][c] = grid[r][c] ? 0 : 1;            // Toggle: 0→1, 1→0
        cell.classList.toggle("active", Boolean(grid[r][c]));
      });

      el.grid.appendChild(cell);
    }
  }
}
```

**Explicación:**
- `Array.from({ length: 7 }, () => Array(16).fill(0))` → crea una matriz 7×16 llena de ceros.
- Cada celda es un `<button>` con `data-r` y `data-c` para identificar fila/columna.
- Toggle: si la celda está activa (1) se desactiva (0) y viceversa.
- El grid CSS (`grid-template-columns: repeat(16, 1fr)`) organiza las 112 celdas automáticamente.

### 4.2 Reproducir el secuenciador

```javascript
function playSequencerStep() {
  markPlayingColumn(state.step);  // Resaltar columna actual

  for (let r = 0; r < gridRows; r += 1) {
    if (!grid[r][state.step]) continue;    // Si la celda está vacía, saltar
    const note = notesRows[r];              // notesRows = ["C5","B4","A4","G4","F4","E4","D4"]
    playTone(note, noteFreq[note], 0.35, 0.22, "sequencer");
  }

  state.step = (state.step + 1) % gridCols;  // Avanzar y volver al 0 en el 16
}

function startSequencer() {
  if (state.seqTimer) return;    // No duplicar
  ensureAudio();
  const interval = Math.max(50, Math.floor((60_000 / state.bpm) / 4));
  state.seqTimer = setInterval(playSequencerStep, interval);
}

function stopSequencer() {
  clearInterval(state.seqTimer);
  state.seqTimer = null;
  markPlayingColumn(-1);   // Quitar resaltado
}
```

**Explicación:**
- **BPM a milisegundos:** `60_000 / bpm / 4` → convierte BPM (beats por minuto) a ms por step. A 120 BPM: 60000/120/4 = 125ms por step.
- `Math.max(50, ...)` → mínimo 50ms para evitar intervalos demasiado cortos.
- `% gridCols` → al llegar al paso 16, vuelve a 0 (bucle infinito).
- `markPlayingColumn(col)` añade la clase CSS `.playing` a todas las celdas de esa columna.

**Fórmula del intervalo:**
$$\text{interval} = \max\left(50, \left\lfloor\frac{60000}{\text{BPM} \times 4}\right\rfloor\right) \text{ ms}$$

### 4.3 Resaltado visual de columna activa

```javascript
function markPlayingColumn(col) {
  const cells = el.grid.querySelectorAll(".cell");
  cells.forEach((node) => node.classList.remove("playing"));
  cells.forEach((node) => {
    if (Number(node.dataset.c) === col) {
      node.classList.add("playing");
    }
  });
}
```

```css
.cell.playing {
  border-color: var(--warn);  /* Borde dorado para la columna activa */
}
```

**Explicación:** Primero quita `.playing` de TODAS las celdas, luego la añade solo a las de la columna actual. Usa `dataset.c` que guardamos al crear el grid.

---

## 5. Composiciones — Guardar y cargar estado completo

### 5.1 Capturar la escena (normalizar posiciones)

```javascript
function captureScene() {
  return {
    balls: balls.map((ball) => ({
      x: Number((ball.x / width).toFixed(4)),     // Normalizar a 0–1
      y: Number((ball.y / height).toFixed(4)),
      dx: Number(ball.dx.toFixed(3)),
      dy: Number(ball.dy.toFixed(3)),
      radius: Number(ball.radius.toFixed(2)),
      ring: ball.ring,
    })),
    width,
    height,
  };
}
```

**Explicación:** Las posiciones se guardan como **fracciones** (0.0 a 1.0) del canvas, no en píxeles absolutos. Así, si el canvas cambia de tamaño, las bolas se reposicionan proporcionalmente al cargar. `toFixed(4)` limita decimales para no guardar datos excesivos en JSON.

### 5.2 Restaurar la escena

```javascript
function applyScene(scene) {
  if (!scene || !Array.isArray(scene.balls)) {
    balls = [];
    return;
  }
  balls = scene.balls.map((ball) => ({
    x: ball.x * width,      // Desnormalizar: fracción × ancho real
    y: ball.y * height,
    dx: ball.dx,
    dy: ball.dy,
    radius: ball.radius,
    ring: ball.ring,
    color: ball.ring === "left" ? "#66d9ff" : "#ff79c6",
  }));
}
```

**Explicación:** Operación inversa a `captureScene()`. Multiplica la fracción por el tamaño real del canvas para obtener píxeles.

### 5.3 Guardar composición (frontend → backend)

```javascript
el.saveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.performerId) return;

  const formData = new FormData(el.saveForm);
  const title = String(formData.get("title") || "").trim();

  await api("/api/compositions", {
    method: "POST",
    body: JSON.stringify({
      performerId: state.performerId,
      title,
      bpm: state.bpm,
      synthType: state.synthType,
      grid,                     // Matriz 7×16 de 0s y 1s
      scene: captureScene(),    // Bolas normalizadas
    }),
  });

  el.saveForm.reset();
  await refreshCompositions();
});
```

**Explicación:** `event.preventDefault()` evita que el formulario recargue la página. `FormData` extrae los valores del formulario. Se envía grid + escena como JSON al backend.

### 5.4 Endpoint backend para guardar

```python
@app.post("/api/compositions")
def save_composition():
    body = request.get_json(silent=True) or {}
    performer_id = body.get("performerId")
    title = str(body.get("title", "")).strip()
    bpm = int(body.get("bpm", 100) or 100)
    synth_type = str(body.get("synthType", "triangle")).strip()
    grid = body.get("grid")
    scene = body.get("scene")

    if not performer_id or not title or grid is None or scene is None:
        return jsonify({"ok": False, "error": "Faltan datos."}), 400

    with get_db() as conn:
        comp_id = conn.execute(
            """INSERT INTO compositions
               (performer_id, title, bpm, synth_type, grid_json, scene_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (performer_id, title, bpm, synth_type,
             json.dumps(grid), json.dumps(scene), now_iso()),
        ).lastrowid

    return jsonify({"ok": True, "compositionId": comp_id})
```

**Explicación:**
- `json.dumps(grid)` serializa la matriz Python a string JSON para guardar en SQLite (campo TEXT).
- `json.dumps(scene)` hace lo mismo con la escena de bolas.
- Al cargar se usa `json.loads()` para deserializar de vuelta a Python dict/list.
- Parámetros `?` para prevenir SQL injection.

### 5.5 Cargar composición

```javascript
button.addEventListener("click", async () => {
  const res = await api(`/api/compositions/${id}`);
  const comp = res.composition;

  grid = comp.grid;                        // Restaurar grid
  state.bpm = comp.bpm;                    // Restaurar BPM
  state.synthType = comp.synth_type;       // Restaurar oscilador
  el.bpm.value = String(comp.bpm);         // Sincronizar UI
  el.synthType.value = comp.synth_type;
  applyScene(comp.scene);                  // Restaurar bolas
  buildGridUI();                           // Reconstruir grid visual
});
```

**Explicación:** Al cargar una composición, se restaura TODO el estado: la partitura (grid), los parámetros de audio (BPM, tipo) y la física (bolas con velocidad). Es una "snapshot" completa del estado de la app.

---

## 6. Backend Flask + SQLite

### 6.1 Esquema de 4 tablas

```sql
-- Usuarios del sintetizador
CREATE TABLE performers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dni TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Composiciones guardadas (grid + escena)
CREATE TABLE compositions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  performer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  bpm INTEGER NOT NULL,
  synth_type TEXT NOT NULL,
  grid_json TEXT NOT NULL,      -- Matriz 7×16 serializada
  scene_json TEXT NOT NULL,     -- Bolas+física serializada
  created_at TEXT NOT NULL,
  FOREIGN KEY(performer_id) REFERENCES performers(id)
);

-- Sesiones de jam (inicio/fin con métricas)
CREATE TABLE jam_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  performer_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  total_hits INTEGER DEFAULT 0,     -- Colisiones contra anillos
  total_notes INTEGER DEFAULT 0,    -- Notas sintetizadas
  avg_frequency REAL DEFAULT 0,     -- Promedio Hz de la sesión
  FOREIGN KEY(performer_id) REFERENCES performers(id)
);

-- Cada interacción individual
CREATE TABLE synth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,       -- 'note' | 'spawn_ball'
  note TEXT,                      -- Ej: 'C5', 'A3' (null en spawn_ball)
  frequency REAL DEFAULT 0,       -- Hz de la nota
  velocity REAL DEFAULT 0,        -- Intensidad 0.0–1.0
  payload_json TEXT DEFAULT '{}', -- Datos extra {synth, source, ring}
  created_at TEXT NOT NULL,
  FOREIGN KEY(session_id) REFERENCES jam_sessions(id)
);
```

**Explicación:** 4 tablas con relaciones por FOREIGN KEY. `performers` → `jam_sessions` (1:N), `jam_sessions` → `synth_events` (1:N), `performers` → `compositions` (1:N). Los campos JSON se guardan como TEXT y se parsean con `json.loads()`.

### 6.2 Leaderboard con LEFT JOIN + GROUP BY

```sql
SELECT
    p.id, p.name, p.dni,
    COUNT(s.id) AS sessions,
    COALESCE(SUM(s.total_hits), 0) AS hits,
    COALESCE(SUM(s.total_notes), 0) AS notes
FROM performers p
LEFT JOIN jam_sessions s ON s.performer_id = p.id
GROUP BY p.id, p.name, p.dni
ORDER BY notes DESC, hits DESC, sessions DESC
LIMIT 10
```

**Explicación:**
- `LEFT JOIN` → incluye performers SIN sesiones (aparecen con 0).
- `COALESCE(SUM(...), 0)` → si SUM es NULL (0 sesiones), devuelve 0 en vez de NULL.
- `GROUP BY` → agrupa todas las filas del mismo performer para que COUNT y SUM funcionen.
- `ORDER BY notes DESC` → el que más notas haya sintetizado va primero.

### 6.3 Endpoint de evento con telemetría

```python
@app.post("/api/sessions/event")
def log_event():
    body = request.get_json(silent=True) or {}
    session_id = body.get("sessionId")
    event_type = str(body.get("eventType", "")).strip()
    note = str(body.get("note", "")).strip() or None
    frequency = float(body.get("frequency", 0) or 0)
    velocity = float(body.get("velocity", 0) or 0)
    payload = body.get("payload", {})

    with get_db() as conn:
        conn.execute(
            """INSERT INTO synth_events
               (session_id, event_type, note, frequency, velocity, payload_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (session_id, event_type, note, frequency, velocity,
             json.dumps(payload, ensure_ascii=False), now_iso()),
        )

    return jsonify({"ok": True})
```

**Explicación:** Registra CADA nota tocada o bola lanzada. `ensure_ascii=False` permite almacenar caracteres Unicode en el JSON. La telemetría es la base del leaderboard y las métricas.

### 6.4 Seed de datos demo

```python
def seed_compositions():
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) AS n FROM compositions").fetchone()["n"]
        if total:
            return  # Ya hay datos, no duplicar

        performer = conn.execute(
            "INSERT INTO performers (name, dni, created_at) VALUES (?, ?, ?)",
            ("Demo", "00000000X", now_iso()),
        ).lastrowid

        demo_grid = [
            [1 if c in {0, 4} and r in {0, 2, 4} else 0 for c in range(16)]
            for r in range(7)
        ]

        conn.execute(
            "INSERT INTO compositions (...) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (performer, "Demo Orbit", 108, "triangle",
             json.dumps(demo_grid), json.dumps(demo_scene), now_iso()),
        )
```

**Explicación:** Se ejecuta al iniciar la app. Si la BD está vacía, crea un performer "Demo" y una composición con un patrón de grid prediseñado. La list comprehension genera la matriz 7×16 con 1s en posiciones específicas.

---

## 7. Telemetría y cierre de sesión

### 7.1 Enviar evento desde el frontend

```javascript
// Se llama desde playTone() automáticamente
if (state.sessionId) {
  api("/api/sessions/event", {
    method: "POST",
    body: JSON.stringify({
      sessionId: state.sessionId,
      eventType: "note",
      note,
      frequency,
      velocity,
      payload: { source, synth: state.synthType },
    }),
  }).catch(() => {});  // Fire-and-forget (no bloquea la UI)
}
```

**Explicación:** `.catch(() => {})` ignora errores de red silenciosamente. La telemetría es "fire-and-forget": no debe bloquear la experiencia de uso si falla.

### 7.2 sendBeacon al cerrar pestaña

```javascript
window.addEventListener("beforeunload", () => {
  if (state.sessionId) {
    navigator.sendBeacon(
      "/api/sessions/end",
      JSON.stringify({
        sessionId: state.sessionId,
        totalHits: state.totalHits,
        totalNotes: state.totalNotes,
        avgFrequency: state.totalNotes
          ? state.frequencyAcc / state.totalNotes
          : 0,
      }),
    );
  }
});
```

**Explicación:**
- `beforeunload` se dispara cuando el usuario cierra la pestaña o navega fuera.
- `navigator.sendBeacon()` envía datos de forma **asíncrona sin bloquear** el cierre. A diferencia de `fetch()`, el navegador garantiza que se envíe incluso si la página ya se está cerrando.
- Calcula el promedio de frecuencia: `frequencyAcc / totalNotes` (suma de Hz / total de notas).

---

## 8. Estado del cliente

```javascript
const state = {
  performerId: null,     // ID del performer registrado
  performerName: "",     // Nombre
  sessionId: null,       // Sesión activa (null si no registrado)
  audioCtx: null,        // AudioContext (se crea con interacción)
  masterGain: null,      // GainNode maestro
  synthType: "triangle", // Tipo de oscilador actual
  bpm: 108,              // Beats por minuto
  seqTimer: null,        // ID del setInterval del secuenciador
  step: 0,               // Paso actual del secuenciador (0–15)
  totalHits: 0,          // Colisiones en esta sesión
  totalNotes: 0,         // Notas tocadas en esta sesión
  frequencyAcc: 0,       // Acumulador de Hz para promedio
};
```

**Explicación:** Todo el estado mutable de la aplicación en un solo objeto. Patrón sencillo sin frameworks. `frequencyAcc` acumula las frecuencias (Hz) de todas las notas para calcular el promedio al cerrar sesión.

---

## 9. CSS — Design System

### 9.1 Custom Properties

```css
:root {
  --bg: #0e1226;
  --panel: #1a2040;
  --panel2: #212a52;
  --line: #364175;
  --text: #eaf0ff;
  --muted: #99a7db;
  --ok: #42e5c2;
  --warn: #ffd166;
}
```

**Explicación:** Variables CSS globales. Se acceden con `var(--bg)`. Cambiar una variable actualiza todos los elementos que la usan. El esquema de color es oscuro (laboratorio/espacio).

### 9.2 Layout con Grid

```css
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;  /* Panel izdo más ancho */
  gap: 16px;
  padding: 16px;
}

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }  /* Una columna en móvil */
}
```

**Explicación:** `1.2fr 0.8fr` distribuye el espacio: 60% para el canvas, 40% para los controles. En pantallas menores a 1100px, pasa a una columna vertical.

### 9.3 Celdas del grid del secuenciador

```css
#grid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  gap: 4px;
}

.cell {
  aspect-ratio: 1/1;
  border: 1px solid #3f4b84;
  border-radius: 4px;
  background: #141a35;
}

.cell.active {
  background: #36c2ff;
  box-shadow: 0 0 10px rgba(54, 194, 255, 0.6);  /* Glow azul */
}
```

**Explicación:** `repeat(16, 1fr)` crea 16 columnas iguales. `aspect-ratio: 1/1` fuerza celdas cuadradas. `.active` tiene un box-shadow que simula brillo neón.

---

## 10. Fórmulas clave

**Frecuencia de una nota musical:**
$$f = 440 \times 2^{(n - 69) / 12}$$

**Distancia euclidiana (colisión):**
$$d = \sqrt{(\Delta x)^2 + (\Delta y)^2}$$

**Reflexión especular:**
$$\vec{v'} = \vec{v} - 2(\vec{v} \cdot \hat{n})\hat{n}$$

**BPM a intervalo (ms por step):**
$$\text{interval} = \frac{60000}{\text{BPM} \times 4}$$

**Promedio de frecuencia de sesión:**
$$\bar{f} = \frac{\sum_{i=1}^{n} f_i}{n}$$

---

## 11. Preguntas frecuentes de examen

**P: ¿Qué es un OscillatorNode?**
R: Es un nodo de Web Audio API que genera ondas sonoras periódicas. Tiene 4 tipos: `sine` (pura), `triangle` (armónica), `sawtooth` (rica en armónicos), `square` (retro). Es **desechable**: una vez que llamas a `.stop()`, no se puede reutilizar.

**P: ¿Por qué exponentialRamp y no linearRamp?**
R: El oído humano percibe el volumen de forma logarítmica, no lineal. `exponentialRamp` produce transiciones de volumen que suenan naturales. Además, `exponentialRamp` NO puede llegar a 0 (usamos 0.0001).

**P: ¿Qué es AudioContext.currentTime?**
R: Es un reloj de alta precisión (en segundos) que avanza desde que se crea el AudioContext. Toda la programación de audio usa este reloj, no `Date.now()`, porque es más preciso (microsegundos vs milisegundos).

**P: ¿Cómo se detecta qué nota golpea la bola?**
R: Se calcula el ángulo con `Math.atan2`, se normaliza a 0–2π, y se divide entre el arco por nota (`2π/7`). El resultado entero es el índice de la nota en el array.

**P: ¿Por qué normalizar posiciones al guardar composiciones?**
R: Porque si el canvas cambia de tamaño (ej: responsive), las posiciones en píxeles dejarían de ser válidas. Guardando fracciones (0.0–1.0), al cargar se multiplica por el tamaño actual.

**P: ¿Qué ventaja tiene sendBeacon sobre fetch?**
R: `sendBeacon()` garantiza que los datos se envíen incluso cuando la página se está cerrando. `fetch()` puede ser cancelado por el navegador al cerrar la pestaña.

**P: ¿Por qué requestAnimationFrame para render y setInterval para física?**
R: `requestAnimationFrame` se sincroniza con el refrescado de pantalla (~60 FPS) y se pausa en pestañas inactivas. La física usa `setInterval` porque debe seguir calculando aunque no se dibuje.

**P: ¿Qué es la reflexión especular?**
R: Es una fórmula de física que calcula la nueva dirección de un objeto que rebota. Se usa el vector normal de la superficie y el producto punto para "espejear" la velocidad.

---

## 12. Checklist pre-examen

- [x] Crear `AudioContext` + `createOscillator()` + `createGain()`
- [x] Programar envolvente Attack-Decay con `exponentialRampToValueAtTime`
- [x] Conocer los 4 tipos de oscilador y sus diferencias sonoras
- [x] `Math.atan2` para calcular ángulo de colisión
- [x] Reflexión especular con producto punto
- [x] `requestAnimationFrame` vs `setInterval` — cuándo usar cada uno
- [x] `createRadialGradient` para efecto glow en Canvas
- [x] `getBoundingClientRect()` para coordenadas relativas al canvas
- [x] Grid 16×7 con CSS Grid + `repeat(16, 1fr)`
- [x] Serializar/deserializar con `json.dumps()` / `json.loads()`
- [x] `navigator.sendBeacon()` para datos en `beforeunload`
- [x] `LEFT JOIN` + `GROUP BY` + `COALESCE` para leaderboard
- [x] Normalizar posiciones (px → fracciones 0–1) para persistencia
- [x] Fórmula BPM → ms: `60000 / bpm / 4`
- [x] Parámetros `?` en SQLite para prevenir SQL injection

---

*Documento generado para el examen de PMDM — Synth Orbit Lab*
*Luis Jahir Rodriguez Cedeño · 53945291X · DAM2 2025/26*
