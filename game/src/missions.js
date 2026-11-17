// missions.js — the work. Vera Solano's six-job story for Juno, told in
// dialogue and played in stages, plus the repeatable side jobs the city
// offers once the story is done. A mission is a definition: intro lines, a
// list of stages, outro lines, a reward. Each stage carries its marker,
// its objective line, an optional setup that stages its actors, and the
// condition updateMission watches. The HUD never reads this file — it
// reads S.objective, which updateMission rewrites every frame.

import { createCar, steerControls, stepCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { setWanted } from './police.js';
import { range, pick } from './random.js';

const VERA = 'Vera Solano';
const JUNO = 'Juno';
const TITO = 'Tito Reyes';

/** A stage completed by reaching a point (radius r, in pixels). */
function gotoStage(text, x, y, r = 48, extra = {}) {
  return { kind: 'goto', text, x, y, r, ...extra };
}

/** The six story jobs, in order, placed on the real map of Marisol Bay. */
export function storyMissions(S) {
  const places = S.city.places;
  const docks = S.city.blocks.find((b) => b.col === 5 && b.row === 4);
  const marinaLot = { x: places.warehouse.x - 190, y: places.warehouse.y + 40 };
  const beachEnd = { x: 4650, y: 420 }; // on the sand itself: open ground, no buildings
  return [
    {
      id: 'first-run',
      title: 'First Run',
      reward: { cash: 300, respect: 10 },
      intro: [
        { who: VERA, text: "Juno Marchetti. Five years, no word, and you stroll into my warehouse like the rent just came due." },
        { who: JUNO, text: 'The rent is due, Vera. Everywhere. I need work that pays in cash and asks no questions.' },
        { who: VERA, text: "Then start small. There's a package at the Sunport docks with Café Palma's name on it. Bring it to the Strip. Don't open it, don't be late." },
      ],
      stages: [
        gotoStage('Pick up the package at the Sunport docks', docks.x + docks.w, docks.y + docks.h / 2, 52, { gives: 'package' }),
        gotoStage('Deliver the package to Café Palma', places.cafe.x, places.cafe.y, 52, { needs: 'package', timer: 165 }),
      ],
      outro: [
        { who: VERA, text: 'On time and unopened. The old Juno, then. Tomorrow there are wheels that need borrowing.' },
      ],
    },
    {
      id: 'borrowed-wheels',
      title: 'Borrowed Wheels',
      reward: { cash: 450, respect: 14 },
      intro: [
        { who: VERA, text: 'A yellow Vireo Coupe is parked up on the Strip, keys in it, owner at a long lunch. By sundown it sleeps in my yard.' },
        { who: JUNO, text: 'Grand theft in broad daylight. You have missed me, Vera.' },
        { who: VERA, text: 'The taking will be seen, count on it. Lose the law before my gate, not after — and bring her home whole.' },
      ],
      stages: [
        {
          kind: 'steal', text: 'Steal the marked Vireo Coupe on the Strip', x: 3730, y: 620, r: 60,
          setup(S2, M) {
            const car = createCar('coupe', 3730, 620, Math.PI / 2, 'parked', S2.rng);
            car.color = '#ffd166';
            car.mission = 'steal';
            S2.cars.push(car);
            M.data.car = car;
            M.ownCar(car);
          },
        },
        gotoStage("Deliver the coupe to Vera's yard", places.warehouse.x, places.warehouse.y, 58, { needsCar: true }),
      ],
      outro: [
        { who: VERA, text: 'Not a scratch worth the name. Good. The next job is family, Juno — my nephew Tito has talked himself into a corner.' },
      ],
    },
    {
      id: 'family-business',
      title: 'Family Business',
      reward: { cash: 600, respect: 18 },
      intro: [
        { who: VERA, text: 'Tito ran his mouth at the Glass Serpents down at the docks, and the law heard the echo. Fetch him. Bring him to your loft.' },
        { who: JUNO, text: 'And the three stars of attention Tito travels with?' },
        { who: VERA, text: "They're part of the fare. Get him safe first — then lose them however you like. Family first, heat second." },
      ],
      stages: [
        {
          kind: 'pickup', text: 'Pick up Tito at the Sunport docks', x: docks.x + 60, y: docks.y + 60, r: 62,
          setup(S2, M) {
            const ped = createPed(docks.x + 60, docks.y + 60, S2.rng, 'friend');
            ped.name = TITO;
            ped.state = 'wait';
            ped.shirt = '#ffd166';
            S2.peds.push(ped);
            M.data.ped = ped;
            M.ownPed(ped);
          },
        },
        gotoStage("Drive Tito to Juno's Loft", places.safehouse.x, places.safehouse.y, 58, { passenger: true }),
        { kind: 'escape', text: 'Lose the police', x: places.safehouse.x, y: places.safehouse.y, r: 0, unlock: true },
      ],
      outro: [
        { who: TITO, text: 'You drive like the devil himself is riding shotgun. Aunt Vera said you were the best. She undersold it.' },
      ],
    },
    {
      id: 'serpent-season',
      title: 'Serpent Season',
      reward: { cash: 750, respect: 22 },
      intro: [
        { who: VERA, text: "Ivo Brandt's Serpents have squatted the marina lot and started taxing my drivers. Six of them. Clear it." },
        { who: JUNO, text: 'On foot. Against six guns.' },
        { who: VERA, text: 'You were always better loud than quiet. Mouse to aim, click to shoot — and mind the crossfire, the lot is full of my crates.' },
      ],
      stages: [
        gotoStage('Go to the marina lot', marinaLot.x, marinaLot.y, 60),
        {
          kind: 'kill', text: 'Clear the Glass Serpents from the lot', x: marinaLot.x, y: marinaLot.y, r: 0,
          setup(S2, M) {
            M.data.gang = [];
            for (let i = 0; i < 6; i++) {
              const ped = createPed(
                marinaLot.x + range(S2.rng, -130, 130),
                marinaLot.y + range(S2.rng, -90, 90),
                S2.rng, 'ganger');
              ped.state = 'fight';
              S2.peds.push(ped);
              M.data.gang.push(ped);
              M.ownPed(ped);
            }
          },
        },
        gotoStage("Report back to Vera's warehouse", places.warehouse.x, places.warehouse.y, 56),
      ],
      outro: [
        { who: VERA, text: 'The lot breathes again. Rest while you can — the Avenida Kings race pays nine hundred to whoever wears the crown.' },
      ],
    },
    {
      id: 'avenida-kings',
      title: 'Avenida Kings',
      reward: { cash: 900, respect: 26 },
      intro: [
        { who: VERA, text: 'Nine checkpoints down the avenue and back. Two Serpent drivers who think the crown is theirs. Prove otherwise.' },
        { who: JUNO, text: 'And when the law decides to enter a third car?' },
        { who: VERA, text: 'Then win faster, Juno.' },
      ],
      stages: [
        {
          kind: 'race', text: 'Win the Avenida Kings race', x: 2000, y: 3250, r: 0,
          setup(S2, M) {
            const route = [
              [2000, 3250], [2000, 2460], [2560, 1920], [3120, 1380], [3680, 840],
              [3120, 840], [2560, 1380], [4240, 1920], [4240, 3000],
            ];
            M.data.checkpoints = route.map(([x, y]) => ({ x, y }));
            M.data.cp = 0;
            M.data.rivals = [];
            const rivalTypes = ['sports', 'coupe'];
            for (let i = 0; i < rivalTypes.length; i++) {
              const car = createCar(rivalTypes[i], 1952 - i * 6, 3300 + i * 44, -Math.PI / 2, 'racer', S2.rng);
              car.cp = 0;
              car.skill = 0.86 - i * 0.05;
              S2.cars.push(car);
              M.data.rivals.push(car);
              M.ownCar(car);
            }
            S2.events.push({ kind: 'toast', text: 'Get to the start of Avenida del Sol — the race begins at the first checkpoint!' });
          },
        },
      ],
      outro: [
        { who: VERA, text: 'One job left, and it is the big one. An armored van, half the MBPD on escort, and my whole future in the back of it.' },
      ],
    },
    {
      id: 'heatwave',
      title: 'Heatwave',
      reward: { cash: 1500, respect: 40 },
      intro: [
        { who: VERA, text: 'Tonight the Brinks van parks at the chop shop, fat and careless. Take it. Bring it to my yard. Hold the yard. Then run for the beach.' },
        { who: JUNO, text: 'Four stars of law, the whole Serpent crew, and a van full of other people\'s money. Just like old times.' },
        { who: VERA, text: 'Survive it, and Marisol Bay is yours, Juno. Fail — and we were never friends.' },
      ],
      stages: [
        {
          kind: 'steal', text: 'Steal the armored van at the chop shop', x: places.chopshop.x, y: places.chopshop.y, r: 70,
          setup(S2, M) {
            const van = createCar('armored', places.chopshop.x + 40, places.chopshop.y + 66, 0.4, 'parked', S2.rng);
            van.mission = 'steal';
            S2.cars.push(van);
            M.data.car = van;
            M.ownCar(van);
            for (let i = 0; i < 4; i++) {
              const ped = createPed(
                places.chopshop.x + range(S2.rng, -90, 90),
                places.chopshop.y + range(S2.rng, 30, 110),
                S2.rng, 'ganger');
              ped.state = 'fight';
              S2.peds.push(ped);
              M.ownPed(ped);
            }
          },
        },
        gotoStage("Deliver the van to Vera's yard — the law is locked on", places.warehouse.x, places.warehouse.y, 62, { needsCar: true, lockWanted: 4 }),
        {
          kind: 'defend', text: 'Hold the warehouse yard', x: places.warehouse.x, y: places.warehouse.y, r: 240,
          setup(S2, M) {
            M.data.wave = 0;
            M.data.alive = [];
            M.spawnWave = () => {
              M.data.wave += 1;
              const count = 3 + M.data.wave;
              for (let i = 0; i < count; i++) {
                const a = range(S2.rng, 0, Math.PI * 2);
                const ped = createPed(
                  places.warehouse.x + Math.cos(a) * 330,
                  places.warehouse.y + Math.sin(a) * 330,
                  S2.rng, 'ganger');
                ped.state = 'fight';
                S2.peds.push(ped);
                M.data.alive.push(ped);
                M.ownPed(ped);
              }
              S2.events.push({ kind: 'toast', text: `Wave ${M.data.wave} — Serpents inbound!` });
            };
            M.spawnWave();
          },
        },
        gotoStage('Run for Bahia Beach — end it where it started', beachEnd.x, beachEnd.y, 64),
      ],
      outro: [
        { who: VERA, text: 'The money is buried, the Serpents are scattered, and the MBPD is chasing ghosts down the avenue.' },
        { who: JUNO, text: 'Then Marisol Bay is mine, Vera. Ours. Same thing, on a good day.' },
      ],
    },
  ];
}

/** One repeatable side job: 'delivery', 'fare', or 'theft' (the chop list). */
export function sideJob(S, kind) {
  const rng = S.rng;
  const places = S.city.places;
  // Destinations stand on open ground — place forecourts, parks, car parks —
  // never inside a building's footprint.
  const spots = [places.cafe, places.hospital, places.safehouse, places.warehouse];
  for (const open of [...S.city.parks, ...S.city.lots]) {
    if (rng() < 0.55) spots.push({ x: open.x + open.w / 2, y: open.y + open.h / 2 });
  }
  const from = pick(rng, spots);
  const to = pick(rng, spots);
  const dist = Math.hypot(from.x - to.x, from.y - to.y);
  if (kind === 'delivery') {
    return {
      id: 'side-delivery', title: 'Courier Run', side: true,
      reward: { cash: Math.round(110 + dist / 14), respect: 4 },
      intro: [{ who: 'Dispatcher', text: 'Package on the clock. Wheels up, no questions asked.' }],
      stages: [
        gotoStage('Pick up the package', from.x, from.y, 52, { gives: 'package' }),
        gotoStage('Deliver the package', to.x, to.y, 52, { needs: 'package', timer: Math.round(50 + dist / 26) }),
      ],
      outro: [],
    };
  }
  if (kind === 'fare') {
    return {
      id: 'side-fare', title: 'The Long Fare', side: true,
      reward: { cash: Math.round(90 + dist / 16), respect: 3 },
      intro: [{ who: 'Dispatcher', text: 'A fare is waiting on the kerb. Clean driving earns the tip.' }],
      stages: [
        {
          kind: 'pickup', text: 'Pick up your fare', x: from.x, y: from.y, r: 62,
          setup(S2, M) {
            const ped = createPed(from.x, from.y, S2.rng, 'friend');
            ped.state = 'wait';
            ped.name = 'Fare';
            S2.peds.push(ped);
            M.data.ped = ped;
            M.ownPed(ped);
          },
        },
        gotoStage('Take your fare to the destination', to.x, to.y, 56, { passenger: true }),
      ],
      outro: [],
    };
  }
  // The chop list: one marked parked car, delivered to the docks.
  const spot = S.city.parkedSpots.length
    ? pick(rng, S.city.parkedSpots)
    : { x: from.x, y: from.y, angle: 0 };
  return {
    id: 'side-theft', title: 'Chop List', side: true,
    reward: { cash: 300, respect: 6 },
    intro: [{ who: 'Dispatcher', text: 'One car on the list, marked on your map. The shop pays cash and keeps no names.' }],
    stages: [
      {
        kind: 'steal', text: 'Steal the marked car', x: spot.x, y: spot.y, r: 60,
        setup(S2, M) {
          const car = createCar(pick(S2.rng, ['coupe', 'sports', 'suv']), spot.x, spot.y, spot.angle ?? 0, 'parked', S2.rng);
          car.mission = 'steal';
          S2.cars.push(car);
          M.data.car = car;
          M.ownCar(car);
        },
      },
      gotoStage('Deliver it to the Chop Shop', places.chopshop.x, places.chopshop.y, 58, { needsCar: true }),
    ],
    outro: [],
  };
}

/** Where repeatable work is handed out: place key -> side job kind. */
export const JOB_GIVERS = [
  { place: 'garage0', kind: 'delivery', label: 'Courier work — SunSpray downtown' },
  { place: 'cafe', kind: 'fare', label: 'Fares — Café Palma' },
  { place: 'chopshop', kind: 'theft', label: 'Chop list — Docks' },
];

/** Begin a mission: build its runtime state and stage its first scene. */
export function startMission(S, def) {
  const M = {
    def,
    idx: 0,
    t: 0,
    data: {},
    ownedCars: [],
    ownedPeds: [],
    ownCar(car) { this.ownedCars.push(car); },
    ownPed(ped) { this.ownedPeds.push(ped); },
    spawnWave: null,
  };
  S.mission = M;
  enterStage(S, M, def.stages[0]);
  S.events.push({ kind: 'toast', text: `Mission: ${def.title}` });
  return M;
}

/** Stage a scene: run its setup and apply its wanted-level instructions. */
function enterStage(S, M, stage) {
  if (stage.setup) stage.setup(S, M);
  if (stage.lockWanted) setWanted(S, stage.lockWanted, stage.lockWanted);
  if (stage.unlock) S.wanted.locked = 0; // the hunt may now be lost by hiding
}

/** End a mission either way: free its actors and release any wanted lock. */
export function endMission(S, passed) {
  const M = S.mission;
  if (!M) return;
  for (const car of M.ownedCars) {
    if (S.player.car === car) continue; // the one she is sitting in stays
    const i = S.cars.indexOf(car);
    if (i >= 0) S.cars.splice(i, 1);
  }
  for (const ped of M.ownedPeds) {
    if (ped.inCar) continue;
    const i = S.peds.indexOf(ped);
    if (i >= 0) S.peds.splice(i, 1);
  }
  S.wanted.locked = 0;
  S.mission = null;
  S.objective = null;
  S.checkpoints = null;
  if (passed) {
    S.player.cash += M.def.reward.cash;
    S.player.respect += M.def.reward.respect;
    S.events.push({ kind: 'missionPass', def: M.def });
  } else {
    S.events.push({ kind: 'missionFail', def: M.def });
  }
}

/** The stage the player is currently on, or null between jobs. */
export function currentStage(S) {
  return S.mission ? S.mission.def.stages[S.mission.idx] : null;
}

/** Move to the next stage, or finish the mission if that was the last. */
function advanceStage(S) {
  const M = S.mission;
  const finished = M.def.stages[M.idx];
  if (finished.lockWanted) S.wanted.locked = 0;
  if (finished.passenger && M.data.ped) {
    // The passenger climbs out here and walks back into the city.
    const ped = M.data.ped;
    ped.inCar = null;
    ped.role = 'walker';
    ped.state = 'walk';
    ped.x = S.player.x + 24;
    ped.y = S.player.y + 10;
    const i = M.ownedPeds.indexOf(ped);
    if (i >= 0) M.ownedPeds.splice(i, 1);
  }
  M.idx += 1;
  M.t = 0;
  if (M.idx >= M.def.stages.length) {
    const def = M.def;
    endMission(S, true);
    if (def.outro && def.outro.length > 0) S.pendingOutro = def;
    return;
  }
  enterStage(S, M, M.def.stages[M.idx]);
  S.events.push({ kind: 'pickupSound' });
}

/** One frame of mission logic: the objective line, timers, stage checks. */
export function updateMission(S, dt) {
  const M = S.mission;
  if (!M) {
    S.objective = null;
    return;
  }
  const stage = M.def.stages[M.idx];
  const P = S.player;
  M.t += dt;

  // The objective the HUD shows, with live counts where they matter.
  let text = stage.text;
  if (stage.kind === 'kill' && M.data.gang) {
    text = `Clear the Glass Serpents — ${M.data.gang.filter((p) => !p.dead).length} left`;
  } else if (stage.kind === 'defend' && M.data.alive) {
    const left = M.data.alive.filter((p) => !p.dead).length;
    text = `Hold the warehouse yard — wave ${M.data.wave}/2, ${left} Serpents standing`;
  } else if (stage.kind === 'race' && M.data.checkpoints) {
    text = `Checkpoint ${Math.min(M.data.cp + 1, M.data.checkpoints.length)}/${M.data.checkpoints.length} — beat the Serpents`;
  } else if (stage.kind === 'escape') {
    text = S.wanted.stars > 0 ? `Lose the police — ${S.wanted.stars}★, stay out of sight` : 'Lose the police';
  }
  let marker = { x: stage.x, y: stage.y };
  if (stage.kind === 'steal' && M.data.car && !P.inCar) {
    marker = { x: M.data.car.x, y: M.data.car.y };
  }
  if (stage.needsCar && M.data.car && P.car !== M.data.car) {
    marker = { x: M.data.car.x, y: M.data.car.y };
  }
  if (stage.kind === 'race' && M.data.checkpoints) {
    marker = M.data.checkpoints[Math.min(M.data.cp, M.data.checkpoints.length - 1)] ?? marker;
  }
  S.objective = {
    title: M.def.title,
    text,
    x: marker.x,
    y: marker.y,
    timer: stage.timer ? Math.max(0, stage.timer - M.t) : null,
  };
  S.checkpoints = stage.kind === 'race'
    ? { list: M.data.checkpoints, current: M.data.cp }
    : null;

  if (stage.timer && M.t > stage.timer) {
    endMission(S, false);
    return;
  }

  const distTo = (x, y) => Math.hypot(P.x - x, P.y - y);
  switch (stage.kind) {
    case 'goto': {
      if (stage.needsCar) {
        if (P.inCar && P.car === M.data.car && distTo(stage.x, stage.y) < stage.r) advanceStage(S);
      } else if (distTo(stage.x, stage.y) < stage.r) {
        if (stage.gives) M.data[stage.gives] = true;
        advanceStage(S);
      }
      break;
    }
    case 'steal': {
      if (M.data.car && P.inCar && P.car === M.data.car) {
        if (M.def.id === 'borrowed-wheels' && S.wanted.stars < 2) setWanted(S, 2);
        advanceStage(S);
      } else if (M.data.car && M.data.car.dead) {
        endMission(S, false);
      }
      break;
    }
    case 'pickup': {
      const ped = M.data.ped;
      if (ped && P.inCar && distTo(ped.x, ped.y) < stage.r) {
        ped.inCar = P.car;
        ped.state = 'ride';
        // Tito boards with the law already locked onto the car at 3 stars.
        if (M.def.id === 'family-business') setWanted(S, 3, 3);
        advanceStage(S);
      }
      break;
    }
    case 'escape': {
      if (S.wanted.stars <= 0) advanceStage(S);
      break;
    }
    case 'kill': {
      if (M.data.gang && M.data.gang.every((p) => p.dead)) advanceStage(S);
      break;
    }
    case 'defend': {
      if (distTo(stage.x, stage.y) > stage.r + 130) {
        M.data.awayT = (M.data.awayT ?? 0) + dt;
        if (M.data.awayT > 6) {
          endMission(S, false);
          return;
        }
      } else {
        M.data.awayT = 0;
      }
      if (M.data.alive && M.data.alive.every((p) => p.dead)) {
        if (M.data.wave >= 2) advanceStage(S);
        else if (M.spawnWave) M.spawnWave();
      }
      break;
    }
    case 'race': {
      updateRace(S, M, dt);
      break;
    }
    default:
      break;
  }
}

/** The Avenida Kings race: rivals run the same checkpoints Juno does. */
function updateRace(S, M, dt) {
  const cps = M.data.checkpoints;
  const P = S.player;
  for (const car of M.data.rivals) {
    if (car.dead) continue;
    const target = cps[Math.min(car.cp, cps.length - 1)];
    if (!target) continue;
    if (Math.hypot(car.x - target.x, car.y - target.y) < 95) car.cp += 1;
    const ctrl = steerControls(car, target.x, target.y, car.top * car.skill);
    stepCar(S, car, dt, ctrl);
  }
  const mine = cps[M.data.cp];
  if (mine && P.inCar && Math.hypot(P.x - mine.x, P.y - mine.y) < 95) {
    M.data.cp += 1;
    S.events.push({ kind: 'pickupSound' });
    S.events.push({
      kind: 'toast',
      text: M.data.cp >= cps.length ? 'Finish!' : `Checkpoint ${M.data.cp}/${cps.length}`,
    });
  }
  if (M.data.cp >= cps.length) {
    const place = 1 + M.data.rivals.filter((c) => c.cp >= cps.length).length;
    if (place === 1) {
      S.player.cash += 250;
      S.events.push({ kind: 'toast', text: 'You win Avenida Kings! +$250 bonus' });
    } else {
      const suffix = place === 2 ? 'nd' : 'rd';
      S.events.push({ kind: 'toast', text: `You placed ${place}${suffix} — Vera pays the job, not the crown` });
    }
    advanceStage(S);
  }
}
