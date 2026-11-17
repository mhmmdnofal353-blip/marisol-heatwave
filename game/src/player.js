// Juno Marchetti, the player: walking and sprinting on foot, stealing and
// driving cars, and pistol work with the mouse. Crimes are pushed onto the
// event queue; the law (police.js) decides what was seen.

import { held, tapped, input } from './input.js';
import { stepCar } from './vehicles.js';
import { hurtPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { collideCircle, surfaceAt } from './city.js';

/** A new player at a spawn point, with her name and empty pockets. */
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
    hurtT: 0, // time since last damage, drives the small health regen
    phase: 0,
    moving: false,
  };
}

/** The nearest car the player could get into, or null. */
export function nearestCar(S, maxD = 52) {
  let best = null;
  let bd = maxD;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - S.player.x, car.y - S.player.y);
    if (d < bd) {
      bd = d;
      best = car;
    }
  }
  return best;
}

/** Get into a car — politely if it is parked, by force if someone is driving it. */
export function enterCar(S, car) {
  const P = S.player;
  if (car.role === 'traffic') {
    // The driver is pulled out onto the asphalt and runs.
    S.events.push({ kind: 'crime', crime: 'carjack', x: car.x, y: car.y });
    S.events.push({ kind: 'door', x: car.x, y: car.y });
    const ejected = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 20, y: car.y + Math.sin(car.angle + Math.PI / 2) * 20 };
    S.events.push({ kind: 'eject', x: ejected.x, y: ejected.y });
  } else if (car.role === 'parked') {
    S.events.push({ kind: 'crime', crime: 'carjack', x: car.x, y: car.y });
    S.events.push({ kind: 'door', x: car.x, y: car.y });
  } else {
    S.events.push({ kind: 'door', x: car.x, y: car.y });
  }
  car.role = 'player';
  car.wasStolen = true;
  P.inCar = true;
  P.car = car;
  P.x = car.x;
  P.y = car.y;
  S.events.push({ kind: 'engineOn' });
}

/** Step out of the current car, leaving it where it stands. */
export function exitCar(S) {
  const P = S.player;
  const car = P.car;
  if (!car) return;
  car.role = 'parked';
  P.inCar = false;
  P.car = null;
  P.x = car.x + Math.cos(car.angle - Math.PI / 2) * (car.wid + 12);
  P.y = car.y + Math.sin(car.angle - Math.PI / 2) * (car.wid + 12);
  const pos = { x: P.x, y: P.y };
  collideCircle(S.city, pos, 9);
  P.x = pos.x;
  P.y = pos.y;
  S.events.push({ kind: 'door', x: P.x, y: P.y });
  S.events.push({ kind: 'engineOff' });
}

/** Damage the player; armour soaks most of it. Death is the main loop's call. */
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
  if (P.hp <= 0 && !S.events.some((e) => e.kind === 'wasted')) S.events.push({ kind: 'wasted' });
}

/** Fire the pistol once toward the mouse: a fast hitscan with a little spread. */
function firePistol(S) {
  const P = S.player;
  const rng = S.rng;
  const aim = Math.atan2(S.mouseWorld.y - P.y, S.mouseWorld.x - P.x);
  const spread = (rng() - 0.5) * 0.035;
  const dir = aim + spread;
  const range = 430;
  let bestD = range;
  let hitPed = null;
  let hitCar = null;
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar) continue;
    const dx = ped.x - P.x;
    const dy = ped.y - P.y;
    const d = Math.hypot(dx, dy);
    if (d > range || d < 12) continue;
    let diff = Math.atan2(dy, dx) - dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < Math.atan2(11, d) && d < bestD) {
      bestD = d;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of S.cars) {
    if (car.dead) continue;
    const dx = car.x - P.x;
    const dy = car.y - P.y;
    const d = Math.hypot(dx, dy);
    if (d > range) continue;
    let diff = Math.atan2(dy, dx) - dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < Math.atan2(car.len * 0.55, d) && d < bestD) {
      bestD = d;
      hitCar = car;
      hitPed = null;
    }
  }
  const ex = P.x + Math.cos(dir) * bestD;
  const ey = P.y + Math.sin(dir) * bestD;
  S.events.push({ kind: 'tracer', x1: P.x + Math.cos(dir) * 14, y1: P.y + Math.sin(dir) * 14, x2: ex, y2: ey, color: '#ffe66d' });
  S.events.push({ kind: 'shotSound', x: P.x, y: P.y, own: true });
  S.events.push({ kind: 'crime', crime: 'shotFired', x: P.x, y: P.y });
  S.danger = { x: P.x, y: P.y, t: 3 };
  if (hitPed) {
    // hurtPed reports the fall as a pedDown event; the main loop's drain
    // turns it into the right crime, so nothing is counted twice.
    hurtPed(S, hitPed, 22);
  } else if (hitCar) {
    damageCar(S, hitCar, 5, ex, ey);
    if (hitCar.role === 'police') S.events.push({ kind: 'crime', crime: 'hitPolice', x: ex, y: ey });
  }
}

/** One frame of the player: drive, walk, fight, interact. */
export function updatePlayer(S, dt) {
  const P = S.player;
  P.shootT -= dt;
  P.hurtT += dt;
  if (P.hp > 0 && P.hp < 40 && P.hurtT > 8) P.hp = Math.min(40, P.hp + 3.2 * dt);

  if (P.inCar && P.car) {
    const car = P.car;
    if (car.dead) {
      hurtPlayer(S, 18 * dt);
      if (tapped('KeyF', 'KeyE')) exitCar(S);
      P.x = car.x;
      P.y = car.y;
      return;
    }
    // Steer +1 turns clockwise on screen (D), -1 counter-clockwise (A);
    // stepCar's signed speed handles the way reversing flips the nose.
    const ctrl = {
      throttle: (held('KeyW', 'ArrowUp') ? 1 : 0) + (held('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0),
      hand: held('Space'),
    };
    stepCar(S, car, dt, ctrl);
    P.x = car.x;
    P.y = car.y;
    P.angle = car.angle;
    if (tapped('KeyF', 'KeyE') && Math.abs(car.speed) < 110) exitCar(S);
    return;
  }

  // On foot.
  let mx = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
  let my = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
  const sprint = held('ShiftLeft', 'ShiftRight');
  const speed = sprint ? 252 : 168;
  P.moving = mx !== 0 || my !== 0;
  if (P.moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    const surf = surfaceAt(S.city, P.x, P.y);
    const sp = speed * (surf === 'sand' ? 0.72 : 1);
    const pos = { x: P.x + mx * sp * dt, y: P.y + my * sp * dt };
    collideCircle(S.city, pos, 9);
    P.x = pos.x;
    P.y = pos.y;
    P.phase += dt * (sprint ? 13 : 9.5);
  }
  // Aim follows the mouse; the body faces movement when not aiming down sights.
  P.angle = Math.atan2(S.mouseWorld.y - P.y, S.mouseWorld.x - P.x);
  if (input.mouse.down && P.shootT <= 0) {
    P.shootT = 0.22;
    firePistol(S);
  }
  if (tapped('KeyF', 'KeyE')) {
    const car = nearestCar(S);
    if (car) enterCar(S, car);
  }
  void input;
}
