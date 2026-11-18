// player.js — Juno Marchetti. Walking and sprinting on foot, mouse-aimed
// pistol work, and the two ways she changes cars: politely, into a parked
// one, or by pulling a driver out of theirs. She never talks to the law
// directly — her crimes go onto the event queue and police.js decides
// what was witnessed.

import { held, tapped, input } from './input.js';
import { stepCar, damageCar } from './vehicles.js';
import { hurtPed } from './pedestrians.js';
import { collideCircle, surfaceAt } from './city.js';

const WALK_SPEED = 168;
const SPRINT_SPEED = 252;
const PISTOL_RANGE = 430;
const PISTOL_CADENCE = 0.22;

/** A new Juno at a spawn point: full health, $120, no respect, no car. */
export function createPlayer(x, y) {
  return {
    name: 'Juno Marchetti',
    x, y,
    angle: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    armor: 0,
    cash: 120,
    respect: 0,
    inCar: false,
    car: null,
    shootT: 0,
    hurtT: 0, // seconds since she last took damage; drives the small regen
    phase: 0, // walk cycle
    moving: false,
  };
}

/** The closest car she could get into within reach, or null. The reach
 *  is a stride past the prompt's own radius, so a car she is offered is
 *  always a car she can actually take. */
export function nearestCar(S, maxDist = 56) {
  let best = null;
  let bestDist = maxDist;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - S.player.x, car.y - S.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/**
 * Get into a car. A moving traffic car means a carjacking: its driver is
 * thrown onto the asphalt (the 'eject' event makes him a fleeing ped) and
 * the taking is a crime, witnessed or not as the law decides.
 */
export function enterCar(S, car) {
  const P = S.player;
  if (car.role === 'traffic') {
    S.events.push({ kind: 'crime', crime: 'carjack', x: car.x, y: car.y });
    const outX = car.x + Math.cos(car.angle + Math.PI / 2) * 20;
    const outY = car.y + Math.sin(car.angle + Math.PI / 2) * 20;
    S.events.push({ kind: 'eject', x: outX, y: outY });
  } else if (car.role === 'parked') {
    S.events.push({ kind: 'crime', crime: 'carjack', x: car.x, y: car.y });
  }
  S.events.push({ kind: 'door', x: car.x, y: car.y });
  car.role = 'player';
  car.wasStolen = true;
  P.inCar = true;
  P.car = car;
  P.x = car.x;
  P.y = car.y;
}

/** Step out, leaving the car parked where it stands. */
export function exitCar(S) {
  const P = S.player;
  const car = P.car;
  if (!car) return;
  car.role = 'parked';
  P.inCar = false;
  P.car = null;
  const pos = {
    x: car.x + Math.cos(car.angle - Math.PI / 2) * (car.wid + 12),
    y: car.y + Math.sin(car.angle - Math.PI / 2) * (car.wid + 12),
  };
  collideCircle(S.city, pos, 9);
  P.x = pos.x;
  P.y = pos.y;
  S.events.push({ kind: 'door', x: P.x, y: P.y });
}

/** Damage Juno. Armour soaks most of a hit; death is the main loop's call. */
export function hurtPlayer(S, dmg) {
  const P = S.player;
  if (P.armor > 0) {
    const soaked = Math.min(P.armor, dmg * 0.65);
    P.armor -= soaked;
    dmg -= soaked;
  }
  P.hp -= dmg;
  P.hurtT = 0;
  S.events.push({ kind: 'blood', x: P.x, y: P.y, n: 4 });
  if (P.hp <= 0 && !S.events.some((e) => e.kind === 'wasted')) {
    S.events.push({ kind: 'wasted' });
  }
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One pistol shot toward the mouse: fast hitscan, a whisper of spread. */
function firePistol(S) {
  const P = S.player;
  const rng = S.rng;
  const aim = Math.atan2(S.mouseWorld.y - P.y, S.mouseWorld.x - P.x);
  const dir = aim + (rng() - 0.5) * 0.035;
  let bestDist = PISTOL_RANGE;
  let hitPed = null;
  let hitCar = null;
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar) continue;
    const dx = ped.x - P.x;
    const dy = ped.y - P.y;
    const d = Math.hypot(dx, dy);
    if (d > PISTOL_RANGE || d < 12 || d >= bestDist) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), dir)) < Math.atan2(11, d)) {
      bestDist = d;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of S.cars) {
    if (car.dead) continue;
    const dx = car.x - P.x;
    const dy = car.y - P.y;
    const d = Math.hypot(dx, dy);
    if (d > PISTOL_RANGE || d >= bestDist) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), dir)) < Math.atan2(car.len * 0.55, d)) {
      bestDist = d;
      hitCar = car;
      hitPed = null;
    }
  }
  const endX = P.x + Math.cos(dir) * bestDist;
  const endY = P.y + Math.sin(dir) * bestDist;
  S.events.push({
    kind: 'tracer',
    x1: P.x + Math.cos(dir) * 14, y1: P.y + Math.sin(dir) * 14,
    x2: endX, y2: endY, color: '#ffe66d',
  });
  S.events.push({ kind: 'shotSound', x: P.x, y: P.y, own: true });
  S.events.push({ kind: 'crime', crime: 'shotFired', x: P.x, y: P.y });
  S.danger = { x: P.x, y: P.y, t: 3 };
  if (hitPed) {
    // hurtPed raises pedDown itself; the main loop turns that into the
    // right crime, so a kill is never counted twice.
    hurtPed(S, hitPed, 22);
  } else if (hitCar) {
    damageCar(S, hitCar, 5, endX, endY);
    if (hitCar.role === 'police') {
      S.events.push({ kind: 'crime', crime: 'hitPolice', x: endX, y: endY });
    }
  }
}

/**
 * Bank any hidden parcel she is standing on — or has just driven over.
 * The parcel is marked taken here; the event carries the news to the
 * main loop, which pays out and counts the set.
 */
function collectStashes(S) {
  const P = S.player;
  const reach = P.inCar ? 42 : 30;
  for (const stash of S.city.stashes) {
    if (stash.taken) continue;
    if (Math.hypot(stash.x - P.x, stash.y - P.y) < reach) {
      stash.taken = true;
      S.events.push({ kind: 'stash', stash });
    }
  }
}

/** One frame of Juno: drive if she is driving, otherwise walk and fight. */
export function updatePlayer(S, dt) {
  const P = S.player;
  P.shootT -= dt;
  P.hurtT += dt;
  collectStashes(S);
  // Badly hurt and left alone, she claws back up to a fighting minimum.
  if (P.hp > 0 && P.hp < 40 && P.hurtT > 8) P.hp = Math.min(40, P.hp + 3.2 * dt);

  if (P.inCar && P.car) {
    const car = P.car;
    if (car.dead) {
      // Sitting in a burning car is its own punishment; getting out is hers.
      hurtPlayer(S, 18 * dt);
      if (tapped('KeyF', 'KeyE')) exitCar(S);
      P.x = car.x;
      P.y = car.y;
      return;
    }
    const ctrl = {
      throttle: (held('KeyW', 'ArrowUp') ? 1 : 0) + (held('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0),
      hand: held('Space'),
    };
    stepCar(S, car, dt, ctrl);
    P.x = car.x;
    P.y = car.y;
    P.angle = car.angle;
    // A horn of her own: H leans on it, and the street hears her coming.
    if (tapped('KeyH')) S.events.push({ kind: 'horn', x: car.x, y: car.y });
    if (tapped('KeyF', 'KeyE') && Math.abs(car.speed) < 110) exitCar(S);
    return;
  }

  // On foot.
  let mx = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
  P.moving = mx !== 0 || my !== 0;
  if (P.moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const sprinting = held('ShiftLeft', 'ShiftRight');
    const onSand = surfaceAt(S.city, P.x, P.y) === 'sand';
    const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * (onSand ? 0.72 : 1);
    const pos = { x: P.x + mx * speed * dt, y: P.y + my * speed * dt };
    collideCircle(S.city, pos, 9);
    P.x = pos.x;
    P.y = pos.y;
    P.phase += dt * (sprinting ? 13 : 9.5);
  }
  // Her body and her gun both follow the mouse.
  P.angle = Math.atan2(S.mouseWorld.y - P.y, S.mouseWorld.x - P.x);
  if (input.mouse.down && P.shootT <= 0) {
    P.shootT = PISTOL_CADENCE;
    firePistol(S);
  }
  if (tapped('KeyF', 'KeyE')) {
    const car = nearestCar(S);
    if (car) enterCar(S, car);
  }
}
