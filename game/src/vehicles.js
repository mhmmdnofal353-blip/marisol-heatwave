// Cars: one arcade physics step every vehicle shares, the traffic that
// drives the grid on its own, and the collisions that bend both. A car is a
// plain object; its `role` says who drives it — traffic, police, a racer,
// the player, or nobody (parked).

import { CAR_TYPES, ROADS } from './config.js';
import { pick, range, chance } from './random.js';
import { collideCircle, roadPoint, surfaceAt } from './city.js';

const TRAFFIC_TYPES = ['compact', 'sedan', 'sedan', 'coupe', 'suv', 'van', 'taxi', 'compact'];
const TRAFFIC_TARGET = 15;

/** Build a car of a catalogue type at a place, facing an angle (radians). */
export function createCar(typeKey, x, y, angle, role, rng) {
  const t = CAR_TYPES[typeKey];
  return {
    type: typeKey,
    label: t.label,
    len: t.len,
    wid: t.wid,
    top: t.top,
    accel: t.accel,
    grip: t.grip,
    maxHp: t.hp,
    hp: t.hp,
    color: pick(rng, t.colours),
    x, y, angle,
    speed: 0,
    pushX: 0,
    pushY: 0,
    steerVis: 0,
    role,
    axis: null, // traffic: 'v' on an avenue, 'h' on a street
    sign: 1, // traffic: direction of travel along the axis
    road: 0, // traffic: the centre line it follows
    cruise: range(rng, 0.38, 0.52), // share of top speed traffic settles at
    honkT: 0,
    lightT: range(rng, 0, 1), // police light phase
    dead: false,
    fireT: 0,
    mission: null, // tag for mission cars ('steal', 'race', 'van'...)
    driverOut: false,
  };
}

/** The car's speed in km/h, for the HUD. */
export function speedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36);
}

/** Controls that steer a car toward a point at a wanted speed: pursuit, racing and traffic all use it. */
export function steerControls(car, tx, ty, wantSpeed) {
  const dx = tx - car.x;
  const dy = ty - car.y;
  const target = Math.atan2(dy, dx);
  let diff = target - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = Math.hypot(dx, dy);
  let throttle = 0;
  if (Math.abs(diff) < 1.9) {
    throttle = car.speed < wantSpeed ? 1 : 0;
    if (car.speed > wantSpeed * 1.25) throttle = -0.6; // overshoot: brake
  } else if (car.speed > 30) {
    throttle = -0.8; // facing away and moving: brake, then reverse out
  } else {
    throttle = -0.7;
  }
  if (dist < 26 && wantSpeed > 0) throttle = Math.min(throttle, 0.2);
  return { throttle, steer, hand: false };
}

/** One physics step under controls {throttle, steer, hand}; shoves and damage included. */
export function stepCar(S, car, dt, ctrl) {
  if (car.dead) {
    car.speed = 0;
    return;
  }
  const surf = surfaceAt(S.city, car.x, car.y);
  const topHere = car.top * (surf === 'sand' ? 0.45 : surf === 'park' ? 0.6 : 1);
  const accel = car.accel * (surf === 'sand' ? 0.55 : 1);
  if (ctrl.throttle > 0) car.speed += accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) car.speed += (car.speed > 8 ? -560 : accel * 0.55 * ctrl.throttle) * dt * (car.speed > 8 ? 1 : 1);
  car.speed -= car.speed * 0.55 * dt; // drag
  if (!ctrl.throttle) car.speed -= car.speed * 0.8 * dt; // engine braking
  car.speed = Math.max(-85, Math.min(topHere, car.speed));
  if (Math.abs(car.speed) < 2 && !ctrl.throttle) car.speed = 0;

  // Signed speed does the reversing flip on its own: forward and steer right
  // turns clockwise on screen; reversing with the same steer swings the nose
  // the other way, as a real car does.
  const turn = ctrl.steer * (car.speed / Math.max(28, car.len)) * (ctrl.hand ? 1.7 : 1.05);
  car.angle += turn * dt * Math.min(1, Math.abs(car.speed) / 60 + 0.25);
  car.steerVis = ctrl.steer;

  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const drift = ctrl.hand ? 0.86 : 0.35; // how much of the shove survives: handbrake slides
  car.pushX *= Math.pow(drift, dt * 10);
  car.pushY *= Math.pow(drift, dt * 10);
  const beforeX = car.x;
  const beforeY = car.y;
  car.x += (fx * car.speed + car.pushX) * dt;
  car.y += (fy * car.speed + car.pushY) * dt;

  // Buildings: test the nose and the tail, keep whichever end is freer.
  const pos = { x: car.x, y: car.y };
  const hit = collideCircle(S.city, pos, 16);
  if (hit) {
    const impact = Math.abs(car.speed);
    car.x = pos.x;
    car.y = pos.y;
    if (impact > 90) {
      damageCar(S, car, (impact - 80) * 0.12, car.x, car.y);
      S.events.push({ kind: 'crash', x: car.x, y: car.y, strength: Math.min(1.4, impact / 240), car });
    }
    car.speed = impact > 60 ? -car.speed * 0.22 : 0;
    car.pushX = 0;
    car.pushY = 0;
  }
  // Skid marks when the tyres are overwhelmed.
  const lat = Math.abs(ctrl.steer) > 0.6 && Math.abs(car.speed) > 170;
  if ((lat || (ctrl.hand && Math.abs(car.speed) > 60)) && Math.abs(car.speed) > 40) {
    S.skids.push({ x: car.x - fx * 10, y: car.y - fy * 10, a: car.angle, life: 9 });
    if (S.skids.length > 420) S.skids.splice(0, S.skids.length - 420);
    if (car.role === 'player') S.events.push({ kind: 'skid', amount: 0.7 });
  }
  void beforeX;
  void beforeY;
}

/** Bend a car: smoke, fire, and at zero hit points an explosion event. */
export function damageCar(S, car, amount, x, y) {
  if (car.dead) return;
  car.hp -= amount;
  S.events.push({ kind: 'sparks', x, y, n: Math.min(10, 3 + amount) });
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    S.events.push({ kind: 'explosion', x: car.x, y: car.y, car });
  }
}

/** Car against car: circles pushed apart, speed traded, panels bent. */
export function collideCars(S, dt) {
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.len + b.len) * 0.36;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = rr - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const av = a.speed * Math.cos(a.angle) * nx + a.speed * Math.sin(a.angle) * ny;
      const bv = b.speed * Math.cos(b.angle) * nx + b.speed * Math.sin(b.angle) * ny;
      const rel = av - bv;
      if (rel > 26) {
        damageCar(S, a, rel * 0.055, a.x + nx * 14, a.y + ny * 14);
        damageCar(S, b, rel * 0.055, b.x - nx * 14, b.y - ny * 14);
        S.events.push({ kind: 'crash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, strength: Math.min(1.3, rel / 200), car: a.role === 'player' ? a : b });
        if (a.role === 'player' || b.role === 'player') {
          const other = a.role === 'player' ? b : a;
          S.events.push({ kind: 'crime', crime: other.role === 'police' ? 'hitPolice' : 'hitCar', x: other.x, y: other.y });
        }
      }
      a.pushX -= nx * rel * 0.4;
      a.pushY -= ny * rel * 0.4;
      b.pushX += nx * rel * 0.4;
      b.pushY += ny * rel * 0.4;
      if (Math.abs(a.speed) > 40) a.speed *= 0.82;
      if (Math.abs(b.speed) > 40) b.speed *= 0.82;
    }
  }
  void dt;
}

// --- traffic ---------------------------------------------------------------

/** Which lane a car on a centre line must keep, given its axis and direction. */
function laneTarget(car) {
  if (car.axis === 'v') return { x: car.road + (car.sign < 0 ? ROADS.lane : -ROADS.lane), y: car.y + car.sign * 150 };
  return { x: car.x + car.sign * 150, y: car.road + (car.sign > 0 ? ROADS.lane : -ROADS.lane) };
}

/** Anything solid in the car's path within `dist`: another car, the player, a pedestrian. */
function blockedAhead(S, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const px = car.x + fx * dist;
  const py = car.y + fy * dist;
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    if (Math.hypot(other.x - px, other.y - py) < 24) return true;
  }
  if (S.player.car !== car && !S.player.inCar) {
    if (Math.hypot(S.player.x - px, S.player.y - py) < 20) return true;
  }
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar) continue;
    if (Math.hypot(ped.x - px, ped.y - py) < 17) return true;
  }
  return false;
}

/** Drive every traffic car one step: follow the lane, turn at crossings, brake for life. */
export function updateTraffic(S, dt) {
  const rng = S.rng;
  for (const car of S.cars) {
    if (car.role !== 'traffic' || car.dead) continue;
    // Near a crossing, sometimes turn onto the crossing road.
    const cross = car.axis === 'v' ? ROADS.streets : ROADS.avenues;
    for (const c of cross) {
      const along = car.axis === 'v' ? car.y : car.x;
      if (Math.abs(along - c) < 13 && chance(rng, 0.012)) {
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.road = c;
        car.sign = chance(rng, 0.5) ? 1 : -1;
        break;
      }
    }
    const target = laneTarget(car);
    const ctrl = steerControls(car, target.x, target.y, car.top * car.cruise);
    // Ease the lane position in: steer toward the lane line itself.
    if (car.axis === 'v') car.x += (target.x - car.x) * Math.min(1, dt * 1.4);
    else car.y += (target.y - car.y) * Math.min(1, dt * 1.4);
    if (blockedAhead(S, car, 58)) {
      ctrl.throttle = car.speed > 12 ? -1 : 0;
      if (car.speed < 12 && chance(rng, dt * 0.14)) S.events.push({ kind: 'horn', x: car.x, y: car.y });
    }
    stepCar(S, car, dt, ctrl);
  }
}

/** Keep the streets populated: spawn near the player, retire the far ones. */
export function maintainTraffic(S) {
  const rng = S.rng;
  const px = S.player.x;
  const py = S.player.y;
  for (let i = S.cars.length - 1; i >= 0; i--) {
    const car = S.cars[i];
    if (car.role === 'traffic' && Math.hypot(car.x - px, car.y - py) > 980) S.cars.splice(i, 1);
  }
  let count = 0;
  for (const car of S.cars) if (car.role === 'traffic') count++;
  while (count < TRAFFIC_TARGET) {
    // Find a stretch of road with room on it: spawning inside another car is
    // how a quiet street becomes a nine-car pile-up at the lights.
    let p = null;
    for (let tries = 0; tries < 8 && !p; tries++) {
      const cand = roadPoint(rng, px, py, 540, 820);
      if (S.cars.every((c) => Math.hypot(c.x - cand.x, c.y - cand.y) > 95)) p = cand;
    }
    if (!p) break;
    // Decide the road the point belongs to and face along it, in the right lane.
    const onAvenue = ROADS.avenues.some((a) => Math.abs(p.x - a) <= ROADS.width / 2);
    const car = createCar(pick(rng, TRAFFIC_TYPES), p.x, p.y, 0, 'traffic', rng);
    if (onAvenue) {
      car.axis = 'v';
      car.road = ROADS.avenues.reduce((best, a) => (Math.abs(a - p.x) < Math.abs(best - p.x) ? a : best), ROADS.avenues[0]);
      car.sign = chance(rng, 0.5) ? 1 : -1;
      car.x = car.road + (car.sign < 0 ? ROADS.lane : -ROADS.lane);
      car.angle = car.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'h';
      car.road = ROADS.streets.reduce((best, s) => (Math.abs(s - p.y) < Math.abs(best - p.y) ? s : best), ROADS.streets[0]);
      car.sign = chance(rng, 0.5) ? 1 : -1;
      car.y = car.road + (car.sign > 0 ? ROADS.lane : -ROADS.lane);
      car.angle = car.sign > 0 ? 0 : Math.PI;
    }
    S.cars.push(car);
    count++;
  }
}

/** Fill the city's marked bays with parked cars the player can take. */
export function seedParkedCars(S) {
  const rng = S.rng;
  for (const spot of S.city.parkedSpots) {
    if (!chance(rng, 0.85)) continue;
    const type = pick(rng, TRAFFIC_TYPES.concat(['sports', 'coupe']));
    const car = createCar(type, spot.x, spot.y, spot.angle + range(rng, -0.05, 0.05), 'parked', rng);
    S.cars.push(car);
  }
  // A few cars parked along the beach road and at the places that matter.
  const extras = [
    ['sports', S.city.places.warehouse.x + 70, S.city.places.warehouse.y + 26, 0.2],
    ['coupe', S.city.places.safehouse.x - 60, S.city.places.safehouse.y + 20, -0.4],
    ['sedan', S.city.places.cafe.x + 56, S.city.places.cafe.y + 24, 0.1],
  ];
  for (const [type, x, y, a] of extras) S.cars.push(createCar(type, x, y, a, 'parked', rng));
}
