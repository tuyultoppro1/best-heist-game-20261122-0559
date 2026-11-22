// The game's rules and state, with no drawing and no browser in it: the thief, the guards, the
// cameras, the alarm meter, the loot and the exit. step() advances one fixed step and returns
// what happened as bit flags, so the caller can react (and play sounds) without the world
// knowing about screens or audio.
import { ALARM, CAMERA, GUARD, LOOT, SCORES, SMOKE, STEP } from './config.js';
import { buildLevel } from './levels.js';
import { createCameras, updateCameras } from './cameras.js';
import { createGuards, updateGuards } from './guards.js';
import { createThief, nearestLoot, throwSmoke, tryPickup, updateThief } from './thief.js';

export const EVENT_PICKUP = 1;
export const EVENT_SMASH = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_VICTORY = 8;
export const EVENT_SMOKE = 16;
export const EVENT_STEP = 32;
export const EVENT_ALARM = 64;

export function createWorld(random) {
  const state = {
    level: null,
    thief: null,
    guards: [],
    cameras: [],
    smokes: [],
    alarm: 0,
    alarmPeak: 0,
    time: 0,
    score: 0,
    exitOpen: false,
    over: false,
    overTitle: '',
    overReason: '',
    victory: false,
    lockdownTimer: 0,
    nearLoot: null,
    cameraSpotting: false,
    alarmSoundTimer: 0,
  };

  function reset() {
    state.level = buildLevel();
    state.thief = createThief(state.level.start);
    state.guards = createGuards(state.level.guards);
    state.cameras = createCameras(state.level.cameras);
    state.smokes = [];
    state.alarm = 0;
    state.alarmPeak = 0;
    state.time = 0;
    state.score = 0;
    state.exitOpen = false;
    state.over = false;
    state.overTitle = '';
    state.overReason = '';
    state.victory = false;
    state.lockdownTimer = 0;
    state.nearLoot = null;
    state.cameraSpotting = false;
    state.alarmSoundTimer = 0;
    void random;
  }

  function endRun(title, reason) {
    state.over = true;
    state.overTitle = title;
    state.overReason = reason;
  }

  /**
   * One fixed step. `keys` is {x, y, sneak}; `click` is a canvas point or null; `actions` is
   * { pickup: bool, smoke: bool }. With `harmless` set (the title screen's backdrop) the
   * guards patrol but nothing can catch the thief and the alarm never rises.
   */
  function step(dt, keys, click, actions, harmless) {
    let events = 0;
    const thief = state.thief;
    const level = state.level;

    if (!harmless) state.time += dt;

    updateThief(thief, level, keys, click, dt);
    if (thief.stepSound) {
      thief.stepSound = false;
      events |= EVENT_STEP;
    }

    // The centre-case channel: hold still by the case and the glass gives way.
    if (thief.channel) {
      thief.channel.progress += dt;
      if (thief.channel.progress >= thief.channel.loot.channel) {
        const loot = thief.channel.loot;
        loot.taken = true;
        thief.channel = null;
        state.score += loot.score;
        events |= EVENT_SMASH;
        // Smashing glass is loud: every guard nearby turns suspicious.
        for (const guard of state.guards) {
          if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < LOOT.ledgerNoiseRadius) {
            guard.meter = Math.max(guard.meter, 0.55);
            guard.lastSeen = { x: thief.x, y: thief.y };
          }
        }
      }
    }

    if (!harmless && actions) {
      if (actions.pickup) {
        const result = tryPickup(thief, level);
        if (result && result.taken) {
          state.score += result.taken.score;
          events |= EVENT_PICKUP;
        }
      }
      if (actions.smoke && throwSmoke(thief)) {
        state.smokes.push({ x: thief.x, y: thief.y, radius: SMOKE.radius, timeLeft: SMOKE.seconds });
        events |= EVENT_SMOKE;
      }
    }

    // Smoke clouds thin out.
    for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
      state.smokes[i].timeLeft -= dt;
      if (state.smokes[i].timeLeft <= 0) state.smokes.splice(i, 1);
    }

    const dummyThief = harmless ? { ...thief, hidden: true, x: level.vent.x + 10, y: level.vent.y + 10 } : thief;
    const caught = updateGuards(state.guards, dummyThief, level, state.smokes, dt);
    state.cameraSpotting = updateCameras(state.cameras, dummyThief, level, state.smokes, dt);

    if (!harmless) {
      // The alarm meter: rises while any watcher is suspicious, alerted or spotting, and
      // drains slowly while the thief is unseen.
      const anyAlerted = state.guards.some((g) => g.state === 'alerted');
      const anySuspicious = state.guards.some((g) => g.state === 'suspicious' || g.state === 'search');
      let rate = -ALARM.decay;
      if (anyAlerted) rate = ALARM.riseAlerted;
      else if (anySuspicious) rate = ALARM.riseSuspicious;
      if (state.cameraSpotting) rate = Math.max(rate, CAMERA.alarmRate);
      state.alarm = Math.max(0, Math.min(ALARM.max, state.alarm + rate * dt));
      state.alarmPeak = Math.max(state.alarmPeak, state.alarm);
      state.alarmSoundTimer -= dt;
      if ((anyAlerted || state.cameraSpotting) && state.alarmSoundTimer <= 0) {
        state.alarmSoundTimer = 1.1;
        events |= EVENT_ALARM;
      }

      if (caught === 'caught') {
        endRun('CAUGHT!', 'A guard laid hands on the thief.');
        return events | EVENT_CAUGHT;
      }

      // Alarm full: a short flashing grace, then the museum seals and the run ends.
      if (state.alarm >= ALARM.max && state.lockdownTimer === 0) state.lockdownTimer = ALARM.lockdownGrace;
      if (state.lockdownTimer > 0) {
        state.lockdownTimer -= dt;
        if (state.lockdownTimer <= 0) {
          endRun('LOCKDOWN!', 'The alarm hit 100% — the museum sealed itself.');
          return events | EVENT_CAUGHT;
        }
      }

      // All loot taken opens the exit; reaching it is the getaway.
      if (!state.exitOpen && level.loot.every((l) => l.taken)) state.exitOpen = true;
      if (state.exitOpen) {
        const e = level.exit;
        if (thief.x >= e.x && thief.x <= e.x + e.w && thief.y >= e.y && thief.y <= e.y + e.h) {
          state.victory = true;
          state.score += Math.max(0, 300 - Math.floor(state.time));
          return events | EVENT_VICTORY;
        }
      }
    }

    state.nearLoot = harmless ? null : nearestLoot(thief, level);
    return events;
  }

  reset();
  return { state, reset, step };
}

// Re-exported so the playtest can drive a fixed step without importing config.
export { STEP };
