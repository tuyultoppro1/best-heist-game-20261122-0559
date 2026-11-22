// The CCTV cameras: fixed to the wall, sweeping their lens back and forth. A camera that has
// the thief in its cone raises the alarm directly — it never chases, it just watches.
import { CAMERA } from './config.js';
import { canSee } from './guards.js';

export function createCameras(defs) {
  return defs.map((def, index) => ({
    index,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    speed: def.speed,
    phase: def.phase,
    facing: def.baseAngle,
    time: 0,
    spotting: false, // the lens has the thief right now
  }));
}

/** Sweep every camera one fixed step; returns true when any camera has the thief. */
export function updateCameras(cameras, thief, level, smokes, dt) {
  let anySpotting = false;
  for (const camera of cameras) {
    camera.time += dt;
    camera.facing = camera.baseAngle + Math.sin(camera.time * camera.speed + camera.phase) * camera.sweep;
    camera.spotting = canSee(camera, CAMERA.range, CAMERA.halfAngle, thief, level, smokes) > 0;
    if (camera.spotting) anySpotting = true;
  }
  return anySpotting;
}
