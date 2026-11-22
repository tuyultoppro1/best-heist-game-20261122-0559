// The screenshot scenes behind ?shot=cover|alert|loot|victory. Each one stages the real world
// deterministically — the same seed always gives the same frame — by placing the thief, the
// guards and the cameras where the scene needs them and then stepping the real rules forward a
// few seconds, so the frame is what a short game really looks like. Display values (meters,
// alarm, the case channel) are set after the stepping, so the stepping cannot wash them out.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_VICTORY } from './render.js';

const IDLE = { x: 0, y: 0, sneak: false };

function idleSteps(world, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, IDLE, null, null, false);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score to
 * show. Unknown names stage the cover.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();

  if (name === 'victory') {
    // Every loot pocketed, the thief one step from the open exit.
    for (const loot of state.level.loot) loot.taken = true;
    state.exitOpen = true;
    state.thief.x = state.level.exit.x + 10;
    state.thief.y = state.level.exit.y + state.level.exit.h / 2;
    state.score = 1200;
    state.time = 83;
    state.alarmPeak = 41;
    state.victory = true;
    return { screen: SCREEN_VICTORY, best: 1200 };
  }

  if (name === 'loot') {
    // The vase and the sapphire are pocketed; the thief is at the centre case, mid-smash, while
    // a guard turns suspicious and a camera sweeps past.
    state.level.loot[1].taken = true;
    state.level.loot[2].taken = true;
    state.score = 500;
    state.thief.x = 640;
    state.thief.y = 420;
    state.thief.facing = -Math.PI / 2;
    const guard = state.guards[1];
    guard.x = 900;
    guard.y = 260;
    guard.facing = Math.PI;
    idleSteps(world, 0.5);
    guard.meter = 0.5;
    guard.state = 'suspicious';
    guard.lastSeen = { x: 640, y: 420 };
    state.thief.channel = { loot: state.level.loot[0], progress: 0.55 };
    state.alarm = 28;
    state.alarmPeak = 28;
    return { screen: SCREEN_PLAY, best: 500 };
  }

  if (name === 'alert') {
    // A guard has the thief dead in its cone, the alarm is climbing, a camera is spotting too.
    state.thief.x = 360;
    state.thief.y = 330;
    state.thief.facing = Math.PI / 2;
    const guard = state.guards[0];
    guard.x = 360;
    guard.y = 210;
    guard.facing = Math.PI / 2;
    guard.meter = 1;
    guard.state = 'alerted';
    guard.lastSeen = { x: 360, y: 330 };
    state.alarm = 76;
    state.alarmPeak = 76;
    state.time = 47;
    idleSteps(world, 0.35);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  // Cover: the whole heist in one frame. The thief sneaks along the bottom shadow toward the
  // centre case, guards patrol with their cones sweeping, a camera watches the top gallery, the
  // ledger glows in its case and the alarm meter sits at a tense 32%.
  state.thief.x = 470;
  state.thief.y = 600;
  state.thief.facing = 0;
  state.thief.sneaking = true;
  state.time = 24;
  state.score = 200;
  state.level.loot[1].taken = true; // the vase is already pocketed
  const guard0 = state.guards[0];
  guard0.x = 300;
  guard0.y = 330;
  guard0.facing = Math.PI / 2;
  const guard1 = state.guards[1];
  guard1.x = 980;
  guard1.y = 200;
  guard1.facing = -Math.PI / 2;
  const guard2 = state.guards[2];
  guard2.x = 700;
  guard2.y = 620;
  guard2.facing = Math.PI;
  state.cameras[0].time = 1.2;
  state.cameras[1].time = 0.4;
  idleSteps(world, 0.4);
  state.alarm = 32;
  state.alarmPeak = 32;
  guard0.meter = 0.3;
  return { screen: SCREEN_PLAY, best: 200 };
}
