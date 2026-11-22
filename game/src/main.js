// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and victory.
//
// ?seed=N fixes the random stream. ?shot=cover|alert|loot|victory (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot. window.__heist exposes the live game for playtests.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_PICKUP, EVENT_SMOKE, EVENT_SMASH, EVENT_STEP, EVENT_VICTORY } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_PICKUP, ACTION_SMOKE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Steal the ledger and the side loot, then reach the exit.');
  }

  function endGame(overScreen) {
    screen = overScreen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(overScreen === SCREEN_VICTORY ? `Clean getaway. Score ${world.state.score}.` : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playStep(actions) {
    const click = input.takeClick();
    const worldActions = {
      pickup: !!(actions & ACTION_PICKUP),
      smoke: !!(actions & ACTION_SMOKE),
    };
    const events = world.step(STEP, input.keys(), click, worldActions, false);
    const thief = world.state.thief;
    if (events & EVENT_STEP) audio.step(thief.sneaking);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_SMASH) audio.smash();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_ALARM) audio.alarm();
    if (events & EVENT_CAUGHT) {
      audio.caught();
      endGame(SCREEN_OVER);
    } else if (events & EVENT_VICTORY) {
      audio.victory();
      endGame(SCREEN_VICTORY);
    }
  }

  // One-shot presses wait in `pending` until a step consumes them: a fast frame that runs no
  // step must not swallow a pickup or smoke press made in that frame.
  let pending = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pending |= input.takeActions();
    handleActions(pending);
    pending &= ~(ACTION_CONFIRM | ACTION_PAUSE);
    if (screen === SCREEN_TITLE) {
      pending = 0;
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sneak: false }, null, null, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let stepped = false;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        playStep(stepped ? 0 : pending);
        stepped = true;
        accumulator -= STEP;
      }
      if (stepped) pending = 0;
    } else {
      accumulator = 0;
      pending = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the alarm rise unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // The playtest's handle: the live screen, the live world, and a fresh start.
  window.__heist = {
    get screen() {
      return screen;
    },
    get world() {
      return world;
    },
    startGame,
  };

  announce('The Onyx Ledger. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
