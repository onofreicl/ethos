'use strict';

/*
 * Roomba credential extraction (dorita980 v4 / firmware v2 robots:
 * i-series and 900-series).
 *
 * Discovers the robot on the LAN, reads its blid, and fetches the local-MQTT
 * password via the TLS handshake on port 8883. The robot must briefly be put
 * into pairing mode for the password step.
 *
 * Usage:
 *   node scripts/get-credentials.js            # auto-discover the robot
 *   node scripts/get-credentials.js 192.168.1.50   # use a known IP
 */

const tls = require('node:tls');
const readline = require('node:readline');
const { constants } = require('node:crypto');

let dorita980;
try {
  dorita980 = require('dorita980');
} catch (err) {
  console.error('Could not load dorita980. Run `npm install` first.');
  process.exit(1);
}

// Broadcast-discover any robot on the LAN.
function discoverRobot() {
  return new Promise((resolve, reject) => {
    console.log('Scanning the LAN for a Roomba...');
    dorita980.discovery((err, robot) => {
      if (err) return reject(err);
      resolve(robot);
    });
  });
}

// Query one known IP for its public info (includes the blid).
function getPublicInfo(ip) {
  return new Promise((resolve, reject) => {
    dorita980.getRobotPublicInfo(ip, (err, info) => {
      if (err) return reject(err);
      resolve(info);
    });
  });
}

function waitForEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

/*
 * Firmware v2 password handshake: open a TLS socket to port 8883, send the
 * magic packet, and read the password out of the response. Mirrors the
 * handshake in dorita980's own `get-roomba-password` bin script.
 */
function getPassword(ip) {
  return new Promise((resolve, reject) => {
    let sliceFrom = 13;
    const packet = Buffer.from('f005efcc3b2900', 'hex');

    const options = {
      host: ip,
      port: 8883,
      rejectUnauthorized: false,
      timeout: 10000,
      ciphers: process.env.ROBOT_CIPHERS || 'AES128-SHA256,TLS_AES_256_GCM_SHA384',
    };
    if (constants && constants.SSL_OP_LEGACY_SERVER_CONNECT) {
      options.secureOptions = constants.SSL_OP_LEGACY_SERVER_CONNECT;
    }

    const client = tls.connect(options, () => client.write(packet));
    client.setEncoding('utf-8');

    const fail = (msg) => {
      client.destroy();
      reject(new Error(msg));
    };

    client.on('data', (data) => {
      // Some firmware sends a 2-byte preamble before the real payload.
      if (data.length === 2) {
        sliceFrom = 9;
        return;
      }
      if (data.length <= 7) {
        return fail('Robot returned an error. Is it in pairing mode?');
      }
      const password = Buffer.from(data).slice(sliceFrom).toString();
      client.end();
      resolve(password);
    });

    client.on('timeout', () => fail('Timed out waiting for the robot.'));
    client.on('error', (err) => fail(err.message || String(err)));
  });
}

async function main() {
  let ip = process.argv[2];
  let blid;

  try {
    if (ip) {
      const info = await getPublicInfo(ip);
      blid = info.blid;
      console.log(`\nRobot: ${info.robotname || '(unknown)'}  model ${info.sku || '?'}`);
    } else {
      const robot = await discoverRobot();
      ip = robot.ip;
      blid = robot.hostname.split('-')[1];
      console.log(`\nFound ${robot.robotname || 'a robot'} at ${ip}`);
    }
  } catch (err) {
    console.error('Discovery failed:', err.message || err);
    console.error('Pass the IP explicitly: node scripts/get-credentials.js <ip>');
    process.exit(1);
  }

  if (!blid) {
    console.error('Could not determine the robot blid.');
    process.exit(1);
  }

  console.log('\nPut the robot into pairing mode now:');
  console.log('  1. Make sure the robot is on its dock and powered on.');
  console.log('  2. Press and hold the HOME button (~2s) until it plays a tone.');
  console.log('  3. The Wi-Fi indicator should start flashing.');
  await waitForEnter('\nPress Enter once the Wi-Fi indicator is flashing... ');

  let password;
  try {
    password = await getPassword(ip);
  } catch (err) {
    console.error('\nFailed to fetch the password:', err.message || err);
    console.error('Make sure the robot is in pairing mode and try again.');
    process.exit(1);
  }

  console.log('\nSuccess. Add these to roomba-live-map/.env:\n');
  console.log(`ROOMBA_BLID=${blid}`);
  console.log(`ROOMBA_PASSWORD=${password}`);
  console.log(`ROOMBA_IP=${ip}`);
  console.log('');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
