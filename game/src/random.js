// A tiny seeded random number generator (mulberry32), so a given seed always
// grows the same city and stages the same screenshot scenes.

/** Make a generator from a seed; call it for floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from generator `rng`. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] inclusive from generator `rng`. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `list`, chosen by generator `rng`. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** True with probability `p`, from generator `rng`. */
export function chance(rng, p) {
  return rng() < p;
}
