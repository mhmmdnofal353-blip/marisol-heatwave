// Keyboard and mouse state: one object the whole game polls each frame.
// Keys are stored by code (KeyW, ArrowUp, Space...), the mouse in canvas pixels,
// and `pressed` holds the keys that went down this frame for one-shot actions.

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false },
  wheel: 0,
};

/** Attach the listeners to a canvas; call once at boot. */
export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    input.mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** True while any of the given key codes is held. */
export function held(...codes) {
  return codes.some((c) => input.keys.has(c));
}

/** True only on the frame any of the given key codes went down. */
export function tapped(...codes) {
  return codes.some((c) => input.pressed.has(c));
}

/** Clear the per-frame edges; the main loop calls this after each update. */
export function endFrame() {
  input.pressed.clear();
  input.mouse.clicked = false;
}
