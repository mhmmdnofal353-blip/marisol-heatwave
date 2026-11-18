// input.js — keyboard and mouse, kept as one polled state object. `keys`
// holds every code currently down, `pressed` the codes that went down this
// frame (for one-shot actions like entering a car), and `mouse` the pointer
// in canvas pixels plus its button edges. The main loop clears the edges at
// the end of each frame with endFrame().

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false },
  wheel: 0,
};

const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

/** Wire the listeners to the game canvas. Call once, at boot. */
export function bindInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
    input.mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const box = canvas.getBoundingClientRect();
    input.mouse.x = ((event.clientX - box.left) / box.width) * canvas.width;
    input.mouse.y = ((event.clientY - box.top) / box.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    input.mouse.down = true;
    input.mouse.clicked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('wheel', (event) => {
    input.wheel += Math.sign(event.deltaY);
  }, { passive: true });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** True while any listed key code is held down. */
export function held(...codes) {
  return codes.some((code) => input.keys.has(code));
}

/** True only on the frame any listed key code was first pressed. */
export function tapped(...codes) {
  return codes.some((code) => input.pressed.has(code));
}

/**
 * Read and clear the wheel's accumulated notches. The camera zoom is the
 * one reader: a notch in eases the view out, a notch out pulls it in.
 */
export function consumeWheel() {
  const notches = input.wheel;
  input.wheel = 0;
  return notches;
}

/** Clear the per-frame edges once the frame has read them. */
export function endFrame() {
  input.pressed.clear();
  input.mouse.clicked = false;
  input.wheel = 0;
}
