// vehicles.js — everything with four wheels. One arcade physics step
// (stepCar) moves every car in the game, whoever drives it: the player,
// the traffic AI following its lanes, police steering to intercept, race
// rivals chasing checkpoints. Collisions bend panels and trade speed, and
// damage runs smoke, fire, and finally an explosion event the main loop
// turns into noise and shrapnel.

import { CAR_TYPES, ROADS } from './config.js';
import { pick, range, chance } from './random.js';
import { collideCircle, roadPoint, surfaceAt } from './city.js';

const TRAFFIC_MIX = ['compact', 'sedan', 'sedan', 'coupe', 'suv', 'van', 'taxi', 'compact'];
const TRAFFIC_TARGET = 15;

/** Create a car of a catalogue type at a place, facing `angle` radians. */
export function createCar(typeKey, x, y, angle, role, rng) {
  const spec = CAR_TYPES[typeKey];
  return {
    type: typeKey,
    label: spec.label,
    len: spec.len,
    wid: spec.wid,
    top: spec.top,
    accel: spec.accel,
    grip: spec.grip,
    maxHp: spec.hp,
    hp: spec.hp,
    color: pick(rng, spec.colours),
    x, y, angle,
    speed: 0,
    pushX: 0, // sideways shove left over from the last collision
    pushY: 0,
    steerVis: 0, // what the front wheels show, -1..1
    role, // 'traffic' | 'parked' | 'player' | 'police' | 'racer'
    // traffic bookkeeping: which centre line, which way along it
    axis: null,
    sign: 1,
    road: 0,
    cruise: range(rng, 0.38, 0.52), // share of top speed this driver settles at
    honkT: 0,
    lightT: range(rng, 0, 1), // police light-bar phase
    dead: false,
    fireT: 0,
    mission: null, // mission tag: 'steal', 'van', ...
    parked: false, // a roadblock car waiting for its moment
    officerOut: false,
    stuckT: 0,
    cp: 0, // race checkpoint count
    skill: 0, // race pace, 0..1 of top speed
    _brake: false,
  };
}

/** Speed in km/h, for the HUD's speedometer. */
export function speedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Controls that drive a car at a point, at a wanted speed: steer toward it,
 * accelerate up to the pace, brake when overshooting, and reverse out when
 * the point is behind and the car is nearly stopped. Pursuit, racing and
 * traffic all steer through here.
 */
export function steerControls(car, tx, ty, wantSpeed) {
  const diff = wrapAngle(Math.atan2(ty - car.y, tx - car.x) - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let throttle;
  if (Math.abs(diff) < 1.9) {
    throttle = car.speed < wantSpeed ? 1 : 0;
    if (car.speed > wantSpeed * 1.25) throttle = -0.6; // running hot: brake
  } else if (car.speed > 30) {
    throttle = -0.8; // facing away at speed: brake first
  } else {
    throttle = -0.7; // facing away, slow: reverse and swing round
  }
  if (dist < 26 && wantSpeed > 0) throttle = Math.min(throttle, 0.2);
  return { throttle, steer, hand: false };
}

/** One physics step under {throttle, steer, hand}. */
export function stepCar(S, car, dt, ctrl) {
  if (car.dead) {
    car.speed = 0;
    return;
  }
  const surf = surfaceAt(S.city, car.x, car.y);
  const topHere = car.top * (surf === 'sand' ? 0.45 : surf === 'park' ? 0.6 : 1);
  const accelHere = car.accel * (surf === 'sand' ? 0.55 : 1);

  if (ctrl.throttle > 0) {
    car.speed += accelHere * ctrl.throttle * dt;
  } else if (ctrl.throttle < 0) {
    // Brakes bite hard while rolling forward; past a crawl it is reverse.
    car.speed += (car.speed > 8 ? -560 : accelHere * 0.55 * ctrl.throttle) * dt;
  }
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  if (!ctrl.throttle) car.speed -= car.speed * 0.8 * dt; // engine braking
  car.speed = Math.max(-85, Math.min(topHere, car.speed));
  if (Math.abs(car.speed) < 2 && !ctrl.throttle) car.speed = 0;
  car._brake = ctrl.throttle < 0 && car.speed > 8;

  // Steering: the nose follows a turning circle whose radius tightens with
  // the handbrake. Signed speed does the reversing flip for free — back up
  // with left lock and the nose swings right, like a real car.
  const radius = car.len * (ctrl.hand ? 1.8 : 3.1);
  const authority = Math.min(1, Math.abs(car.speed) / 55 + 0.2);
  car.angle += ctrl.steer * (car.speed / radius) * authority * dt;
  car.steerVis = ctrl.steer;

  // Leftover shove decays; a handbrake slide keeps most of it.
  const keep = Math.pow(ctrl.hand ? 0.86 : 0.35, dt * 10);
  car.pushX *= keep;
  car.pushY *= keep;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  car.x += (fx * car.speed + car.pushX) * dt;
  car.y += (fy * car.speed + car.pushY) * dt;

  // Buildings and crates: one circle stands in for the body.
  const pos = { x: car.x, y: car.y };
  if (collideCircle(S.city, pos, 16)) {
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

  // Tyres overwhelmed — by lock at speed, or by the handbrake — lay rubber.
  const sliding = (Math.abs(ctrl.steer) > 0.6 && Math.abs(car.speed) > 170)
    || (ctrl.hand && Math.abs(car.speed) > 60);
  if (sliding && Math.abs(car.speed) > 40) {
    S.skids.push({ x: car.x - fx * 10, y: car.y - fy * 10, a: car.angle, life: 9 });
    if (S.skids.length > 420) S.skids.splice(0, S.skids.length - 420);
    if (car.role === 'player') S.events.push({ kind: 'skid', amount: 0.7 });
  }
}

/** Damage a car: sparks now; at zero hit points it burns (explosion event). */
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

/** Car against car: circles pushed apart, closing speed traded for damage. */
export function collideCars(S) {
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = (a.len + b.len) * 0.36;
      const distSq = dx * dx + dy * dy;
      if (distSq > reach * reach || distSq < 0.01) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (reach - dist) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      const aClosing = a.speed * Math.cos(a.angle) * nx + a.speed * Math.sin(a.angle) * ny;
      const bClosing = b.speed * Math.cos(b.angle) * nx + b.speed * Math.sin(b.angle) * ny;
      const closing = aClosing - bClosing;
      if (closing > 26) {
        damageCar(S, a, closing * 0.055, a.x + nx * 14, a.y + ny * 14);
        damageCar(S, b, closing * 0.055, b.x - nx * 14, b.y - ny * 14);
        S.events.push({
          kind: 'crash',
          x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
          strength: Math.min(1.3, closing / 200),
          car: a.role === 'player' ? a : b,
        });
        if (a.role === 'player' || b.role === 'player') {
          const other = a.role === 'player' ? b : a;
          S.events.push({ kind: 'crime', crime: other.role === 'police' ? 'hitPolice' : 'hitCar', x: other.x, y: other.y });
        }
      }
      a.pushX -= nx * closing * 0.4;
      a.pushY -= ny * closing * 0.4;
      b.pushX += nx * closing * 0.4;
      b.pushY += ny * closing * 0.4;
      if (Math.abs(a.speed) > 40) a.speed *= 0.82;
      if (Math.abs(b.speed) > 40) b.speed *= 0.82;
    }
  }
}

// --- traffic ---------------------------------------------------------------

/** The point a traffic car aims at: ahead along its lane, on its own side. */
function laneTarget(car) {
  if (car.axis === 'v') {
    return { x: car.road + (car.sign < 0 ? ROADS.lane : -ROADS.lane), y: car.y + car.sign * 150 };
  }
  return { x: car.x + car.sign * 150, y: car.road + (car.sign > 0 ? ROADS.lane : -ROADS.lane) };
}

/** True when something solid stands in the car's path within `dist`. */
function blockedAhead(S, car, dist) {
  const probeX = car.x + Math.cos(car.angle) * dist;
  const probeY = car.y + Math.sin(car.angle) * dist;
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    if (Math.hypot(other.x - probeX, other.y - probeY) < 24) return true;
  }
  if (!S.player.inCar && Math.hypot(S.player.x - probeX, S.player.y - probeY) < 20) return true;
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar) continue;
    if (Math.hypot(ped.x - probeX, ped.y - probeY) < 17) return true;
  }
  return false;
}

/** One step for every traffic car: lanes, turns at crossings, brakes, horns. */
export function updateTraffic(S, dt) {
  const rng = S.rng;
  for (const car of S.cars) {
    if (car.role !== 'traffic' || car.dead) continue;
    // Rolling through a crossing, a driver sometimes takes the turn.
    const crossings = car.axis === 'v' ? ROADS.streets : ROADS.avenues;
    const along = car.axis === 'v' ? car.y : car.x;
    for (const line of crossings) {
      if (Math.abs(along - line) < 13 && chance(rng, dt * 0.7)) {
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.road = line;
        car.sign = chance(rng, 0.5) ? 1 : -1;
        break;
      }
    }
    const target = laneTarget(car);
    const ctrl = steerControls(car, target.x, target.y, car.top * car.cruise);
    // Settle onto the lane line itself, gently.
    if (car.axis === 'v') car.x += (target.x - car.x) * Math.min(1, dt * 1.4);
    else car.y += (target.y - car.y) * Math.min(1, dt * 1.4);
    if (blockedAhead(S, car, 58)) {
      ctrl.throttle = car.speed > 12 ? -1 : 0;
      if (car.speed < 12 && chance(rng, dt * 0.14)) {
        S.events.push({ kind: 'horn', x: car.x, y: car.y });
      }
    }
    stepCar(S, car, dt, ctrl);
  }
}

/** Keep the streets full: spawn in a ring round the player, retire the far. */
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
    // Room matters: a car spawned inside another is a pile-up, not traffic.
    let spot = null;
    for (let tries = 0; tries < 8 && !spot; tries++) {
      const cand = roadPoint(rng, px, py, 540, 820);
      if (S.cars.every((c) => Math.hypot(c.x - cand.x, c.y - cand.y) > 95)) spot = cand;
    }
    if (!spot) break;
    const car = createCar(pick(rng, TRAFFIC_MIX), spot.x, spot.y, 0, 'traffic', rng);
    const onAvenue = ROADS.avenues.some((a) => Math.abs(spot.x - a) <= ROADS.width / 2);
    if (onAvenue) {
      car.axis = 'v';
      car.road = nearestLine(ROADS.avenues, spot.x);
      car.sign = chance(rng, 0.5) ? 1 : -1;
      car.x = car.road + (car.sign < 0 ? ROADS.lane : -ROADS.lane);
      car.angle = car.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.axis = 'h';
      car.road = nearestLine(ROADS.streets, spot.y);
      car.sign = chance(rng, 0.5) ? 1 : -1;
      car.y = car.road + (car.sign > 0 ? ROADS.lane : -ROADS.lane);
      car.angle = car.sign > 0 ? 0 : Math.PI;
    }
    S.cars.push(car);
    count++;
  }
}

/** The closest centre line in a list to a coordinate. */
function nearestLine(lines, at) {
  return lines.reduce((best, line) => (Math.abs(line - at) < Math.abs(best - at) ? line : best), lines[0]);
}

/** Fill the city's marked bays with parked cars, plus a few at key places. */
export function seedParkedCars(S) {
  const rng = S.rng;
  const takeable = TRAFFIC_MIX.concat(['sports', 'coupe']);
  for (const spot of S.city.parkedSpots) {
    if (!chance(rng, 0.85)) continue;
    const car = createCar(pick(rng, takeable), spot.x, spot.y, spot.angle + range(rng, -0.05, 0.05), 'parked', rng);
    S.cars.push(car);
  }
  const extras = [
    ['sports', S.city.places.warehouse.x + 70, S.city.places.warehouse.y + 26, 0.2],
    ['coupe', S.city.places.safehouse.x - 60, S.city.places.safehouse.y + 20, -0.4],
    ['sedan', S.city.places.cafe.x + 56, S.city.places.cafe.y + 24, 0.1],
  ];
  for (const [type, x, y, angle] of extras) {
    S.cars.push(createCar(type, x, y, angle, 'parked', rng));
  }
}
