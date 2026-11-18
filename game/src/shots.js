// shots.js — the staged scenes behind ?shot=title|chase|foot|beach, used
// for the entry's screenshots. Each scene poses the real game — real cars,
// real police, the real HUD state — at a seeded moment, and the main loop
// then runs the world forward a few fixed steps with an autopilot at the
// wheel, so the captured frame is a game being played, not a diorama. The
// same seed stages the same scene every time, which keeps the four
// screenshots reproducible.

import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { setWanted } from './police.js';

/**
 * Pose the named scene on a fresh state S.
 * Returns how many seconds the scene should run before it is captured.
 */
export function stageShot(S, name) {
  const P = S.player;
  const city = S.city;
  switch (name) {
    case 'chase': {
      // The cover shot: four stars down the Avenida del Sol, the finale's
      // errand written on the HUD, the law in a pincer around her.
      P.inCar = true;
      const car = createCar('sports', 2022, 2150, -Math.PI / 2, 'player', S.rng);
      car.speed = 295;
      car.color = '#ef476f';
      S.cars.push(car);
      P.car = car;
      P.x = car.x;
      P.y = car.y;
      setWanted(S, 4);
      // Strung out behind her in a pursuit line — same lane, oncoming lane,
      // shoulder — so the frame reads as a chase, not a pile-up.
      const pursuit = [[2022, 2345, 306], [1978, 2490, 300], [2066, 2760, 312]];
      for (const [x, y, speed] of pursuit) {
        const cop = createCar('police', x, y, -Math.PI / 2, 'police', S.rng);
        cop.speed = speed;
        S.cars.push(cop);
      }
      const traffic = [['sedan', 2022, 1830, 150], ['compact', 1978, 1690, 140], ['coupe', 2022, 1450, 165]];
      for (const [type, x, y, speed] of traffic) {
        const t = createCar(type, x, y, -Math.PI / 2, 'traffic', S.rng);
        t.axis = 'v';
        t.road = 2000;
        t.sign = -1;
        t.speed = speed;
        S.cars.push(t);
      }
      S.objective = {
        title: 'Heatwave',
        text: "Deliver the van to Vera's yard — the law is locked on",
        x: city.places.warehouse.x,
        y: city.places.warehouse.y,
        timer: null,
      };
      S.screen = 'play';
      return 1.3;
    }
    case 'foot': {
      // On foot on the Palmera Strip: Serpents ahead, Tito at her shoulder,
      // Vera on the phone, one star of law already interested.
      P.x = 3738;
      P.y = 1040;
      P.angle = -0.5;
      for (let i = 0; i < 3; i++) {
        const ganger = createPed(3790 + i * 26, 950 + (i % 2) * 34, S.rng, 'ganger');
        ganger.state = 'fight';
        ganger.angle = Math.PI * 0.8;
        S.peds.push(ganger);
      }
      const tito = createPed(3706, 1066, S.rng, 'friend');
      tito.state = 'wait';
      tito.name = 'Tito Reyes';
      tito.shirt = '#ffd166';
      S.peds.push(tito);
      const cop = createCar('police', 3660, 1130, 0.7, 'police', S.rng);
      S.cars.push(cop);
      setWanted(S, 1);
      S.objective = {
        title: 'Serpent Season',
        text: 'Clear the Glass Serpents — 3 left',
        x: 3800, y: 950, timer: null,
      };
      S.dialogue = {
        lines: [{ who: 'Vera Solano', text: "Ivo's boys, dead ahead. Loud or quiet, Juno — but finish it." }],
        i: 0,
      };
      S.screen = 'play';
      return 1.05; // long enough for Vera's dialogue box to settle open
    }
    case 'beach': {
      // The Dune Raider on the shore road, hunting the parcels: seven
      // already banked, and the next one glowing on the sand ahead.
      P.inCar = true;
      const car = createCar('buggy', 3980, 1402, 0, 'player', S.rng);
      car.speed = 215;
      car.color = '#ffb703';
      S.cars.push(car);
      P.car = car;
      P.x = car.x;
      P.y = car.y;
      const van = createCar('van', 3740, 1424, Math.PI, 'traffic', S.rng);
      van.axis = 'h';
      van.road = 1380;
      van.sign = -1;
      van.speed = 120;
      S.cars.push(van);
      S.city.stashes.forEach((stash, i) => { if (i < 7) stash.taken = true; });
      const next = S.city.stashes.find((stash) => !stash.taken);
      if (next) {
        next.x = 4490;
        next.y = 1330;
      }
      S.objective = {
        title: 'Hidden Parcels',
        text: 'Bank the glowing parcels hidden all over Marisol Bay',
        x: 4490, y: 1330, timer: null,
      };
      S.checkpoints = null;
      S.screen = 'play';
      return 1.4;
    }
    default: {
      // The title scene: no staging at all — the camera drifts over the
      // Old Marina at golden hour behind the wordmark.
      S.screen = 'title';
      P.x = city.places.warehouse.x;
      P.y = city.places.warehouse.y + 60;
      return 0.5;
    }
  }
}

/**
 * The autopilot that drives Juno's car while a scene runs: aim at a point
 * ahead of the nose and hold a brisk pace. Returns a steerControls target,
 * or null when she is on foot.
 */
export function shotDrive(S) {
  const car = S.player.car;
  if (!car) return null;
  const lookAhead = 190;
  return {
    tx: car.x + Math.cos(car.angle) * lookAhead,
    ty: car.y + Math.sin(car.angle) * lookAhead,
    want: car.top * 0.75, // a brisk pace: the cover frame should feel fast
  };
}
