# Roomba Live Map

Shows your Roomba's cleaning progress — path travelled and current position —
**while it's vacuuming**, by tapping the robot's local MQTT stream directly.
The official iRobot app only shows the map after a mission ends; this renders
it live (~1 pose update/sec).

This is **Path A** from the project brief: a self-contained Node.js app
(`dorita980` + WebSocket + HTML canvas). No cloud account or internet needed —
it talks to the robot over the LAN.

## Requirements

- Node.js >= 20.6
- An always-on host on the **same LAN** as the robot (an old laptop is fine).
- A Wi-Fi Roomba with local MQTT: **900-series and i-series work well.**
  j-series and newer have locked-down firmware and may not report pose.

## Setup

```bash
cd roomba-live-map
npm install
```

### 1. Get the robot credentials

This connects to the robot and prints its `blid` and password.

```bash
npm run credentials
```

Follow the prompt: put the robot on its dock, press and hold the **HOME**
button (~2s) until it plays a tone and the Wi-Fi light flashes, then press
Enter. If auto-discovery fails, pass the IP: `npm run credentials 192.168.1.50`.

### 2. Create the `.env` file

```bash
cp .env.example .env
```

Paste the three `ROOMBA_*` values printed by the previous step into `.env`.

### 3. Run

```bash
npm start
```

Open `http://<host-ip>:3000` on your phone (same Wi-Fi network). Start a
cleaning mission and the path will draw as pose updates arrive.

## Mock mode

To develop or demo the UI without a robot, run a simulated Roomba that walks a
back-and-forth cleaning pattern:

```bash
npm run mock
```

## How it works

```
Roomba ──local MQTT──> roombaClient.js ──> server.js ──WebSocket──> browser
 (pose,                (normalizes        (path history,           (canvas
  mission,              telemetry)         broadcast)               renderer)
  battery)
```

- `scripts/get-credentials.js` — discovers the robot and extracts its
  local-MQTT password via the firmware-v2 TLS handshake.
- `src/roombaClient.js` — wraps `dorita980.Local`, emits normalized
  `telemetry` events. Includes a `MockRoombaClient` for offline development.
- `src/server.js` — serves the UI, keeps recent path history, and broadcasts
  telemetry to all connected browsers over WebSocket.
- `public/` — mobile-first canvas UI. Auto-fits the path; drag to pan, pinch
  or scroll to zoom, **Recenter** to re-fit, **Clear path** to reset.

## Notes

- Pose coordinates are millimetres relative to the dock at `(0, 0)`.
- Some i-series firmware reports pose only intermittently. If the path stays
  empty during a mission, the robot likely is not publishing `pose` — mock
  mode still lets you verify the UI.
- `npm install` reports advisories from `dorita980`'s deprecated `request`
  dependency. They are transitive and not used on the request path here.
