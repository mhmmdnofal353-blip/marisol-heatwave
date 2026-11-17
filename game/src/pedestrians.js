// The people of Marisol Bay: strollers on the sidewalks, bystanders who run
// from trouble, and the few with jobs to do — rival gangers with guns, police
// officers on foot, passengers and friends the missions care about.

import { ROADS, PED_SHIRTS, PED_SKIN } from './config.js';
import { pick, range, chance } from './random.js';
import { collideCircle } from './city.js';

const WALKER_TARGET = 26;
let pedSeq = 1;

/** Make a pedestrian. Role is 'walker' unless a mission or the law says otherwise. */
export function createPed(x, y, rng, role = 'walker') {
  return {
    id: pedSeq++,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: 0,
    hp: role === 'ganger' ? 40 : 20,
    shirt: role === 'ganger' ? '#28418c' : role === 'officer' ? '#1d3557' : pick(rng, PED_SHIRTS),
    skin: pick(rng, PED_SKIN),
    hair: pick(rng, ['#22223b', '#6f1d1b', '#99582a', '#e0aaff', '#f2f2f2']),
    role,
    state: 'walk',
    tx: x,
    ty: y,
    waitT: 0,
    fleeT: 0,
    shootT: range(rng, 0.4, 1.4),
    phase: range(rng, 0, 6),
    dead: false,
    inCar: null,
    name: null,
    mission: null,
  };
}

/** A point on a sidewalk: beside a road, a stroll away from (x, y). */
function sidewalkTarget(rng, x, y) {
  if (chance(rng, 0.5)) {
    const a = pick(rng, ROADS.avenues);
    return { x: a + (chance(rng, 0.5) ? -1 : 1) * ROADS.walk, y: y + range(rng, -420, 420) };
  }
  const s = pick(rng, ROADS.streets);
  return { x: x + range(rng, -420, 420), y: s + (chance(rng, 0.5) ? -1 : 1) * ROADS.walk };
}

/** Keep the sidewalks alive around the player. */
export function maintainPeds(S) {
  const rng = S.rng;
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.role === 'walker' && !ped.dead && Math.hypot(ped.x - S.player.x, ped.y - S.player.y) > 1050) S.peds.splice(i, 1);
  }
  let count = 0;
  for (const ped of S.peds) if (ped.role === 'walker' && !ped.dead) count++;
  while (count < WALKER_TARGET) {
    const t = sidewalkTarget(rng, S.player.x, S.player.y);
    const d = Math.hypot(t.x - S.player.x, t.y - S.player.y);
    if (d < 460 || d > 900) continue;
    S.peds.push(createPed(t.x, t.y, rng));
    count++;
  }
}

function movePed(S, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) {
    ped.speed = 0;
    return true;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = speed;
  ped.phase += dt * speed * 0.09;
  const pos = { x: ped.x + (dx / d) * speed * dt, y: ped.y + (dy / d) * speed * dt };
  collideCircle(S.city, pos, 7);
  ped.x = pos.x;
  ped.y = pos.y;
  return false;
}

/** One step for every pedestrian: stroll, flee, fight, chase or ride. */
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
    // Trouble nearby sends walkers running.
    if (ped.role === 'walker' && S.danger.t > 0 && Math.hypot(ped.x - S.danger.x, ped.y - S.danger.y) < 240) {
      ped.state = 'flee';
      ped.fleeT = range(rng, 1.6, 3.2);
    }
    switch (ped.state) {
      case 'flee': {
        ped.fleeT -= dt;
        const away = Math.atan2(ped.y - S.danger.y, ped.x - S.danger.x);
        movePed(S, ped, ped.x + Math.cos(away) * 120, ped.y + Math.sin(away) * 120, 168, dt);
        if (ped.fleeT <= 0) ped.state = 'walk';
        break;
      }
      case 'fight': {
        // A ganger keeps his range, strafes, and shoots on a ragged rhythm —
        // but only once the player is in his world; from across the city he waits.
        const d = Math.hypot(P.x - ped.x, P.y - ped.y);
        if (d > 540) {
          ped.speed = 0;
          break;
        }
        ped.angle = Math.atan2(P.y - ped.y, P.x - ped.x);
        if (d > 210) movePed(S, ped, P.x, P.y, 120, dt);
        else if (d < 110) movePed(S, ped, ped.x - (P.x - ped.x), ped.y - (P.y - ped.y), 110, dt);
        else {
          ped.phase += dt * 3;
          const sx = ped.x + Math.cos(ped.angle + Math.PI / 2) * Math.sin(S.time * 0.7 + ped.id) * 30;
          const sy = ped.y + Math.sin(ped.angle + Math.PI / 2) * Math.sin(S.time * 0.7 + ped.id) * 30;
          movePed(S, ped, sx, sy, 55, dt);
        }
        ped.shootT -= dt;
        if (ped.shootT <= 0 && d < 330 && !P.inCar) {
          ped.shootT = range(rng, 0.7, 1.5);
          const hit = rng() < Math.max(0.12, 0.52 - d / 700);
          S.events.push({ kind: 'tracer', x1: ped.x, y1: ped.y, x2: P.x + range(rng, -8, 8), y2: P.y + range(rng, -8, 8), color: '#ffd166' });
          S.events.push({ kind: 'shotSound', x: ped.x, y: ped.y });
          if (hit) S.events.push({ kind: 'playerHit', dmg: range(rng, 5, 11), x: P.x, y: P.y });
        } else if (ped.shootT <= 0 && d < 380 && P.inCar && P.car) {
          ped.shootT = range(rng, 0.8, 1.6);
          S.events.push({ kind: 'tracer', x1: ped.x, y1: ped.y, x2: P.car.x, y2: P.car.y, color: '#ffd166' });
          S.events.push({ kind: 'shotSound', x: ped.x, y: ped.y });
          if (rng() < 0.4) S.events.push({ kind: 'carHit', car: P.car, dmg: range(rng, 2, 5), x: P.car.x, y: P.car.y });
        }
        break;
      }
      case 'chase': {
        // An officer on foot runs the player down; the bust itself is the law's business (police.js).
        movePed(S, ped, P.x, P.y, 178, dt);
        ped.angle = Math.atan2(P.y - ped.y, P.x - ped.x);
        break;
      }
      case 'wait': {
        ped.speed = 0;
        ped.phase += dt * 1.2;
        break;
      }
      case 'ride': {
        break; // seated: position follows the car above
      }
      default: {
        // A stroll: amble to the target, pause, choose another.
        if (ped.waitT > 0) {
          ped.waitT -= dt;
          ped.speed = 0;
          break;
        }
        if (movePed(S, ped, ped.tx, ped.ty, 62, dt)) {
          if (chance(rng, 0.3)) ped.waitT = range(rng, 1, 4);
          const t = sidewalkTarget(rng, ped.x, ped.y);
          ped.tx = t.x;
          ped.ty = t.y;
        }
      }
    }
  }
  // Cars and people: a fast car through a crowd is a crime and a tragedy.
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar || ped.role === 'officer') continue;
    for (const car of S.cars) {
      if (car.dead) continue;
      const reach = car.len * 0.52;
      if (Math.abs(car.speed) > 55 && Math.hypot(ped.x - car.x, ped.y - car.y) < reach) {
        ped.hp -= Math.abs(car.speed) * 0.16;
        ped.state = 'flee';
        ped.fleeT = 2.5;
        S.danger = { x: ped.x, y: ped.y, t: 3 };
        S.events.push({ kind: 'thud', x: ped.x, y: ped.y });
        if (ped.hp <= 0 && !ped.dead) {
          ped.dead = true;
          S.events.push({ kind: 'pedDown', ped, byPlayer: car.role === 'player', fatal: true });
        } else if (car.role === 'player') {
          S.events.push({ kind: 'pedDown', ped, byPlayer: true, fatal: false });
        }
        break;
      }
    }
  }
}

/** Hurt a pedestrian; at zero they fall. Returns true if they fell. */
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
