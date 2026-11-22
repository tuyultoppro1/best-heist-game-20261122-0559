// The guards: patrol, suspicion, alert, search. A guard's vision is a cone with a line of
// sight; sneaking, shadow and smoke all slow how fast its suspicion meter fills.
import { GUARD, SHADOW_DETECT, SNEAK_DETECT } from './config.js';
import { lineOfSight, moveCircle, pointSegmentDistance } from './levels.js';

export function createGuards(defs) {
  return defs.map((def, index) => {
    const start = def.waypoints[0];
    const next = def.waypoints[1] || def.waypoints[0];
    return {
      index,
      x: start.x,
      y: start.y,
      radius: GUARD.radius,
      waypoints: def.waypoints,
      waypointIndex: 1 % def.waypoints.length,
      pause: def.pause,
      pauseTimer: 0,
      facing: Math.atan2(next.y - start.y, next.x - start.x),
      state: 'patrol', // patrol | suspicious | alerted | search
      meter: 0, // 0..1 suspicion; 1 means alerted
      lastSeen: null,
      unseenTimer: 0,
      searchTimer: 0,
      searchAngle: 0,
    };
  });
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when a smoke cloud hangs between the watcher and the thief, or the thief is inside one. */
function smokeBlocks(smokes, x1, y1, x2, y2) {
  for (const smoke of smokes) {
    if (Math.hypot(x2 - smoke.x, y2 - smoke.y) < smoke.radius) return true;
    if (pointSegmentDistance(smoke.x, smoke.y, x1, y1, x2, y2) < smoke.radius) return true;
  }
  return false;
}

/**
 * Can this watcher see the thief? Range, cone, walls, smoke and the vent all count; the
 * return value is 0 when unseen, otherwise a 0..1 strength (1 at point blank).
 */
export function canSee(watcher, range, halfAngle, thief, level, smokes) {
  if (thief.hidden) return 0;
  const dx = thief.x - watcher.x;
  const dy = thief.y - watcher.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), watcher.facing)) > halfAngle) return 0;
  if (!lineOfSight(watcher.x, watcher.y, thief.x, thief.y, level.solids)) return 0;
  if (smokeBlocks(smokes, watcher.x, watcher.y, thief.x, thief.y)) return 0;
  let strength = 1 - (dist / range) * 0.7;
  if (thief.sneaking) strength *= SNEAK_DETECT;
  if (thief.inShade) strength *= SHADOW_DETECT;
  return Math.max(0, strength);
}

function moveToward(guard, tx, ty, speed, dt, level) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  moveCircle(guard, (dx / dist) * step, (dy / dist) * step, level.solids);
  guard.facing = Math.atan2(dy, dx);
  return dist - step < 2;
}

/** Advance every guard one fixed step. Returns 'caught' when a guard reaches the thief. */
export function updateGuards(guards, thief, level, smokes, dt) {
  for (const guard of guards) {
    const seen = canSee(guard, GUARD.visionRange, GUARD.visionHalfAngle, thief, level, smokes);
    if (seen > 0) {
      guard.meter = Math.min(1, guard.meter + GUARD.detectRate * seen * dt);
      guard.lastSeen = { x: thief.x, y: thief.y };
      guard.unseenTimer = 0;
    } else {
      guard.meter = Math.max(0, guard.meter - GUARD.detectDecay * dt);
      guard.unseenTimer += dt;
    }
    if (guard.meter >= GUARD.alertedAt) guard.state = 'alerted';
    else if (guard.meter >= GUARD.suspiciousAt) guard.state = 'suspicious';
    else if (guard.state === 'suspicious') guard.state = 'patrol';

    if (guard.state === 'patrol') {
      const target = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, level)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = guard.pause;
      }
    } else if (guard.state === 'suspicious') {
      // Walk to where the thief was last glimpsed, then look around.
      if (guard.lastSeen) moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.suspiciousSpeed, dt, level);
    } else if (guard.state === 'alerted') {
      // Chase the thief's live position; give up after losing sight for a while.
      moveToward(guard, thief.x, thief.y, GUARD.chaseSpeed, dt, level);
      if (seen === 0 && guard.unseenTimer > GUARD.loseSightSeconds) {
        guard.state = 'search';
        guard.searchTimer = GUARD.searchSeconds;
        guard.searchAngle = guard.facing;
      }
      if (Math.hypot(thief.x - guard.x, thief.y - guard.y) < GUARD.catchDistance) return 'caught';
    } else if (guard.state === 'search') {
      // Sweep the head at the last seen spot, then give up and go back to patrol.
      guard.searchTimer -= dt;
      guard.facing = guard.searchAngle + Math.sin((GUARD.searchSeconds - guard.searchTimer) * 2.4) * 0.9;
      if (guard.searchTimer <= 0) {
        guard.state = 'patrol';
        guard.meter = 0;
      }
    }
  }
  return null;
}
