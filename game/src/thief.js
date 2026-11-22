// The thief: movement (keys or click-to-move), sneaking, loot pickup and smoke pellets.
import { LOOT, SMOKE, THIEF } from './config.js';
import { inShadow, inVent, moveCircle } from './levels.js';

export function createThief(start) {
  return {
    x: start.x,
    y: start.y,
    radius: THIEF.radius,
    facing: 0,
    sneaking: false,
    moving: false,
    hidden: false, // inside the vent: no watcher can see the thief at all
    inShade: false,
    clickTarget: null,
    channel: null, // { loot, progress } while the centre case is being opened
    smokeCharges: SMOKE.charges,
    stepTimer: 0,
    stepSound: false, // set for one frame when a footstep should sound
  };
}

/**
 * Advance the thief one fixed step. `keys` is {x, y, sneak}; `click` is a canvas point or
 * null. Returns 'step' on a footstep, 'smoke' when a pellet is thrown, else null.
 */
export function updateThief(thief, level, keys, click, dt, onSmoke) {
  thief.sneaking = !!keys.sneak;
  const speed = thief.sneaking ? THIEF.sneakSpeed : THIEF.walkSpeed;
  let dx = 0;
  let dy = 0;
  if (keys.x !== 0 || keys.y !== 0) {
    dx = keys.x;
    dy = keys.y;
    thief.clickTarget = null; // keys always win over a click target
  } else if (thief.clickTarget) {
    const tx = thief.clickTarget.x - thief.x;
    const ty = thief.clickTarget.y - thief.y;
    const dist = Math.hypot(tx, ty);
    if (dist < 8) {
      thief.clickTarget = null;
    } else {
      dx = tx / dist;
      dy = ty / dist;
    }
  }
  const len = Math.hypot(dx, dy);
  thief.moving = len > 0;
  if (len > 0) {
    const step = (thief.clickTarget ? THIEF.clickSpeed : speed) * dt;
    moveCircle(thief, (dx / len) * step, (dy / len) * step, level.solids);
    thief.facing = Math.atan2(dy, dx);
    thief.stepTimer += dt;
    if (thief.stepTimer > (thief.sneaking ? 0.55 : 0.38)) {
      thief.stepTimer = 0;
      thief.stepSound = true;
    }
  }
  if (click) thief.clickTarget = click;
  thief.hidden = inVent(level, thief.x, thief.y);
  thief.inShade = inShadow(level, thief.x, thief.y);
  if (thief.channel) {
    // Moving or leaving the case's reach cancels the smash.
    const loot = thief.channel.loot;
    if (Math.hypot(loot.x - thief.x, loot.y - thief.y) > LOOT.pickupRadius + 12 || thief.moving) {
      thief.channel = null;
    }
  }
  return null;
}

/** The nearest loot the thief can reach, or null. */
export function nearestLoot(thief, level) {
  let best = null;
  let bestDist = Infinity;
  for (const loot of level.loot) {
    if (loot.taken) continue;
    const d = Math.hypot(loot.x - thief.x, loot.y - thief.y);
    if (d < LOOT.pickupRadius && d < bestDist) {
      best = loot;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Press E: start opening the centre case (a channel) or pocket a small loot at once.
 * Returns the loot taken instantly, the loot whose channel started, or null.
 */
export function tryPickup(thief, level) {
  const loot = nearestLoot(thief, level);
  if (!loot) return null;
  if (loot.channel > 0) {
    if (!thief.channel) thief.channel = { loot, progress: 0 };
    return { started: loot };
  }
  loot.taken = true;
  return { taken: loot };
}

/** Throw a smoke pellet at the thief's feet. Returns true when one was left to throw. */
export function throwSmoke(thief) {
  if (thief.smokeCharges <= 0) return false;
  thief.smokeCharges -= 1;
  return true;
}
