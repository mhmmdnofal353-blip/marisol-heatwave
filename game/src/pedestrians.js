// pedestrians.js — the people of Marisol Bay. Most are walkers strolling
// the sidewalks who run when trouble lands near them; a few have parts to
// play: Glass Serpent gangers who fight, MBPD officers on foot who chase,
// and the friends and fares the missions put in Juno's way. People and cars
// meet badly here too: a fast car through a crowd is both a crime and a
// tragedy, and the event queue carries the news.

import { ROADS, PED_SHIRTS, PED_SKIN, BEACH_X, WATER_X, WORLD } from './config.js';
import { pick, range, chance } from './random.js';
import { collideCircle } from './city.js';

const WALKER_TARGET = 26;
let nextPedId = 1;

const HAIR_COLOURS = ['#22223b', '#6f1d1b', '#99582a', '#e0aaff', '#f2f2f2', '#8a6642'];
const PANTS_COLOURS = ['#26303a', '#5b4a3f', '#31556b', '#6b3155', '#3a3f4a', '#7a6a53', '#274156'];

/** Create a pedestrian. `role` is 'walker' unless a mission or the law says otherwise. */
export function createPed(x, y, rng, role = 'walker') {
  return {
    id: nextPedId++,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: 0,
    hp: role === 'ganger' ? 40 : 20,
    shirt: role === 'ganger' ? '#28418c' : role === 'officer' ? '#1d3557' : pick(rng, PED_SHIRTS),
    skin: pick(rng, PED_SKIN),
    hair: pick(rng, HAIR_COLOURS),
    pants: pick(rng, PANTS_COLOURS),
    hat: role === 'walker' && chance(rng, 0.3), // a straw sun hat against the glare
    role,
    state: 'walk', // walk | flee | fight | chase | wait | ride
    tx: x,
    ty: y,
    waitT: 0,
    fleeT: 0,
    shootT: range(rng, 0.4, 1.4),
    phase: range(rng, 0, 6), // walk-cycle phase
    dead: false,
    inCar: null,
    name: null,
    mission: null,
  };
}

/** A stroll target: a sidewalk point a few hundred pixels from (x, y). */
function sidewalkTarget(rng, x, y) {
  // Down by the shore, some strolls leave the pavement for the sand.
  if (x > 3700 && chance(rng, 0.3)) {
    const ty = Math.max(50, Math.min(WORLD.height - 50, y + range(rng, -520, 520)));
    return { x: range(rng, BEACH_X + 50, WATER_X - 90), y: ty };
  }
  if (chance(rng, 0.5)) {
    const avenue = pick(rng, ROADS.avenues);
    return { x: avenue + (chance(rng, 0.5) ? -ROADS.walk : ROADS.walk), y: y + range(rng, -420, 420) };
  }
  const street = pick(rng, ROADS.streets);
  return { x: x + range(rng, -420, 420), y: street + (chance(rng, 0.5) ? -ROADS.walk : ROADS.walk) };
}

/** Keep a living ring of walkers around the player; retire the distant. */
export function maintainPeds(S) {
  const rng = S.rng;
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    const far = Math.hypot(ped.x - S.player.x, ped.y - S.player.y) > 1050;
    if (ped.role === 'walker' && !ped.dead && far) S.peds.splice(i, 1);
  }
  let walkers = 0;
  for (const ped of S.peds) if (ped.role === 'walker' && !ped.dead) walkers++;
  while (walkers < WALKER_TARGET) {
    const t = sidewalkTarget(rng, S.player.x, S.player.y);
    const d = Math.hypot(t.x - S.player.x, t.y - S.player.y);
    if (d < 460 || d > 900) continue;
    S.peds.push(createPed(t.x, t.y, rng));
    walkers++;
  }
}

/** Walk a ped toward a point at a speed; true when it has arrived. */
function movePed(S, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) {
    ped.speed = 0;
    return true;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = speed;
  ped.phase += dt * speed * 0.09;
  const pos = { x: ped.x + (dx / dist) * speed * dt, y: ped.y + (dy / dist) * speed * dt };
  collideCircle(S.city, pos, 7);
  ped.x = pos.x;
  ped.y = pos.y;
  return false;
}

/** One step for every pedestrian, by state. */
export function updatePeds(S, dt) {
  const rng = S.rng;
  const P = S.player;
  for (const ped of S.peds) {
    if (ped.dead) continue;
    if (ped.inCar) {
      ped.x = ped.inCar.x;
      ped.y = ped.inCar.y;
      continue;
    }
    // Trouble close by sends a walker running from it.
    if (ped.role === 'walker' && S.danger.t > 0
      && Math.hypot(ped.x - S.danger.x, ped.y - S.danger.y) < 240) {
      ped.state = 'flee';
      ped.fleeT = range(rng, 1.6, 3.2);
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.y - S.danger.y, ped.x - S.danger.x);
      movePed(S, ped, ped.x + Math.cos(away) * 120, ped.y + Math.sin(away) * 120, 168, dt);
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else if (ped.state === 'fight') {
      updateFighter(S, ped, dt);
    } else if (ped.state === 'chase') {
      // An officer on foot runs Juno down; the arrest itself is police.js.
      movePed(S, ped, P.x, P.y, 178, dt);
      ped.angle = Math.atan2(P.y - ped.y, P.x - ped.x);
    } else if (ped.state === 'wait') {
      ped.speed = 0;
      ped.phase += dt * 1.2;
    } else if (ped.state === 'ride') {
      // Seated: the inCar follow above already placed them.
    } else {
      // A stroll: amble to the target, maybe pause, pick another.
      if (ped.waitT > 0) {
        ped.waitT -= dt;
        ped.speed = 0;
      } else if (movePed(S, ped, ped.tx, ped.ty, 62, dt)) {
        if (chance(rng, 0.3)) ped.waitT = range(rng, 1, 4);
        const t = sidewalkTarget(rng, ped.x, ped.y);
        ped.tx = t.x;
        ped.ty = t.y;
      }
    }
  }
  runOverCheck(S);
}

/** A ganger in a fight: keep range, strafe, shoot on a ragged rhythm. */
function updateFighter(S, ped, dt) {
  const rng = S.rng;
  const P = S.player;
  const d = Math.hypot(P.x - ped.x, P.y - ped.y);
  if (d > 540) {
    ped.speed = 0; // across the city he simply waits; the fight is local
    return;
  }
  ped.angle = Math.atan2(P.y - ped.y, P.x - ped.x);
  if (d > 210) {
    movePed(S, ped, P.x, P.y, 120, dt);
  } else if (d < 110) {
    movePed(S, ped, ped.x - (P.x - ped.x), ped.y - (P.y - ped.y), 110, dt);
  } else {
    // In his range band he strafes sideways, swaying on a slow sine.
    ped.phase += dt * 3;
    const sway = Math.sin(S.time * 0.7 + ped.id) * 30;
    const sideX = Math.cos(ped.angle + Math.PI / 2);
    const sideY = Math.sin(ped.angle + Math.PI / 2);
    movePed(S, ped, ped.x + sideX * sway, ped.y + sideY * sway, 55, dt);
  }
  ped.shootT -= dt;
  if (ped.shootT > 0) return;
  if (!P.inCar && d < 330) {
    ped.shootT = range(rng, 0.7, 1.5);
    const hitChance = Math.max(0.12, 0.52 - d / 700);
    S.events.push({ kind: 'tracer', x1: ped.x, y1: ped.y, x2: P.x + range(rng, -8, 8), y2: P.y + range(rng, -8, 8), color: '#ffd166' });
    S.events.push({ kind: 'shotSound', x: ped.x, y: ped.y });
    if (rng() < hitChance) S.events.push({ kind: 'playerHit', dmg: range(rng, 5, 11), x: P.x, y: P.y });
  } else if (P.inCar && P.car && d < 380) {
    ped.shootT = range(rng, 0.8, 1.6);
    S.events.push({ kind: 'tracer', x1: ped.x, y1: ped.y, x2: P.car.x, y2: P.car.y, color: '#ffd166' });
    S.events.push({ kind: 'shotSound', x: ped.x, y: ped.y });
    if (rng() < 0.4) S.events.push({ kind: 'carHit', car: P.car, dmg: range(rng, 2, 5), x: P.car.x, y: P.car.y });
  }
}

/** Cars meet people: anyone a fast car reaches is hurt, and it is news. */
function runOverCheck(S) {
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar || ped.role === 'officer') continue;
    for (const car of S.cars) {
      if (car.dead) continue;
      const reach = car.len * 0.52;
      if (Math.abs(car.speed) <= 55) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) >= reach) continue;
      ped.hp -= Math.abs(car.speed) * 0.16;
      ped.state = 'flee';
      ped.fleeT = 2.5;
      S.danger = { x: ped.x, y: ped.y, t: 3 };
      S.events.push({ kind: 'thud', x: ped.x, y: ped.y });
      if (ped.hp <= 0) {
        ped.dead = true;
        S.events.push({ kind: 'pedDown', ped, byPlayer: car.role === 'player', fatal: true });
      } else if (car.role === 'player') {
        S.events.push({ kind: 'pedDown', ped, byPlayer: true, fatal: false });
      }
      break;
    }
  }
}

/** Hurt a pedestrian; walkers flee, and at zero health they fall. */
export function hurtPed(S, ped, dmg) {
  if (ped.dead) return false;
  ped.hp -= dmg;
  if (ped.role === 'walker') {
    ped.state = 'flee';
    ped.fleeT = 3;
  }
  if (ped.hp <= 0) {
    ped.dead = true;
    S.events.push({ kind: 'pedDown', ped, byPlayer: true, fatal: true });
    return true;
  }
  return false;
}
