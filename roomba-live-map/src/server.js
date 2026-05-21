'use strict';

const http = require('node:http');
const path = require('node:path');
const express = require('express');
const { WebSocketServer } = require('ws');

const { RoombaClient, MockRoombaClient } = require('./roombaClient');

// Load .env if present (Node >= 20.12). Safe to skip if unavailable.
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch {
    /* no .env file — rely on real environment variables */
  }
}

const MOCK = process.argv.includes('--mock') || process.env.MOCK === '1';
const PORT = Number(process.env.PORT) || 3000;
const MAX_HISTORY = 8000;

// Shared state pushed to every browser that connects.
const pathHistory = [];
let latest = { mission: null, battery: null, bin: null };
let robotConnected = false;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/healthz', (_req, res) => res.json({ ok: true, mock: MOCK }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(data);
  }
}

wss.on('connection', (socket) => {
  socket.send(
    JSON.stringify({
      type: 'history',
      mock: MOCK,
      connected: robotConnected,
      points: pathHistory,
      mission: latest.mission,
      battery: latest.battery,
      bin: latest.bin,
    })
  );
});

const client = MOCK ? new MockRoombaClient() : new RoombaClient();

client.on('telemetry', (t) => {
  latest = { mission: t.mission, battery: t.battery, bin: t.bin };

  if (t.pose && t.pose.point) {
    const point = {
      x: t.pose.point.x,
      y: t.pose.point.y,
      theta: t.pose.theta,
      ts: t.ts,
    };
    pathHistory.push(point);
    if (pathHistory.length > MAX_HISTORY) pathHistory.shift();
  }

  broadcast({ type: 'telemetry', ...t });
});

client.on('status', (s) => {
  robotConnected = s.connected;
  console.log(`[roomba] ${s.connected ? 'connected' : 'disconnected'}${s.detail ? ` (${s.detail})` : ''}`);
  broadcast({ type: 'status', connected: s.connected, detail: s.detail || null });
});

function startRobot() {
  if (MOCK) {
    console.log('[roomba] starting in MOCK mode (no hardware)');
    client.connect();
    return;
  }

  const { ROOMBA_BLID, ROOMBA_PASSWORD, ROOMBA_IP } = process.env;
  if (!ROOMBA_BLID || !ROOMBA_PASSWORD || !ROOMBA_IP) {
    console.error('Missing ROOMBA_BLID / ROOMBA_PASSWORD / ROOMBA_IP.');
    console.error('Run `npm run credentials` and fill in .env, or use `npm run mock`.');
    process.exit(1);
  }

  console.log(`[roomba] connecting to ${ROOMBA_IP}`);
  client.connect({ blid: ROOMBA_BLID, password: ROOMBA_PASSWORD, ip: ROOMBA_IP });
}

server.listen(PORT, () => {
  console.log(`Live map: http://localhost:${PORT}${MOCK ? '  (mock mode)' : ''}`);
  startRobot();
});

async function shutdown() {
  console.log('\nShutting down...');
  await client.disconnect();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
