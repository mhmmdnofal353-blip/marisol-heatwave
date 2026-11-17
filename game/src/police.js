// The law: a wanted level fed by witnessed crime, patrols that hunt the
// player's last seen position, pursuit driving, roadblocks at four stars,
// officers on foot, and the slow fill of the BUSTED meter when they corner
// you. Lose their eyes long enough and the heat bleeds away.

import { CRIME, HEAT_PER_STAR, POLICE_COUNT } from './config.js';
import { createCar, steerControls, stepCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { roadPoint } from './city.js';

/** A fresh wanted state for a new game. */
export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    locked: 0, // a mission can hold the level at a floor
    searchT: 0,
    seen: false,
    lastSeen: { x: 0, y: 0 },
    bust: 0,
    roadblockT: 8,
  };
}

/** Stars for a heat total: the level the HUD shows. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i <= 5; i++) if (heat >= HEAT_PER_STAR[i]) stars = i;
  return stars;
}

/** Whether anyone — an officer or a bystander close enough to talk — saw a crime at (x, y). */
export function witnessed(S, x, y) {
  for (const car of S.cars) {
    if (car.role === 'police' && !car.dead && Math.hypot(car.x - x, car.y - y) < 560) return true;
  }
  for (const ped of S.peds) {
    if (!ped.dead && ped.role !== 'ganger' && Math.hypot(ped.x - x, ped.y - y) < 175) return true;
  }
  return false;
}

/** Report a crime by key ('carjack', 'hitPed', ...): heat only if it was seen. */
export function reportCrime(S, kind, x, y) {
  const W = S.wanted;
  if (witnessed(S, x, y) || kind === 'missionFelony') {
    W.heat = Math.min(240, W.heat + CRIME[kind]);
    W.searchT = Math.max(W.searchT, 5);
    W.lastSeen = { x: S.player.x, y: S.player.y };
    S.events.push({ kind: 'crimeSeen', crime: kind, x, y });
  }
  S.danger = { x, y, t: 3 };
}

/** Set the wanted level directly (missions, resprays, arrests). */
export function setWanted(S, stars, lock = 0) {
  const W = S.wanted;
  W.heat = stars === 0 ? 0 : HEAT_PER_STAR[stars];
  W.locked = lock;
  W.searchT = stars > 0 ? 6 : 0;
  W.bust = 0;
}

/** The nearest police unit's distance to the player, for sirens and nerves. */
export function nearestPoliceDist(S) {
  let best = Infinity;
  for (const car of S.cars) {
    if (car.role === 'police' && !car.dead) best = Math.min(best, Math.hypot(car.x - S.player.x, car.y - S.player.y));
  }
  for (const ped of S.peds) {
    if (ped.role === 'officer' && !ped.dead) best = Math.min(best, Math.hypot(ped.x - S.player.x, ped.y - S.player.y));
  }
  return best;
}

function spawnPoliceCar(S) {
  const rng = S.rng;
  const p = roadPoint(rng, S.player.x, S.player.y, 640, 880);
  const car = createCar('police', p.x, p.y, Math.atan2(S.player.y - p.y, S.player.x - p.x), 'police', rng);
  car.stuckT = 0;
  S.cars.push(car);
}

/** Keep the hunt staffed, hunt, and watch for the arrest. */
export function updatePolice(S, dt) {
  const W = S.wanted;
  const P = S.player;
  W.stars = Math.max(starsForHeat(W.heat), W.locked);

  // Eyes on the player?
  W.seen = false;
  for (const car of S.cars) {
    if (car.role === 'police' && !car.dead && Math.hypot(car.x - P.x, car.y - P.y) < 430) W.seen = true;
  }
  for (const ped of S.peds) {
    if (ped.role === 'officer' && !ped.dead && Math.hypot(ped.x - P.x, ped.y - P.y) < 200) W.seen = true;
  }
  if (W.seen) {
    W.searchT = 7;
    W.lastSeen = { x: P.x, y: P.y };
  } else if (W.searchT > 0) {
    W.searchT -= dt;
  } else if (W.heat > HEAT_PER_STAR[W.locked] || (W.locked === 0 && W.heat > 0)) {
    W.heat = Math.max(HEAT_PER_STAR[W.locked], W.heat - 6.5 * dt);
  }
  W.stars = Math.max(starsForHeat(W.heat), W.locked);

  // Staffing: send the count the level calls for, retire the far surplus.
  let active = 0;
  for (const car of S.cars) if (car.role === 'police' && !car.dead) active++;
  const wanted = POLICE_COUNT[W.stars];
  if (active < wanted) {
    W.spawnT = (W.spawnT ?? 0) - dt;
    if (W.spawnT <= 0) {
      spawnPoliceCar(S);
      W.spawnT = 1.6;
    }
  }
  for (let i = S.cars.length - 1; i >= 0; i--) {
    const car = S.cars[i];
    if (car.role === 'police' && (car.dead || Math.hypot(car.x - P.x, car.y - P.y) > 1150)) {
      if (!car.dead || Math.hypot(car.x - P.x, car.y - P.y) > 1150) S.cars.splice(i, 1);
    }
  }
  // Officers vanish when the heat dies or they fall too far behind.
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.role === 'officer' && (W.stars === 0 || Math.hypot(ped.x - P.x, ped.y - P.y) > 700)) S.peds.splice(i, 1);
  }

  // Pursuit driving.
  for (const car of S.cars) {
    if (car.role !== 'police' || car.dead) continue;
    car.lightT += dt * 6;
    if (car.parked) {
      // A roadblock waits until the player is close, then joins the hunt.
      if (Math.hypot(car.x - P.x, car.y - P.y) < 230) car.parked = false;
      else continue;
    }
    const anchor = W.seen || Math.hypot(car.x - W.lastSeen.x, car.y - W.lastSeen.y) > 60 ? (W.seen ? P : W.lastSeen) : null;
    let tx;
    let ty;
    let want = car.top * 0.96;
    if (anchor) {
      // Aim where the player is going, not where they are.
      const lead = P.inCar && P.car ? Math.min(0.55, Math.hypot(car.x - P.x, car.y - P.y) / 700) : 0;
      tx = anchor.x + (P.inCar && P.car ? Math.cos(P.car.angle) * P.car.speed * lead : 0);
      ty = anchor.y + (P.inCar && P.car ? Math.sin(P.car.angle) * P.car.speed * lead : 0);
      const d = Math.hypot(car.x - P.x, car.y - P.y);
      if (!P.inCar && d < 70) want = car.top * 0.3; // on foot: pull up alongside, officer gets out
      if (P.inCar && d < 34) want = Math.abs(P.car.speed) * 0.92; // on the bumper: match, don't pass
    } else {
      // Searching: cruise a slow circle around the last seen point.
      const a = S.time * 0.25 + car.lightT;
      tx = W.lastSeen.x + Math.cos(a) * 130;
      ty = W.lastSeen.y + Math.sin(a) * 130;
      want = car.top * 0.34;
    }
    const ctrl = steerControls(car, tx, ty, want);
    stepCar(S, car, dt, ctrl);
    // Unstick: a hunter wedged on a building is quietly re-posted to a road.
    if (Math.abs(car.speed) < 14 && ctrl.throttle > 0.5) {
      car.stuckT = (car.stuckT ?? 0) + dt;
      if (car.stuckT > 2.6) {
        const p = roadPoint(S.rng, P.x, P.y, 330, 430);
        car.x = p.x;
        car.y = p.y;
        car.stuckT = 0;
      }
    } else car.stuckT = 0;
    // An officer steps out when the player is on foot and the car is close and slow.
    if (!P.inCar && W.stars >= 1 && !car.officerOut && Math.hypot(car.x - P.x, car.y - P.y) < 95 && Math.abs(car.speed) < 40) {
      car.officerOut = true;
      const officer = createPed(car.x, car.y, S.rng, 'officer');
      officer.state = 'chase';
      S.peds.push(officer);
    }
    if (Math.hypot(car.x - P.x, car.y - P.y) > 260) car.officerOut = false;
  }

  // Roadblocks at four stars and up: two interceptors across the road ahead.
  if (W.stars >= 4 && P.inCar && P.car && Math.abs(P.car.speed) > 120) {
    W.roadblockT -= dt;
    if (W.roadblockT <= 0) {
      W.roadblockT = 16;
      const ahead = 400;
      const bx = P.x + Math.cos(P.car.angle) * ahead;
      const by = P.y + Math.sin(P.car.angle) * ahead;
      for (const off of [-24, 24]) {
        const car = createCar('police', bx + Math.cos(P.car.angle + Math.PI / 2) * off, by + Math.sin(P.car.angle + Math.PI / 2) * off, P.car.angle + Math.PI / 2, 'police', S.rng);
        car.parked = true;
        S.cars.push(car);
      }
      S.events.push({ kind: 'toast', text: 'Roadblock ahead!' });
    }
  } else {
    W.roadblockT = Math.max(W.roadblockT, 4);
  }

  // The arrest: cornered and slow, on foot or in a car, fills the meter.
  let cornered = false;
  if (!P.inCar) {
    for (const ped of S.peds) {
      if (ped.role === 'officer' && !ped.dead && Math.hypot(ped.x - P.x, ped.y - P.y) < 27) cornered = true;
    }
  } else if (P.car && Math.abs(P.car.speed) < 26) {
    for (const car of S.cars) {
      if (car.role === 'police' && !car.dead && Math.hypot(car.x - P.x, car.y - P.y) < 62) cornered = true;
    }
  }
  if (W.stars > 0 && cornered) W.bust = Math.min(1, W.bust + dt / 2.2);
  else W.bust = Math.max(0, W.bust - dt / 1.4);
  if (W.bust >= 1) {
    W.bust = 0;
    S.events.push({ kind: 'busted' });
  }
}
