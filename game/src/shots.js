// The screenshot scenes behind ?shot=title|chase|foot|drive. Each one poses
// the real game — real cars, real police, the real HUD state — at a seeded
// moment, and the main loop then runs the world forward a few fixed steps
// with an autopilot at the wheel, so the frame is a game being played, not
// a diorama. The same seed stages the same scene every time.

import { createCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { setWanted } from './police.js';

/** Pose the named scene on a fresh state. Returns the seconds to run it for. */
export function stageShot(S, name) {
  const P = S.player;
  const city = S.city;
  switch (name) {
    case 'chase': {
      // The cover: four stars down the Avenida del Sol, the finale's errand on the HUD.
      P.inCar = true;
      const car = createCar('sports', 2022, 2150, -Math.PI / 2, 'player', S.rng);
      car.speed = 295;
      car.color = '#ef476f';
      S.cars.push(car);
      P.car = car;
      P.x = car.x;
      P.y = car.y;
      setWanted(S, 4);
      // A pincer, not a queue: one in the oncoming lane, one on the bumper, one on the shoulder.
      const policeSpots = [[1978, 2240, 300], [2022, 2332, 306], [2040, 2262, 296]];
      for (const [x, y, sp] of policeSpots) {
        const cop = createCar('police', x, y, -Math.PI / 2, 'police', S.rng);
        cop.speed = sp;
        S.cars.push(cop);
      }
      const traffic = [['sedan', 2022, 1830, 150], ['compact', 1978, 1690, 140], ['coupe', 2022, 1450, 165]];
      for (const [type, x, y, sp] of traffic) {
        const t = createCar(type, x, y, -Math.PI / 2, 'traffic', S.rng);
        t.axis = 'v';
        t.road = 2000;
        t.sign = -1;
        t.speed = sp;
        S.cars.push(t);
      }
      S.objective = { title: 'Heatwave', text: "Deliver the van to Vera's yard — the law is locked on", x: city.places.warehouse.x, y: city.places.warehouse.y, timer: null };
      S.screen = 'play';
      return 1.3;
    }
    case 'foot': {
      // On foot on the Palmera Strip: Serpents ahead, Vera on the phone, the city walking by.
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
      S.objective = { title: 'Serpent Season', text: 'Clear the Glass Serpents — 3 left', x: 3800, y: 950, timer: null };
      S.dialogue = {
        lines: [{ who: 'Vera Solano', text: "Ivo's boys, dead ahead. Loud or quiet, Juno — but finish it." }],
        i: 0,
      };
      S.screen = 'play';
      return 0.9;
    }
    case 'drive': {
      // A courier run along the shore: the checkpoint pillar burning by the beach.
      P.inCar = true;
      const car = createCar('coupe', 3980, 1402, 0, 'player', S.rng);
      car.speed = 235;
      car.color = '#e07a5f';
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
      S.objective = { title: 'Courier Run', text: 'Deliver the package to Bahia Beach', x: 4470, y: 1380, timer: 74 };
      S.checkpoints = null;
      S.screen = 'play';
      return 1.4;
    }
    default: {
      // The title: the camera drifts over the Old Marina at golden hour.
      S.screen = 'title';
      P.x = city.places.warehouse.x;
      P.y = city.places.warehouse.y + 60;
      return 0.5;
    }
  }
}

/** The autopilot that drives the player's car while a scene runs: hold the lane, keep speed. */
export function shotDrive(S, dt) {
  const car = S.player.car;
  if (!car) return null;
  void dt;
  const ahead = 190;
  return {
    tx: car.x + Math.cos(car.angle) * ahead,
    ty: car.y + Math.sin(car.angle) * ahead,
    want: car.top * 0.72,
  };
}
