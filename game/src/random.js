// random.js — seeded randomness. A mulberry32 generator drives the city
// layout and the staged screenshot scenes, so a given seed always grows the
// same Marisol Bay and poses the same frame. Gameplay systems draw from the
// same stream the state carries (S.rng), which keeps a whole run
// reproducible from its seed.

/** Create a mulberry32 generator: call it for floats in [0, 1). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [lo, hi). */
export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** An integer in [lo, hi], both ends included. */
export function int(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** One element of a list, chosen at random. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with probability p. */
export function chance(rng, p) {
  return rng() < p;
}
