// Drawing only: the museum and the current screen in, pixels out. The 1280x720 playfield is
// scaled to fit the window and centred, the margin filled with the backdrop colour. Safe cover,
// danger and loot are colour-coded at a glance: dark shadow and the vent are safe, amber cones
// are watched, red is alerted, gold and green are loot.
import { CAMERA, CANVAS, FONT, GUARD, PALETTE, ROOM } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

function money(value) {
  return '$' + value.toLocaleString('en-US');
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / CANVAS.width, height / CANVAS.height);
    view.x = (width - CANVAS.width * view.scale) / 2;
    view.y = (height - CANVAS.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  function cone(x, y, facing, halfAngle, range, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, facing - halfAngle, facing + halfAngle);
    context.closePath();
    context.fill();
  }

  function drawFloor(state) {
    // Marble tiles.
    context.fillStyle = PALETTE.floor;
    context.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    context.strokeStyle = PALETTE.floorTile;
    context.lineWidth = 1;
    for (let x = ROOM.x + 88; x < ROOM.x + ROOM.width; x += 88) {
      context.beginPath();
      context.moveTo(x, ROOM.y);
      context.lineTo(x, ROOM.y + ROOM.height);
      context.stroke();
    }
    for (let y = ROOM.y + 88; y < ROOM.y + ROOM.height; y += 88) {
      context.beginPath();
      context.moveTo(ROOM.x, y);
      context.lineTo(ROOM.x + ROOM.width, y);
      context.stroke();
    }
    // The room's walls.
    context.fillStyle = PALETTE.wall;
    context.fillRect(ROOM.x - 8, ROOM.y - 8, ROOM.width + 16, 10);
    context.fillRect(ROOM.x - 8, ROOM.y + ROOM.height - 2, ROOM.width + 16, 10);
    context.fillRect(ROOM.x - 8, ROOM.y - 8, 10, ROOM.height + 16);
    context.fillRect(ROOM.x + ROOM.width - 2, ROOM.y - 8, 10, ROOM.height + 16);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(ROOM.x - 8, ROOM.y - 8, ROOM.width + 16, 3);
  }

  function drawVentAndShadows(level) {
    // The vent crawlspace along the top wall: safe, and marked as a vent.
    const v = level.vent;
    context.fillStyle = PALETTE.vent;
    context.fillRect(v.x, v.y, v.w, v.h);
    context.strokeStyle = '#3a4a63';
    context.lineWidth = 2;
    context.strokeRect(v.x, v.y, v.w, v.h);
    text('VENT — unseen inside', v.x + v.w / 2, v.y + 26, 13, '#7d8aa5', 'center', 'middle');
    // Shadow patches: dark floor where watchers fill their meter half as fast.
    context.fillStyle = PALETTE.shadow;
    for (const s of level.shadows) context.fillRect(s.x, s.y, s.w, s.h);
    for (const s of level.shadows) {
      text('SHADOW', s.x + s.w / 2, s.y + 16, 11, 'rgba(220, 228, 245, 0.45)', 'center', 'middle');
    }
    // Paintings: decoration on the walls.
    for (const p of level.paintings) {
      context.fillStyle = p.hue;
      context.fillRect(p.x, p.y, p.w, p.h);
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.strokeRect(p.x, p.y, p.w, p.h);
    }
  }

  function drawExit(level, exitOpen) {
    const e = level.exit;
    context.fillStyle = exitOpen ? '#1d5c33' : '#4a2b28';
    context.fillRect(e.x, e.y, e.w, e.h);
    context.strokeStyle = exitOpen ? PALETTE.ledger : PALETTE.danger;
    context.lineWidth = 3;
    context.strokeRect(e.x, e.y, e.w, e.h);
    text(exitOpen ? 'EXIT OPEN' : 'EXIT', e.x + e.w / 2, e.y + e.h / 2 - 4, 15, exitOpen ? PALETTE.ledger : '#ffb0a8', 'center', 'middle');
    text(exitOpen ? 'run!' : 'locked', e.x + e.w / 2, e.y + e.h / 2 + 14, 11, PALETTE.muted, 'center', 'middle');
  }

  function drawLoot(level) {
    for (const loot of level.loot) {
      if (loot.taken) continue;
      const pulse = 0.75 + Math.sin(Date.now() / 280) * 0.25;
      context.save();
      context.globalAlpha = pulse;
      if (loot.id === 'ledger') {
        // The Onyx Ledger: a glowing green book on the centre case.
        context.fillStyle = PALETTE.ledger;
        context.fillRect(loot.x - 14, loot.y - 10, 28, 20);
        context.fillStyle = '#0b3d2c';
        context.fillRect(loot.x - 10, loot.y - 6, 20, 12);
        context.fillStyle = PALETTE.ledger;
        context.fillRect(loot.x - 2, loot.y - 6, 4, 12);
      } else if (loot.id === 'vase') {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(loot.x, loot.y, 12, 0, Math.PI * 2);
        context.fill();
        context.fillRect(loot.x - 5, loot.y - 20, 10, 10);
      } else {
        // The Star Sapphire: a cyan diamond.
        context.fillStyle = '#5ce1e6';
        context.beginPath();
        context.moveTo(loot.x, loot.y - 14);
        context.lineTo(loot.x + 11, loot.y);
        context.lineTo(loot.x, loot.y + 14);
        context.lineTo(loot.x - 11, loot.y);
        context.closePath();
        context.fill();
      }
      context.restore();
      text(loot.name, loot.x, loot.y - 26, 12, PALETTE.gold, 'center', 'middle');
    }
  }

  function drawSolids(level) {
    for (const s of level.solids) {
      if (s.kind === 'case') {
        context.fillStyle = '#2c4a5e';
        context.fillRect(s.x, s.y, s.w, s.h);
        context.strokeStyle = '#7ec8e3';
        context.lineWidth = 2;
        context.strokeRect(s.x, s.y, s.w, s.h);
        text('ONYX LEDGER', s.x + s.w / 2, s.y + s.h + 14, 11, '#9fd8ef', 'center', 'middle');
      } else if (s.kind === 'pedestal') {
        context.fillStyle = '#3d3a2e';
        context.fillRect(s.x, s.y, s.w, s.h);
        context.strokeStyle = '#8a7d4f';
        context.lineWidth = 2;
        context.strokeRect(s.x, s.y, s.w, s.h);
      } else if (s.kind === 'crate') {
        context.fillStyle = '#4a3d28';
        context.fillRect(s.x, s.y, s.w, s.h);
        context.strokeStyle = '#7a6a42';
        context.lineWidth = 2;
        context.strokeRect(s.x, s.y, s.w, s.h);
        context.beginPath();
        context.moveTo(s.x, s.y);
        context.lineTo(s.x + s.w, s.y + s.h);
        context.moveTo(s.x + s.w, s.y);
        context.lineTo(s.x, s.y + s.h);
        context.stroke();
      } else if (s.kind === 'pillar') {
        context.fillStyle = PALETTE.wall;
        context.beginPath();
        context.arc(s.x + s.w / 2, s.y + s.h / 2, 15, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = PALETTE.wallTop;
        context.lineWidth = 2;
        context.stroke();
      } else {
        context.fillStyle = PALETTE.wall;
        context.fillRect(s.x, s.y, s.w, s.h);
      }
    }
  }

  function drawSmoke(smokes) {
    for (const smoke of smokes) {
      const alpha = Math.min(0.75, (smoke.timeLeft / 1.2) * 0.75 + 0.2);
      context.fillStyle = `rgba(180, 190, 205, ${alpha.toFixed(2)})`;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(40, 44, 54, 0.5)';
      context.beginPath();
      context.arc(smoke.x - 24, smoke.y + 10, 26, 0, Math.PI * 2);
      context.arc(smoke.x + 28, smoke.y - 14, 30, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      cone(camera.x, camera.y, camera.facing, CAMERA.halfAngle, CAMERA.range,
        camera.spotting ? PALETTE.coneAlert : PALETTE.cone);
    }
    for (const guard of state.guards) {
      const alerted = guard.state === 'alerted';
      cone(guard.x, guard.y, guard.facing, GUARD.visionHalfAngle, GUARD.visionRange,
        alerted ? PALETTE.coneAlert : PALETTE.cone);
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      // Facing tick.
      context.strokeStyle = '#fff';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 8), guard.y + Math.sin(guard.facing) * (guard.radius + 8));
      context.stroke();
      // Suspicion ring while the meter is filling.
      if (guard.meter > 0.02) {
        context.strokeStyle = guard.state === 'alerted' ? PALETTE.danger : PALETTE.warn;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(guard.x, guard.y, guard.radius + 7, -Math.PI / 2, -Math.PI / 2 + guard.meter * Math.PI * 2);
        context.stroke();
      }
      if (guard.state === 'alerted') text('!', guard.x, guard.y - guard.radius - 12, 26, PALETTE.danger, 'center', 'middle');
      else if (guard.state === 'suspicious') text('?', guard.x, guard.y - guard.radius - 12, 24, PALETTE.warn, 'center', 'middle');
      else if (guard.state === 'search') text('?', guard.x, guard.y - guard.radius - 12, 20, PALETTE.muted, 'center', 'middle');
      text('GUARD', guard.x, guard.y + guard.radius + 14, 10, PALETTE.muted, 'center', 'middle');
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      context.fillStyle = camera.spotting ? PALETTE.danger : '#c8ccd4';
      context.fillRect(camera.x - 10, camera.y - 8, 20, 16);
      context.fillStyle = camera.spotting ? '#ff2e1f' : PALETTE.danger;
      context.beginPath();
      context.arc(camera.x + Math.cos(camera.facing) * 12, camera.y + Math.sin(camera.facing) * 12, 4, 0, Math.PI * 2);
      context.fill();
      text('CCTV', camera.x, camera.y - 20, 10, PALETTE.muted, 'center', 'middle');
    }
  }

  function drawThief(state) {
    const thief = state.thief;
    context.save();
    if (thief.hidden) context.globalAlpha = 0.55;
    // Hooded cloak: a triangle pointing where the thief faces, over a dark circle.
    context.fillStyle = '#1c2436';
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    const tip = 20;
    const spread = 0.5;
    context.moveTo(thief.x + Math.cos(thief.facing) * tip, thief.y + Math.sin(thief.facing) * tip);
    context.lineTo(thief.x + Math.cos(thief.facing + Math.PI - spread) * 13, thief.y + Math.sin(thief.facing + Math.PI - spread) * 13);
    context.lineTo(thief.x + Math.cos(thief.facing + Math.PI + spread) * 13, thief.y + Math.sin(thief.facing + Math.PI + spread) * 13);
    context.closePath();
    context.fill();
    context.restore();
    if (thief.sneaking) {
      context.strokeStyle = PALETTE.thief;
      context.setLineDash([4, 4]);
      context.lineWidth = 2;
      context.beginPath();
      context.arc(thief.x, thief.y, thief.radius + 6, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    text(thief.sneaking ? 'THIEF · sneaking' : 'THIEF', thief.x, thief.y + thief.radius + 14, 10, PALETTE.thief, 'center', 'middle');
    // The centre-case channel: a progress ring while the case is being opened.
    if (thief.channel) {
      const progress = thief.channel.progress / thief.channel.loot.channel;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 5;
      context.beginPath();
      context.arc(thief.x, thief.y, thief.radius + 12, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      context.stroke();
      text('opening case…', thief.x, thief.y - thief.radius - 16, 13, PALETTE.gold, 'center', 'middle');
    }
  }

  function drawHud(state) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, CANVAS.width, 76);
    context.fillStyle = PALETTE.gold;
    context.fillRect(0, 76, CANVAS.width, 2);
    text('THE ONYX LEDGER', 24, 30, 24, PALETTE.text);
    text('midnight museum heist', 24, 56, 13, PALETTE.muted);
    // Alarm meter: the run's heartbeat, front and centre.
    const alarm = state.alarm;
    const barX = 330;
    const barY = 22;
    const barW = 380;
    const barH = 24;
    text('ALARM', barX, barY - 6, 13, alarm > 70 ? PALETTE.danger : PALETTE.muted);
    context.fillStyle = '#2a2f3a';
    context.fillRect(barX, barY, barW, barH);
    const fill = alarm > 70 ? PALETTE.danger : alarm > 35 ? PALETTE.warn : PALETTE.ledger;
    context.fillStyle = fill;
    context.fillRect(barX, barY, (barW * alarm) / 100, barH);
    context.strokeStyle = '#555c6c';
    context.lineWidth = 1;
    context.strokeRect(barX, barY, barW, barH);
    text(`${Math.floor(alarm)}%`, barX + barW + 10, barY + 19, 16, fill);
    if (state.lockdownTimer > 0) {
      const blink = Math.floor(Date.now() / 150) % 2 === 0;
      if (blink) text('LOCKDOWN!', barX + barW / 2, barY + 48, 22, PALETTE.danger, 'center');
    }
    // Loot slots.
    const taken = state.level.loot.filter((l) => l.taken).length;
    text(`LOOT ${taken}/3`, 780, 30, 18, PALETTE.gold);
    state.level.loot.forEach((loot, i) => {
      const x = 780 + i * 34;
      context.fillStyle = loot.taken ? PALETTE.gold : '#2a2f3a';
      context.beginPath();
      context.arc(x + 8, 52, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = loot.taken ? PALETTE.gold : '#555c6c';
      context.stroke();
    });
    text(`TIME ${formatTime(state.time)}`, 960, 30, 18, PALETTE.text);
    text(`SCORE ${state.score}`, 960, 56, 14, PALETTE.muted);
    text(`SMOKE ${state.thief.smokeCharges}  [Q]`, 1256, 30, 14, PALETTE.muted, 'right');
    // The objective lives in the strip below the room, clear of the score.
    text(state.exitOpen ? 'EXIT OPEN — RUN!' : 'take all 3 loot, then reach the exit', 24, 712, 13, state.exitOpen ? PALETTE.ledger : PALETTE.muted, 'left', 'middle');
    // Context prompt: what E does right now.
    if (state.nearLoot && !state.nearLoot.taken) {
      const label = state.nearLoot.channel > 0 ? 'E — open the case (loud!)' : `E — take ${state.nearLoot.name}`;
      text(label, CANVAS.width / 2, CANVAS.height - 14, 16, PALETTE.gold, 'center');
    }
  }

  function drawPanel(title, lines, prompt, titleColor = PALETTE.text) {
    const width = 640;
    const lineHeight = 32;
    const height = 130 + lines.length * lineHeight + 64;
    const x = (CANVAS.width - width) / 2;
    const y = (CANVAS.height - height) / 2;
    context.fillStyle = 'rgba(10, 12, 18, 0.92)';
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, CANVAS.width / 2, y + 62, 44, titleColor, 'center');
    lines.forEach((line, i) => text(line, CANVAS.width / 2, y + 118 + i * lineHeight, 20, PALETTE.muted, 'center'));
    text(prompt, CANVAS.width / 2, y + height - 30, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawVentAndShadows(state.level);
    drawExit(state.level, state.exitOpen);
    drawLoot(state.level);
    drawSolids(state.level);
    drawCones(state);
    drawSmoke(state.smokes);
    drawGuards(state);
    drawCameras(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(8, 10, 16, 0.55)';
      context.fillRect(0, 0, CANVAS.width, CANVAS.height);
      drawPanel('THE ONYX LEDGER', [
        'Midnight at the Harrowgate Museum. Three guards, two cameras,',
        'one ledger in a glass case — and an alarm that never forgets.',
        'WASD / arrows to move · click to walk there · Shift to sneak',
        'E to take loot · Q for a smoke pellet (2) · P to pause',
        'Shadows hide you. The vent hides you. The cones do not lie.',
        best > 0 ? `Best score: ${best}` : '',
      ], 'Press Enter or click to start the heist');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards will wait. The alarm will not forget.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        state.overReason || 'Caught in the act.',
        `Loot taken: ${state.level.loot.filter((l) => l.taken).length}/3 · Score ${state.score}`,
        `Time ${formatTime(state.time)} · Best ${best}`,
      ];
      drawPanel(state.overTitle || 'CAUGHT!', lines, 'Press Enter to try again', PALETTE.danger);
    } else if (screen === SCREEN_VICTORY) {
      const lootValue = state.level.loot.filter((l) => l.taken).reduce((sum, l) => sum + l.value, 0);
      const rating = state.time < 90 && state.alarmPeak < 50 ? 'GHOST — never seen' : state.time < 150 ? 'CLEAN — barely a whisper' : 'LOUD — but rich';
      drawPanel('CLEAN GETAWAY!', [
        `Loot value: ${money(lootValue)} · Score ${state.score}`,
        `Time ${formatTime(state.time)} · Peak alarm ${Math.floor(state.alarmPeak)}%`,
        rating,
        `Best ${best}`,
      ], 'Press Enter to steal again', PALETTE.ledger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
