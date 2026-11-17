// police.js — the MBPD. A wanted level fed by witnessed crime: heat points
// climb per offence and cool only once the hunt gives up. Pursuit drivers
// steer to where Juno is going, not where she is; officers step out on
// foot when she is walking; four stars puts roadblocks across the road
// ahead; and a cornered, slow player fills the BUSTED meter. A mission can
// lock the level at a floor (a rescue run under a guaranteed three stars),
// and a respray clears the whole slate.

import { CRIME, HEAT_PER_STAR, POLICE_COUNT } from './config.js';
import { createCar, steerControls, stepCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { roadPoint } from './city.js';

/** A fresh wanted state: no heat, no hunt, no meter. */
export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    locked: 0, // floor a mission holds the level at, in stars
    searchT: 0, // seconds of searching left before the heat bleeds
    seen: false,
    lastSeen: { x: 0, y: 0 },
    bust: 0, // the arrest meter, 0..1
    roadblockT: 8,
    spawnT: 0,
  };
}

/** How many stars a heat total earns. */
export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i <= 5; i++) if (heat >= HEAT_PER_STAR[i]) stars = i;
  return stars;
}

/**
 * Whether a crime at (x, y) had a witness: a police car near enough to see
 * it, or any bystander close enough to talk. Gangers never talk.
 */
export function witnessed(S, x, y) {
  for (const car of S.cars) {
    if (car.role === 'police' && !car.dead && Math.hypot(car.x - x, car.y - y) < 560) return true;
  }
  for (const ped of S.peds) {
    if (ped.dead || ped.role === 'ganger') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < 175) return true;
  }
  return false;
}

/** Report a crime by key ('carjack', 'hitPed', ...). Unseen crime is free. */
export function reportCrime(S, kind, x, y) {
  const W = S.wanted;
  if (kind === 'missionFelony' || witnessed(S, x, y)) {
    W.heat = Math.min(240, W.heat + CRIME[kind]);
    W.searchT = Math.max(W.searchT, 5);
    W.lastSeen = { x: S.player.x, y: S.player.y };
  }
  S.danger = { x, y, t: 3 };
}

/** Set the level outright: missions raising it, resprays wiping it. */
export function setWanted(S, stars, lock = 0) {
  const W = S.wanted;
  W.heat = stars === 0 ? 0 : HEAT_PER_STAR[stars];
  W.locked = lock;
  W.searchT = stars > 0 ? 6 : 0;
  W.bust = 0;
}

/** Distance to the nearest living police unit, car or officer. */
export function nearestPoliceDist(S) {
  let best = Infinity;
  for (const car of S.cars) {
    if (car.role === 'police' && !car.dead) {
      best = Math.min(best, Math.hypot(car.x - S.player.x, car.y - S.player.y));
    }
  }
  for (const ped of S.peds) {
    if (ped.role === 'officer' && !ped.dead) {
      best = Math.min(best, Math.hypot(ped.x - S.player.x, ped.y - S.player.y));
    }
  }
  return best;
}

/** Send one more interceptor in from a road in the ring round the player. */
function dispatchCar(S) {
  const spot = roadPoint(S.rng, S.player.x, S.player.y, 640, 880);
  const car = createCar('police', spot.x, spot.y,
    Math.atan2(S.player.y - spot.y, S.player.x - spot.x), 'police', S.rng);
  S.cars.push(car);
}

/** The whole law, one step: eyes, heat, staffing, pursuit, arrest. */
export function updatePolice(S, dt) {
  const W = S.wanted;
  const P = S.player;
  W.stars = Math.max(starsForHeat(W.heat), W.locked);

  // Eyes on Juno? A car within sight, an officer closer still.
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
  } else {
    // Unseen and unsearched-for: heat cools to the locked floor, if any.
    const floor = HEAT_PER_STAR[W.locked];
    if (W.heat > floor) W.heat = Math.max(floor, W.heat - 6.5 * dt);
  }
  W.stars = Math.max(starsForHeat(W.heat), W.locked);

  staffTheHunt(S, dt);
  driveTheHunt(S, dt);
  watchRoadblocks(S, dt);
  watchArrest(S, dt);
}

/** Field the car count the level calls for; retire the far and the dead. */
function staffTheHunt(S, dt) {
  const W = S.wanted;
  const P = S.player;
  let active = 0;
  for (const car of S.cars) if (car.role === 'police' && !car.dead) active++;
  if (active < POLICE_COUNT[W.stars]) {
    W.spawnT -= dt;
    if (W.spawnT <= 0) {
      dispatchCar(S);
      W.spawnT = 1.6;
    }
  }
  // Distant units are called off; a wreck near the player stays as scenery.
  for (let i = S.cars.length - 1; i >= 0; i--) {
    const car = S.cars[i];
    if (car.role !== 'police') continue;
    if (Math.hypot(car.x - P.x, car.y - P.y) > 1150) S.cars.splice(i, 1);
  }
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.role !== 'officer') continue;
    if (W.stars === 0 || Math.hypot(ped.x - P.x, ped.y - P.y) > 700) S.peds.splice(i, 1);
  }
}

/** Pursuit driving: intercept steering, search circles, officers out. */
function driveTheHunt(S, dt) {
  const W = S.wanted;
  const P = S.player;
  for (const car of S.cars) {
    if (car.role !== 'police' || car.dead) continue;
    car.lightT += dt * 6;
    if (car.parked) {
      // A roadblock car waits until the quarry is close, then joins in.
      if (Math.hypot(car.x - P.x, car.y - P.y) < 230) car.parked = false;
      else continue;
    }
    let tx;
    let ty;
    let want = car.top * 0.96;
    const hunting = W.seen || Math.hypot(car.x - W.lastSeen.x, car.y - W.lastSeen.y) > 60;
    if (hunting) {
      const anchor = W.seen ? P : W.lastSeen;
      // Aim where Juno is going: lead the target by her velocity.
      const lead = P.inCar && P.car
        ? Math.min(0.55, Math.hypot(car.x - P.x, car.y - P.y) / 700)
        : 0;
      tx = anchor.x + (P.inCar && P.car ? Math.cos(P.car.angle) * P.car.speed * lead : 0);
      ty = anchor.y + (P.inCar && P.car ? Math.sin(P.car.angle) * P.car.speed * lead : 0);
      const d = Math.hypot(car.x - P.x, car.y - P.y);
      if (!P.inCar && d < 70) want = car.top * 0.3; // pull up alongside her
      if (P.inCar && P.car && d < 34) want = Math.abs(P.car.speed) * 0.92; // sit on the bumper
    } else {
      // Searching: a slow circle around the last place she was seen.
      const a = S.time * 0.25 + car.lightT;
      tx = W.lastSeen.x + Math.cos(a) * 130;
      ty = W.lastSeen.y + Math.sin(a) * 130;
      want = car.top * 0.34;
    }
    const ctrl = steerControls(car, tx, ty, want);
    stepCar(S, car, dt, ctrl);
    // A hunter wedged against a building is quietly re-posted to a road.
    if (Math.abs(car.speed) < 14 && ctrl.throttle > 0.5) {
      car.stuckT += dt;
      if (car.stuckT > 2.6) {
        const spot = roadPoint(S.rng, P.x, P.y, 330, 430);
        car.x = spot.x;
        car.y = spot.y;
        car.stuckT = 0;
      }
    } else {
      car.stuckT = 0;
    }
    // Close, slow, and she is on foot: the officer gets out and runs her down.
    if (!P.inCar && W.stars >= 1 && !car.officerOut
      && Math.hypot(car.x - P.x, car.y - P.y) < 95 && Math.abs(car.speed) < 40) {
      car.officerOut = true;
      const officer = createPed(car.x, car.y, S.rng, 'officer');
      officer.state = 'chase';
      S.peds.push(officer);
    }
    if (Math.hypot(car.x - P.x, car.y - P.y) > 260) car.officerOut = false;
  }
}

/** Four stars and a fast quarry: two interceptors parked across the road. */
function watchRoadblocks(S, dt) {
  const W = S.wanted;
  const P = S.player;
  const rolling = W.stars >= 4 && P.inCar && P.car && Math.abs(P.car.speed) > 120;
  if (!rolling) {
    W.roadblockT = Math.max(W.roadblockT, 4);
    return;
  }
  W.roadblockT -= dt;
  if (W.roadblockT > 0) return;
  W.roadblockT = 16;
  const aheadX = P.x + Math.cos(P.car.angle) * 400;
  const aheadY = P.y + Math.sin(P.car.angle) * 400;
  for (const side of [-24, 24]) {
    const car = createCar('police',
      aheadX + Math.cos(P.car.angle + Math.PI / 2) * side,
      aheadY + Math.sin(P.car.angle + Math.PI / 2) * side,
      P.car.angle + Math.PI / 2, 'police', S.rng);
    car.parked = true;
    S.cars.push(car);
  }
  S.events.push({ kind: 'toast', text: 'Roadblock ahead!' });
}

/** The arrest: cornered and slow under a live wanted level fills the meter. */
function watchArrest(S, dt) {
  const W = S.wanted;
  const P = S.player;
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
