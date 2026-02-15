const state = {
  performerId: null,
  performerName: "",
  sessionId: null,
  audioCtx: null,
  masterGain: null,
  synthType: "triangle",
  bpm: 108,
  seqTimer: null,
  step: 0,
  totalHits: 0,
  totalNotes: 0,
  frequencyAcc: 0,
};

const notesRows = ["C5", "B4", "A4", "G4", "F4", "E4", "D4"];
const noteFreq = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
};

const ringA = ["C3", "D3", "E3", "F3", "G3", "A3", "B3"];
const ringB = ["C5", "D5", "E5", "F5", "G5", "A5", "B5"];

const gridRows = 7;
const gridCols = 16;
let grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));

const stage = document.getElementById("stage");
const ctx = stage.getContext("2d");

const el = {
  performerName: document.getElementById("performerName"),
  performerDni: document.getElementById("performerDni"),
  btnRegister: document.getElementById("btnRegister"),
  bpm: document.getElementById("bpm"),
  synthType: document.getElementById("synthType"),
  btnPlaySeq: document.getElementById("btnPlaySeq"),
  btnStopSeq: document.getElementById("btnStopSeq"),
  btnClearBalls: document.getElementById("btnClearBalls"),
  status: document.getElementById("status"),
  grid: document.getElementById("grid"),
  saveForm: document.getElementById("saveForm"),
  stats: document.getElementById("stats"),
  leaders: document.getElementById("leaders"),
  compositions: document.getElementById("compositions"),
};

let width = stage.width;
let height = stage.height;
let centers = computeCenters();
let balls = [];

let drag = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };

function computeCenters() {
  return {
    leftX: width * 0.32,
    rightX: width * 0.68,
    centerY: height * 0.53,
    radius: Math.min(width, height) * 0.3,
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Error de API");
  }
  return data;
}

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

function playTone(note, frequency, velocity = 0.6, duration = 0.3, source = "manual") {
  ensureAudio();
  const now = state.audioCtx.currentTime;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = state.synthType;
  osc.frequency.setValueAtTime(frequency, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.05, velocity), now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(state.masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.02);

  state.totalNotes += 1;
  state.frequencyAcc += frequency;

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
    }).catch(() => {});
  }
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function ringOfPoint(x, y) {
  const dL = distance(x, y, centers.leftX, centers.centerY);
  const dR = distance(x, y, centers.rightX, centers.centerY);
  if (dL <= centers.radius) return "left";
  if (dR <= centers.radius) return "right";
  return null;
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#0b1028");
  grad.addColorStop(1, "#161f48");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawRing(cx, cy, notes, color) {
  const arc = (Math.PI * 2) / notes.length;
  ctx.lineWidth = 5;

  for (let i = 0; i < notes.length; i += 1) {
    ctx.strokeStyle = color(i);
    ctx.beginPath();
    ctx.arc(cx, cy, centers.radius, i * arc, (i + 1) * arc);
    ctx.stroke();
  }

  ctx.strokeStyle = "#c5d4ff33";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, centers.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBalls() {
  for (const ball of balls) {
    const glow = ctx.createRadialGradient(ball.x, ball.y, 2, ball.x, ball.y, ball.radius * 2.2);
    glow.addColorStop(0, ball.color);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDragPreview() {
  if (!drag.active) return;
  ctx.strokeStyle = "#ffffff88";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(drag.x0, drag.y0);
  ctx.lineTo(drag.x1, drag.y1);
  ctx.stroke();
}

function spawnBall(x, y, dx, dy, ring) {
  balls.push({
    x,
    y,
    dx,
    dy,
    ring,
    radius: 10 + Math.random() * 3,
    color: ring === "left" ? "#66d9ff" : "#ff79c6",
  });
}

function collideBall(ball) {
  const cx = ball.ring === "left" ? centers.leftX : centers.rightX;
  const cy = centers.centerY;
  const notes = ball.ring === "left" ? ringA : ringB;

  const d = distance(ball.x, ball.y, cx, cy);
  if (d + ball.radius < centers.radius) return;

  const angle = Math.atan2(ball.y - cy, ball.x - cx);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const arc = (Math.PI * 2) / notes.length;
  const idx = Math.floor(normalized / arc);
  const note = notes[idx];

  state.totalHits += 1;
  playTone(note, noteFreq[note], 0.5, 0.28, "collision");

  const nx = (ball.x - cx) / d;
  const ny = (ball.y - cy) / d;
  const dot = ball.dx * nx + ball.dy * ny;
  ball.dx = ball.dx - 2 * dot * nx;
  ball.dy = ball.dy - 2 * dot * ny;

  const overlap = d + ball.radius - centers.radius;
  ball.x -= overlap * nx;
  ball.y -= overlap * ny;
}

function updatePhysics() {
  for (const ball of balls) {
    ball.x += ball.dx;
    ball.y += ball.dy;
    collideBall(ball);
  }
}

function render() {
  drawBackground();
  drawRing(centers.leftX, centers.centerY, ringA, (i) => `hsl(${190 + i * 10},90%,62%)`);
  drawRing(centers.rightX, centers.centerY, ringB, (i) => `hsl(${320 - i * 10},90%,64%)`);
  drawBalls();
  drawDragPreview();
  requestAnimationFrame(render);
}

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
        grid[r][c] = grid[r][c] ? 0 : 1;
        cell.classList.toggle("active", Boolean(grid[r][c]));
      });
      el.grid.appendChild(cell);
    }
  }
}

function markPlayingColumn(col) {
  const cells = el.grid.querySelectorAll(".cell");
  cells.forEach((node) => node.classList.remove("playing"));
  cells.forEach((node) => {
    if (Number(node.dataset.c) === col) {
      node.classList.add("playing");
    }
  });
}

function playSequencerStep() {
  markPlayingColumn(state.step);

  for (let r = 0; r < gridRows; r += 1) {
    if (!grid[r][state.step]) continue;
    const note = notesRows[r];
    playTone(note, noteFreq[note], 0.35, 0.22, "sequencer");
  }

  state.step = (state.step + 1) % gridCols;
}

function startSequencer() {
  if (state.seqTimer) return;
  ensureAudio();
  const interval = Math.max(50, Math.floor((60_000 / state.bpm) / 4));
  state.seqTimer = setInterval(playSequencerStep, interval);
  el.status.textContent = `Secuenciador activo · ${state.bpm} BPM · ${state.synthType}`;
}

function stopSequencer() {
  if (!state.seqTimer) return;
  clearInterval(state.seqTimer);
  state.seqTimer = null;
  markPlayingColumn(-1);
  el.status.textContent = "Secuenciador detenido";
}

async function refreshStats() {
  const data = await api("/api/stats");
  const s = data.stats;
  el.stats.innerHTML = `
    <div class='kpi'><strong>Performers</strong><span>${s.performers}</span></div>
    <div class='kpi'><strong>Compositions</strong><span>${s.compositions}</span></div>
    <div class='kpi'><strong>Sesiones</strong><span>${s.sessions}</span></div>
    <div class='kpi'><strong>Eventos</strong><span>${s.events}</span></div>
  `;
}

async function refreshLeaders() {
  const data = await api("/api/leaderboard");
  if (!data.leaders.length) {
    el.leaders.innerHTML = "<p>Sin datos aún.</p>";
    return;
  }
  const rows = data.leaders
    .map((row) => `<tr><td>${row.name}</td><td>${row.sessions}</td><td>${row.hits}</td><td>${row.notes}</td></tr>`)
    .join("");
  el.leaders.innerHTML = `<table class='list'><thead><tr><th>Nombre</th><th>Ses.</th><th>Hits</th><th>Notas</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function captureScene() {
  return {
    balls: balls.map((ball) => ({
      x: Number((ball.x / width).toFixed(4)),
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

function applyScene(scene) {
  if (!scene || !Array.isArray(scene.balls)) {
    balls = [];
    return;
  }
  balls = scene.balls.map((ball) => ({
    x: ball.x * width,
    y: ball.y * height,
    dx: ball.dx,
    dy: ball.dy,
    radius: ball.radius,
    ring: ball.ring,
    color: ball.ring === "left" ? "#66d9ff" : "#ff79c6",
  }));
}

async function refreshCompositions() {
  const data = await api("/api/compositions");
  if (!data.compositions.length) {
    el.compositions.innerHTML = "<p>Sin composiciones todavía.</p>";
    return;
  }

  const rows = data.compositions
    .map((item) => `<tr><td>${item.title}</td><td>${item.performer_name}</td><td>${item.bpm}</td><td><button data-load='${item.id}'>Cargar</button></td></tr>`)
    .join("");

  el.compositions.innerHTML = `<table class='list'><thead><tr><th>Título</th><th>Autor</th><th>BPM</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table>`;

  el.compositions.querySelectorAll("button[data-load]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.load);
      const res = await api(`/api/compositions/${id}`);
      const comp = res.composition;
      grid = comp.grid;
      state.bpm = comp.bpm;
      state.synthType = comp.synth_type;
      el.bpm.value = String(comp.bpm);
      el.synthType.value = comp.synth_type;
      applyScene(comp.scene);
      buildGridUI();
      el.status.textContent = `Composición cargada: ${comp.title}`;
    });
  });
}

async function registerPerformer() {
  const name = el.performerName.value.trim();
  const dni = el.performerDni.value.trim();
  const performer = await api("/api/performers/register", {
    method: "POST",
    body: JSON.stringify({ name, dni }),
  });
  state.performerId = performer.performerId;
  state.performerName = performer.name;

  const session = await api("/api/sessions/start", {
    method: "POST",
    body: JSON.stringify({ performerId: state.performerId }),
  });
  state.sessionId = session.sessionId;
  el.status.textContent = `Sesión activa para ${performer.name}`;
}

async function closeSession() {
  if (!state.sessionId) return;
  const avgFrequency = state.totalNotes ? state.frequencyAcc / state.totalNotes : 0;
  await api("/api/sessions/end", {
    method: "POST",
    body: JSON.stringify({
      sessionId: state.sessionId,
      totalHits: state.totalHits,
      totalNotes: state.totalNotes,
      avgFrequency,
    }),
  });
  state.sessionId = null;
}

function wireCanvas() {
  stage.addEventListener("mousedown", (event) => {
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const ring = ringOfPoint(x, y);
    if (!ring) return;

    ensureAudio();
    drag = { active: true, x0: x, y0: y, x1: x, y1: y, ring };
  });

  stage.addEventListener("mousemove", (event) => {
    if (!drag.active) return;
    const rect = stage.getBoundingClientRect();
    drag.x1 = event.clientX - rect.left;
    drag.y1 = event.clientY - rect.top;
  });

  stage.addEventListener("mouseup", () => {
    if (!drag.active) return;
    const dx = (drag.x0 - drag.x1) * 0.08;
    const dy = (drag.y0 - drag.y1) * 0.08;
    spawnBall(drag.x0, drag.y0, dx, dy, drag.ring);
    drag.active = false;

    if (state.sessionId) {
      api("/api/sessions/event", {
        method: "POST",
        body: JSON.stringify({
          sessionId: state.sessionId,
          eventType: "spawn_ball",
          velocity: Math.hypot(dx, dy),
          payload: { ring: drag.ring },
        }),
      }).catch(() => {});
    }
  });
}

function wireEvents() {
  el.btnRegister.addEventListener("click", () => {
    registerPerformer()
      .then(() => Promise.all([refreshStats(), refreshLeaders()]))
      .catch((error) => {
        el.status.textContent = `Error registro: ${error.message}`;
      });
  });

  el.bpm.addEventListener("change", () => {
    state.bpm = Number(el.bpm.value || 108);
    if (state.seqTimer) {
      stopSequencer();
      startSequencer();
    }
  });

  el.synthType.addEventListener("change", () => {
    state.synthType = el.synthType.value;
  });

  el.btnPlaySeq.addEventListener("click", startSequencer);
  el.btnStopSeq.addEventListener("click", stopSequencer);
  el.btnClearBalls.addEventListener("click", () => {
    balls = [];
  });

  el.saveForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.performerId) {
      el.status.textContent = "Registra performer antes de guardar.";
      return;
    }
    const formData = new FormData(el.saveForm);
    const title = String(formData.get("title") || "").trim();
    if (!title) return;

    await api("/api/compositions", {
      method: "POST",
      body: JSON.stringify({
        performerId: state.performerId,
        title,
        bpm: state.bpm,
        synthType: state.synthType,
        grid,
        scene: captureScene(),
      }),
    });

    el.saveForm.reset();
    el.status.textContent = `Composición guardada: ${title}`;
    await refreshCompositions();
    await refreshStats();
  });

  window.addEventListener("beforeunload", () => {
    if (state.sessionId) {
      navigator.sendBeacon(
        "/api/sessions/end",
        JSON.stringify({
          sessionId: state.sessionId,
          totalHits: state.totalHits,
          totalNotes: state.totalNotes,
          avgFrequency: state.totalNotes ? state.frequencyAcc / state.totalNotes : 0,
        }),
      );
    }
  });
}

async function boot() {
  wireEvents();
  wireCanvas();
  buildGridUI();
  render();
  setInterval(updatePhysics, 16);

  await refreshStats();
  await refreshLeaders();
  await refreshCompositions();
}

boot().catch((error) => {
  el.status.textContent = `Error de inicialización: ${error.message}`;
});
