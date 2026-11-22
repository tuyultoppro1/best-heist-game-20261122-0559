// Keyboard and pointer input. Held keys give a steering direction; one-shot presses (start,
// pause, pickup, smoke) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. Clicks set a walk target in canvas space.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PICKUP = 4;
export const ACTION_SMOKE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PICKUP = new Set(['KeyE']);
const SMOKE = new Set(['KeyQ']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sneak: false };
  let actions = 0;
  let click = null;

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // The renderer letterboxes the 1280x720 playfield inside the canvas; undo that here.
    const viewScale = Math.min(canvas.width / 1280, canvas.height / 720);
    const offsetX = (canvas.width - 1280 * viewScale) / 2;
    const offsetY = (canvas.height - 720 * viewScale) / 2;
    return {
      x: ((event.clientX - rect.left) * scaleX - offsetX) / viewScale,
      y: ((event.clientY - rect.top) * scaleY - offsetY) / viewScale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SNEAK.has(event.code)) held.sneak = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (PICKUP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PICKUP;
    } else if (SMOKE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SMOKE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SNEAK.has(event.code)) held.sneak = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sneak = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toCanvas(event);
    if (point.x >= 24 && point.x <= 1256 && point.y >= 84 && point.y <= 696) click = point;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering: -1, 0 or 1 on each axis, from the held keys. */
    keys() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sneak: held.sneak,
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click-to-move target, or null; consumed by the caller. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
  };
}
