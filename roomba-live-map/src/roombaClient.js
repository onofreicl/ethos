'use strict';

const { EventEmitter } = require('node:events');

/*
 * Wraps the local-MQTT connection to a Roomba and emits a normalized
 * `telemetry` event so the rest of the app does not depend on the exact
 * shape of dorita980's messages (which varies between firmware versions).
 *
 * Events:
 *   'telemetry' -> { pose, mission, battery, bin, ts }
 *   'status'    -> { connected: boolean, detail?: string }
 */
class RoombaClient extends EventEmitter {
  constructor() {
    super();
    this.robotState = {};
  }

  // Merge the latest reported fields, then emit a telemetry snapshot if the
  // update carried anything worth drawing.
  _ingestReported(reported) {
    if (!reported || typeof reported !== 'object') return;
    Object.assign(this.robotState, reported);

    const interesting =
      'pose' in reported || 'cleanMissionStatus' in reported || 'batPct' in reported;
    if (interesting) this._emitTelemetry();
  }

  _emitTelemetry() {
    const s = this.robotState;
    this.emit('telemetry', {
      pose: s.pose || null,
      mission: s.cleanMissionStatus || null,
      battery: typeof s.batPct === 'number' ? s.batPct : null,
      bin: s.bin || null,
      ts: Date.now(),
    });
  }

  connect({ blid, password, ip }) {
    let dorita980;
    try {
      dorita980 = require('dorita980');
    } catch (err) {
      this.emit('status', { connected: false, detail: 'dorita980 not installed' });
      throw err;
    }

    const robot = new dorita980.Local(blid, password, ip);
    this.robot = robot;

    robot.on('connect', () => {
      this.emit('status', { connected: true });
    });
    robot.on('close', () => {
      this.emit('status', { connected: false, detail: 'connection closed' });
    });
    robot.on('offline', () => {
      this.emit('status', { connected: false, detail: 'robot offline' });
    });
    robot.on('error', (err) => {
      this.emit('status', { connected: false, detail: err.message || 'mqtt error' });
    });

    // `update` carries only the fields that changed in this packet, so it is
    // emitted exactly when there is something new to draw.
    robot.on('update', (msg) => {
      const reported = msg && msg.state && msg.state.reported;
      this._ingestReported(reported);
    });

    return this;
  }

  async disconnect() {
    if (this.robot && typeof this.robot.end === 'function') {
      try {
        await this.robot.end();
      } catch {
        /* ignore errors while shutting down */
      }
    }
  }
}

/*
 * A simulated robot that walks a back-and-forth cleaning pattern. Lets the UI
 * be developed and demoed without a Roomba on the LAN. Enabled with --mock.
 */
class MockRoombaClient extends EventEmitter {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.dirX = 1;
    this.battery = 100;
    this.step = 250; // mm per tick
    this.maxX = 4000; // mm
    this.rowGap = 300; // mm
  }

  connect() {
    this.emit('status', { connected: true, detail: 'mock robot' });
    this.timer = setInterval(() => this._tick(), 1000);
    return this;
  }

  _tick() {
    this.x += this.step * this.dirX;
    let theta = this.dirX > 0 ? 0 : 180;

    if (this.x >= this.maxX || this.x <= 0) {
      this.x = Math.max(0, Math.min(this.maxX, this.x));
      this.y += this.rowGap;
      this.dirX *= -1;
      theta = 90;
    }

    this.battery = Math.max(0, this.battery - 0.15);

    this.emit('telemetry', {
      pose: { theta, point: { x: this.x, y: this.y } },
      mission: { cycle: 'clean', phase: 'run' },
      battery: Math.round(this.battery),
      bin: { present: true, full: false },
      ts: Date.now(),
    });
  }

  async disconnect() {
    if (this.timer) clearInterval(this.timer);
    this.emit('status', { connected: false, detail: 'mock stopped' });
  }
}

module.exports = { RoombaClient, MockRoombaClient };
