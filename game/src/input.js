// Keyboard and pointer input for a plane that flies left to right. Held keys give a
// steering vector (up/down to climb and dive, left/right to ease off and push the
// throttle); one-shot presses (start or restart, pause, boost, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice. The pointer steers the same way: the plane chases it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOOST = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const BOOST = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  // Pointer position in CSS pixels, converted to field coordinates by the caller via
  // canvas.getBoundingClientRect; stored raw here and read through pointer().
  let pointerX = null;
  let pointerY = null;
  let pointerDown = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    if (BOOST.has(event.code)) {
      actions |= ACTION_BOOST;
      event.preventDefault();
    }
    if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    if (MUTE.has(event.code)) actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    pointerDown = false;
    pointerX = null;
    pointerY = null;
  });

  function setPointer(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
  }
  target.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    setPointer(event);
    actions |= ACTION_CONFIRM;
    target.setPointerCapture?.(event.pointerId);
  });
  target.addEventListener('pointermove', (event) => {
    if (pointerDown) setPointer(event);
  });
  target.addEventListener('pointerup', () => {
    pointerDown = false;
    pointerX = null;
    pointerY = null;
  });
  target.addEventListener('pointercancel', () => {
    pointerDown = false;
    pointerX = null;
    pointerY = null;
  });

  return {
    keysVector() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        if (UP.has(code)) y -= 1;
        else if (DOWN.has(code)) y += 1;
        else if (LEFT.has(code)) x -= 1;
        else if (RIGHT.has(code)) x += 1;
      }
      return { x, y };
    },
    pointer() {
      if (!pointerDown || pointerX === null) return null;
      return { x: pointerX, y: pointerY };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
