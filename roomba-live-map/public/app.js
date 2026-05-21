'use strict';

// --- state ----------------------------------------------------------------
const points = []; // { x, y, theta } in robot millimetres, dock at (0,0)
let robot = null; // latest pose
let dirty = true;

// view transform: screenX = worldX * scale + ox ; screenY = -worldY * scale + oy
const view = { scale: 0.05, ox: 0, oy: 0, auto: true };

const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');
let cssW = 0;
let cssH = 0;

// --- DOM refs -------------------------------------------------------------
const el = {
  conn: document.getElementById('conn'),
  connLabel: document.getElementById('conn-label'),
  mockTag: document.getElementById('mock-tag'),
  battery: document.getElementById('battery'),
  phase: document.getElementById('phase'),
  bin: document.getElementById('bin'),
  count: document.getElementById('count'),
};

// --- canvas sizing --------------------------------------------------------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  cssW = rect.width;
  cssH = rect.height;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dirty = true;
}
window.addEventListener('resize', resize);

// --- view fitting ---------------------------------------------------------
function fitView() {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const spanX = Math.max(maxX - minX, 1000);
  const spanY = Math.max(maxY - minY, 1000);
  const pad = 1.25;
  view.scale = Math.min(cssW / (spanX * pad), cssH / (spanY * pad));

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  view.ox = cssW / 2 - cx * view.scale;
  view.oy = cssH / 2 + cy * view.scale;
}

const toScreen = (x, y) => ({
  x: x * view.scale + view.ox,
  y: -y * view.scale + view.oy,
});

// --- rendering ------------------------------------------------------------
function render() {
  if (dirty) {
    if (view.auto) fitView();
    draw();
    dirty = false;
  }
  requestAnimationFrame(render);
}

function draw() {
  ctx.clearRect(0, 0, cssW, cssH);

  // dock at the origin
  const dock = toScreen(0, 0);
  ctx.fillStyle = '#8b93a7';
  ctx.fillRect(dock.x - 5, dock.y - 5, 10, 10);
  ctx.fillStyle = '#8b93a7';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('dock', dock.x + 9, dock.y + 4);

  // travelled path
  if (points.length > 1) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const s = toScreen(points[i].x, points[i].y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    }
    ctx.strokeStyle = '#4fd1c5';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // current robot position + heading
  if (robot) {
    const s = toScreen(robot.x, robot.y);
    const rad = ((robot.theta || 0) * Math.PI) / 180;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(rad) * 16, s.y - Math.sin(rad) * 16);
    ctx.strokeStyle = '#3ddc84';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#3ddc84';
    ctx.fill();
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// --- HUD ------------------------------------------------------------------
function setConnection(wsOpen, robotConnected) {
  let live = false;
  let label = 'reconnecting…';
  if (wsOpen) {
    live = robotConnected;
    label = robotConnected ? 'live' : 'waiting for robot';
  }
  el.conn.className = `dot ${live ? 'dot-on' : 'dot-off'}`;
  el.connLabel.textContent = label;
}

function applyTelemetry(t) {
  if (typeof t.battery === 'number') el.battery.textContent = `${t.battery}%`;
  if (t.mission && t.mission.phase) el.phase.textContent = t.mission.phase;
  if (t.bin) el.bin.textContent = t.bin.full ? 'full' : t.bin.present ? 'ok' : 'none';

  if (t.pose && t.pose.point) {
    robot = { x: t.pose.point.x, y: t.pose.point.y, theta: t.pose.theta };
    points.push(robot);
    el.count.textContent = String(points.length);
    dirty = true;
  }
}

// --- websocket ------------------------------------------------------------
let ws;
let robotConnected = false;

function connect() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.addEventListener('open', () => setConnection(true, robotConnected));

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.type === 'history') {
      el.mockTag.hidden = !msg.mock;
      robotConnected = msg.connected;
      points.length = 0;
      for (const p of msg.points) points.push(p);
      if (points.length) {
        robot = points[points.length - 1];
        el.count.textContent = String(points.length);
      }
      applyTelemetry({ mission: msg.mission, battery: msg.battery, bin: msg.bin });
      setConnection(true, robotConnected);
      dirty = true;
    } else if (msg.type === 'telemetry') {
      applyTelemetry(msg);
    } else if (msg.type === 'status') {
      robotConnected = msg.connected;
      setConnection(true, robotConnected);
    }
  });

  ws.addEventListener('close', () => {
    setConnection(false, false);
    setTimeout(connect, 2000);
  });

  ws.addEventListener('error', () => ws.close());
}

// --- controls -------------------------------------------------------------
document.getElementById('clear').addEventListener('click', () => {
  points.length = 0;
  robot = null;
  el.count.textContent = '0';
  view.auto = true;
  dirty = true;
});

document.getElementById('recenter').addEventListener('click', () => {
  view.auto = true;
  dirty = true;
});

// drag to pan
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  view.auto = false;
  view.ox += e.clientX - drag.x;
  view.oy += e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  dirty = true;
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});

// wheel / trackpad zoom (focal point stays put)
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    view.auto = false;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    view.ox = px - (px - view.ox) * factor;
    view.oy = py - (py - view.oy) * factor;
    view.scale *= factor;
    dirty = true;
  },
  { passive: false }
);

// --- boot -----------------------------------------------------------------
resize();
requestAnimationFrame(render);
connect();
