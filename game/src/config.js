// Tuning constants for The Onyx Ledger. One file, every number the game balances on.
export const CANVAS = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const BEST_KEY = 'onyx-ledger-best';

// The room the thief crosses: the HUD bar sits above it.
export const ROOM = { x: 24, y: 84, width: 1232, height: 612 };

export const THIEF = {
  radius: 14,
  walkSpeed: 178,
  sneakSpeed: 96,
  clickSpeed: 150,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 72,
  suspiciousSpeed: 118,
  chaseSpeed: 152,
  visionRange: 232,
  visionHalfAngle: 0.62, // ~71 degrees of cone
  catchDistance: 27,
  // Suspicion meter fills this fast at point blank, scaled by distance and cover.
  detectRate: 1.7,
  detectDecay: 0.5,
  suspiciousAt: 0.35,
  alertedAt: 1.0,
  loseSightSeconds: 3,
  searchSeconds: 2.2,
};

export const CAMERA = {
  range: 300,
  halfAngle: 0.5,
  alarmRate: 20, // alarm points per second while the lens has the thief
};

export const ALARM = {
  max: 100,
  riseSuspicious: 7,
  riseAlerted: 15,
  decay: 5,
  lockdownGrace: 1.2, // seconds of flashing warning before the lockdown ends the run
};

// Sneak and shadow both slow how fast a watcher fills its suspicion meter.
export const SNEAK_DETECT = 0.55;
export const SHADOW_DETECT = 0.5;

export const LOOT = {
  ledgerValue: 50000,
  vaseValue: 12000,
  jewelValue: 18000,
  pickupRadius: 48,
  ledgerChannelSeconds: 1.0, // smashing the centre case takes a moment, and it is loud
  ledgerNoiseRadius: 300,
};

export const SMOKE = {
  charges: 2,
  radius: 92,
  seconds: 4,
};

export const SCORES = {
  ledger: 500,
  vase: 200,
  jewel: 300,
};

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#232833',
  floorTile: '#272d3a',
  wall: '#3a4152',
  wallTop: '#4a5266',
  hud: '#10131a',
  text: '#eef1f5',
  muted: '#9aa3b2',
  gold: '#f2c94c',
  ledger: '#7ef0c1',
  danger: '#ff5a4e',
  warn: '#ffb02e',
  cone: 'rgba(255, 176, 46, 0.20)',
  coneAlert: 'rgba(255, 90, 78, 0.30)',
  shadow: 'rgba(6, 8, 16, 0.55)',
  vent: '#1a2230',
  thief: '#4fc3f7',
  guard: '#ff8a5c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
