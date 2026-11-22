// The museum: one big midnight gallery, its walls, cover, shadows, vent, loot, patrols and
// cameras. Everything a watcher or the thief needs to know about the room lives here, plus the
// little geometry the stealth rules run on (line of sight, circle-vs-wall movement).
import { ROOM } from './config.js';

// --- geometry ---------------------------------------------------------------

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  if (Math.max(x1, x2) < r.x || Math.min(x1, x2) > r.x + r.w) return false;
  if (Math.max(y1, y2) < r.y || Math.min(y1, y2) > r.y + r.h) return false;
  // An endpoint inside the rectangle counts as a hit.
  if (x1 >= r.x && x1 <= r.x + r.w && y1 >= r.y && y1 <= r.y + r.h) return true;
  if (x2 >= r.x && x2 <= r.x + r.w && y2 >= r.y && y2 <= r.y + r.h) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Slab test: the segment crosses the rectangle when the x and y intervals overlap.
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when nothing solid stands between the two points. */
export function lineOfSight(x1, y1, x2, y2, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, solids[i])) return false;
  }
  return true;
}

/** Distance from a point to a segment, for smoke-cloud blocking. */
export function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Circle-vs-rectangle overlap, for wall collision. */
export function circleHitsRect(x, y, radius, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Move a circle one axis at a time, sliding along walls instead of sticking: try the full step,
 * fall back to x-only, then y-only.
 */
export function moveCircle(body, dx, dy, solids) {
  const nx = body.x + dx;
  const ny = body.y + dy;
  const inside = (x, y) =>
    x - body.radius < ROOM.x || x + body.radius > ROOM.x + ROOM.width ||
    y - body.radius < ROOM.y || y + body.radius > ROOM.y + ROOM.height ||
    solids.some((r) => circleHitsRect(x, y, body.radius, r));
  if (!inside(nx, ny)) {
    body.x = nx;
    body.y = ny;
    return;
  }
  if (!inside(nx, body.y)) body.x = nx;
  if (!inside(body.x, ny)) body.y = ny;
}

// --- the museum -------------------------------------------------------------

export function buildLevel() {
  // Solids block movement and sight: display cases, crates, pillars, wall stubs.
  const solids = [
    { x: 600, y: 330, w: 80, h: 56, kind: 'case', label: 'ledger' }, // the Onyx Ledger's case
    { x: 240, y: 300, w: 70, h: 50, kind: 'pedestal', label: 'vase' },
    { x: 970, y: 300, w: 70, h: 50, kind: 'pedestal', label: 'jewel' },
    { x: 500, y: 520, w: 90, h: 60, kind: 'crate' },
    { x: 760, y: 140, w: 90, h: 60, kind: 'crate' },
    { x: 180, y: 480, w: 70, h: 50, kind: 'crate' },
    { x: 1030, y: 520, w: 70, h: 50, kind: 'crate' },
    { x: 420, y: 180, w: 26, h: 26, kind: 'pillar' },
    { x: 840, y: 180, w: 26, h: 26, kind: 'pillar' },
    { x: 420, y: 560, w: 26, h: 26, kind: 'pillar' },
    { x: 840, y: 560, w: 26, h: 26, kind: 'pillar' },
    { x: 632, y: 196, w: 16, h: 100, kind: 'wall' }, // centre choke, upper stub
    { x: 632, y: 424, w: 16, h: 100, kind: 'wall' }, // centre choke, lower stub
  ];
  // Shadow patches: dark floor where a watcher fills its meter half as fast.
  const shadows = [
    { x: 60, y: 400, w: 220, h: 130 },
    { x: 1000, y: 400, w: 220, h: 130 },
    { x: 560, y: 560, w: 160, h: 110 },
    { x: 330, y: 120, w: 200, h: 90 },
  ];
  // The vent: a service crawlspace along the top wall. Inside it, no watcher can see you.
  const vent = { x: 60, y: 88, w: 1160, h: 40 };
  // Paintings on the walls: decoration only, they never block sight.
  const paintings = [
    { x: 120, y: 88, w: 64, h: 44, hue: '#7a5a3a' },
    { x: 300, y: 88, w: 64, h: 44, hue: '#3a5a7a' },
    { x: 900, y: 88, w: 64, h: 44, hue: '#5a3a5a' },
    { x: 1080, y: 88, w: 64, h: 44, hue: '#3a7a5a' },
    { x: 88, y: 300, w: 44, h: 64, hue: '#7a3a3a' },
    { x: 88, y: 520, w: 44, h: 64, hue: '#6a6a3a' },
  ];
  const loot = [
    { id: 'ledger', name: 'The Onyx Ledger', x: 640, y: 358, value: 50000, score: 500, taken: false, channel: 1.0 },
    { id: 'vase', name: 'Gilded Vase', x: 275, y: 325, value: 12000, score: 200, taken: false, channel: 0 },
    { id: 'jewel', name: 'Star Sapphire', x: 1005, y: 325, value: 18000, score: 300, taken: false, channel: 0 },
  ];
  const guards = [
    { waypoints: [{ x: 300, y: 200 }, { x: 300, y: 480 }], pause: 1.2 },
    { waypoints: [{ x: 900, y: 160 }, { x: 1120, y: 160 }, { x: 1000, y: 460 }], pause: 1.0 },
    { waypoints: [{ x: 480, y: 620 }, { x: 820, y: 620 }], pause: 1.4 },
  ];
  const cameras = [
    { x: 640, y: 92, baseAngle: Math.PI / 2, sweep: 0.75, speed: 0.45, phase: 0 },
    { x: 1248, y: 380, baseAngle: Math.PI, sweep: 0.6, speed: 0.6, phase: 1.7 },
  ];
  const start = { x: 90, y: 640 };
  const exit = { x: 1150, y: 620, w: 90, h: 64 };
  return { solids, shadows, vent, paintings, loot, guards, cameras, start, exit };
}

/** True when the point stands in a shadow patch. */
export function inShadow(level, x, y) {
  return level.shadows.some((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
}

/** True when the point stands inside the vent crawlspace. */
export function inVent(level, x, y) {
  const v = level.vent;
  return x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
}
