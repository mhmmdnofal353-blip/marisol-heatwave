// Missions: Vera Solano's six-job story for Juno, plus the repeatable side
// work the city offers once you are known. A mission is a list of stages;
// each stage knows its marker, its objective line, how it sets the scene up
// and when it is done. The HUD reads S.objective, written here every frame.

import { createCar, steerControls, stepCar } from './vehicles.js';
import { createPed } from './pedestrians.js';
import { setWanted } from './police.js';
import { range, pick } from './random.js';

const VERA = 'Vera Solano';
const JUNO = 'Juno';
const TITO = 'Tito Reyes';

/** A stage that is done when the player reaches a point. */
function gotoStage(text, x, y, r = 48, extra = {}) {
  return { kind: 'goto', text, x, y, r, ...extra };
}

/** The six story jobs, in order, with their places in Marisol Bay filled in. */
export function storyMissions(S) {
  const P = S.city.places;
  const docks = S.city.blocks.find((b) => b.col === 5 && b.row === 4);
  const marinaLot = { x: P.warehouse.x - 190, y: P.warehouse.y + 40 };
  const beachEnd = { x: 4460, y: 420 };
  return [
    {
      id: 'first-run',
      title: 'First Run',
      reward: { cash: 300, respect: 10 },
      intro: [
        { who: VERA, text: "Juno Marchetti. Five years gone and you walk into my warehouse like rent's due." },
        { who: JUNO, text: 'Rent is due, Vera. I need work. The kind that pays cash and asks nothing.' },
        { who: VERA, text: "Then run this package to Café Palma on the Strip. Don't open it. Don't be late." },
      ],
      stages: [
        gotoStage('Pick up the package at the Sunport docks', docks.x + docks.w, docks.y + docks.h / 2, 52, { gives: 'package' }),
        gotoStage('Deliver the package to Café Palma', P.cafe.x, P.cafe.y, 52, { needs: 'package', timer: 165 }),
      ],
      outro: [{ who: VERA, text: 'Clean and quick. Just like the old days. Come back tomorrow — I have wheels that need borrowing.' }],
    },
    {
      id: 'borrowed-wheels',
      title: 'Borrowed Wheels',
      reward: { cash: 450, respect: 14 },
      intro: [
        { who: VERA, text: 'A Vireo Coupe sits on the Strip, keys in, owner at lunch. It belongs in my yard by sundown.' },
        { who: JUNO, text: "Stealing cars in daylight. You've missed me, Vera." },
        { who: VERA, text: "Bring it home whole. The law will notice the taking — lose them before my gate, not after." },
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
        gotoStage("Deliver the coupe to Vera's yard", P.warehouse.x, P.warehouse.y, 58, { needsCar: true }),
      ],
      outro: [{ who: VERA, text: 'Not a scratch worth naming. The Strip job next is family, Juno. My nephew Tito needs a ride.' }],
    },
    {
      id: 'family-business',
      title: 'Family Business',
      reward: { cash: 600, respect: 18 },
      intro: [
        { who: VERA, text: 'Tito got loud with the Glass Serpents at the docks. Pick him up, bring him to your loft.' },
        { who: JUNO, text: 'And the police attention that comes free with Tito?' },
        { who: VERA, text: 'Shake it off after he is safe. Family first, heat second.' },
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
        gotoStage("Drive Tito to Juno's Loft", P.safehouse.x, P.safehouse.y, 58, { passenger: true }),
        { kind: 'escape', text: 'Lose the police', x: P.safehouse.x, y: P.safehouse.y, r: 0 },
      ],
      outro: [{ who: TITO, text: 'You drive like the devil owes you money. Aunt Vera, she was right about you.' }],
    },
    {
      id: 'serpent-season',
      title: 'Serpent Season',
      reward: { cash: 750, respect: 22 },
      intro: [
        { who: VERA, text: "Ivo Brandt's Serpents are squatting the marina lot, taxing my drivers. Clear them out." },
        { who: JUNO, text: 'On foot? Against six?' },
        { who: VERA, text: 'You were always better loud than quiet. Mouse to aim, click to shoot. Watch the crossfire.' },
      ],
      stages: [
        gotoStage('Go to the marina lot', marinaLot.x, marinaLot.y, 60),
        {
          kind: 'kill', text: 'Clear the Glass Serpents from the lot', x: marinaLot.x, y: marinaLot.y, r: 0,
          setup(S2, M) {
            M.data.gang = [];
            for (let i = 0; i < 6; i++) {
              const ped = createPed(marinaLot.x + range(S2.rng, -130, 130), marinaLot.y + range(S2.rng, -90, 90), S2.rng, 'ganger');
              ped.state = 'fight';
              S2.peds.push(ped);
              M.data.gang.push(ped);
              M.ownPed(ped);
            }
          },
        },
        gotoStage("Report back to Vera's warehouse", P.warehouse.x, P.warehouse.y, 56),
      ],
      outro: [{ who: VERA, text: 'The lot is ours again. Rest while you can — the Avenida Kings race pays nine hundred to the winner.' }],
    },
    {
      id: 'avenida-kings',
      title: 'Avenida Kings',
      reward: { cash: 900, respect: 26 },
      intro: [
        { who: VERA, text: 'Eight checkpoints, two Serpent drivers, one avenue crown. Beat them and Marisol knows your name.' },
        { who: JUNO, text: 'And if the law joins the race?' },
        { who: VERA, text: 'Then win faster.' },
      ],
      stages: [
        {
          kind: 'race', text: 'Win the Avenida Kings race', x: 2000, y: 3250, r: 0,
          setup(S2, M) {
            const cps = [
              [2000, 3250], [2000, 2460], [2560, 1920], [3120, 1380], [3680, 840], [3120, 840], [2560, 1380], [4240, 1920], [4240, 3000],
            ];
            M.data.checkpoints = cps.map(([x, y]) => ({ x, y }));
            M.data.cp = 0;
            M.data.rivals = [];
            for (const [i, type] of ['sports', 'coupe'].entries()) {
              const car = createCar(type, 1952 - i * 6, 3300 + i * 44, -Math.PI / 2, 'racer', S2.rng);
              car.cp = 0;
              car.skill = 0.86 - i * 0.05;
              S2.cars.push(car);
              M.data.rivals.push(car);
              M.ownCar(car);
            }
            S2.events.push({ kind: 'toast', text: 'Get to the start of Avenida del Sol — race begins at the first checkpoint!' });
          },
        },
      ],
      outro: [{ who: VERA, text: 'One job left, and it is the big one. An armored van, a full escort of law, and my whole future riding on it.' }],
    },
    {
      id: 'heatwave',
      title: 'Heatwave',
      reward: { cash: 1500, respect: 40 },
      intro: [
        { who: VERA, text: "The Brinks van parks at the chop shop tonight. Take it, bring it here, hold my yard, then run for the beach." },
        { who: JUNO, text: 'Four stars of law, the Serpents, and a van full of money. Just like old times.' },
        { who: VERA, text: "Survive it, Juno, and Marisol Bay is yours. Fail, and we were never friends." },
      ],
      stages: [
        {
          kind: 'steal', text: 'Steal the armored van at the chop shop', x: P.chopshop.x, y: P.chopshop.y, r: 70,
          setup(S2, M) {
            const van = createCar('armored', P.chopshop.x + 40, P.chopshop.y + 66, 0.4, 'parked', S2.rng);
            van.mission = 'steal';
            S2.cars.push(van);
            M.data.car = van;
            M.ownCar(van);
            for (let i = 0; i < 4; i++) {
              const ped = createPed(P.chopshop.x + range(S2.rng, -90, 90), P.chopshop.y + range(S2.rng, 30, 110), S2.rng, 'ganger');
              ped.state = 'fight';
              S2.peds.push(ped);
              M.ownPed(ped);
            }
          },
        },
        gotoStage("Deliver the van to Vera's yard — the law is locked on", P.warehouse.x, P.warehouse.y, 62, { needsCar: true, lockWanted: 4 }),
        {
          kind: 'defend', text: 'Hold the warehouse yard', x: P.warehouse.x, y: P.warehouse.y, r: 240,
          setup(S2, M) {
            M.data.wave = 0;
            M.data.alive = [];
            M.spawnWave = () => {
              M.data.wave += 1;
              const n = 3 + M.data.wave;
              for (let i = 0; i < n; i++) {
                const a = range(S2.rng, 0, Math.PI * 2);
                const ped = createPed(P.warehouse.x + Math.cos(a) * 330, P.warehouse.y + Math.sin(a) * 330, S2.rng, 'ganger');
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
        { who: VERA, text: 'The money is buried, the Serpents are scattered, and the law is chasing ghosts.' },
        { who: JUNO, text: 'Then Marisol Bay is mine, Vera. Ours. Same thing, on a good day.' },
      ],
    },
  ];
}

/** One repeatable side job of a kind: 'delivery', 'fare' or 'theft'. */
export function sideJob(S, kind) {
  const rng = S.rng;
  const P = S.city.places;
  const spots = [P.cafe, P.hospital, P.safehouse, P.warehouse, ...S.city.blocks.filter((b) => rng() < 0.3).map((b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }))];
  const a = pick(rng, spots);
  const b = pick(rng, spots);
  if (kind === 'delivery') {
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    return {
      id: 'side-delivery', title: 'Courier Run', side: true,
      reward: { cash: Math.round(110 + dist / 14), respect: 4 },
      intro: [{ who: 'Dispatcher', text: 'Package on the clock. Wheels up, no questions.' }],
      stages: [
        gotoStage('Pick up the package', a.x, a.y, 52, { gives: 'package' }),
        gotoStage('Deliver the package', b.x, b.y, 52, { needs: 'package', timer: Math.round(50 + dist / 26) }),
      ],
      outro: [],
    };
  }
  if (kind === 'fare') {
    return {
      id: 'side-fare', title: 'The Long Fare', side: true,
      reward: { cash: Math.round(90 + Math.hypot(a.x - b.x, a.y - b.y) / 16), respect: 3 },
      intro: [{ who: 'Dispatcher', text: 'A fare is waiting. Clean driving pays a tip.' }],
      stages: [
        {
          kind: 'pickup', text: 'Pick up your fare', x: a.x, y: a.y, r: 62,
          setup(S2, M) {
            const ped = createPed(a.x, a.y, S2.rng, 'friend');
            ped.state = 'wait';
            ped.name = 'Fare';
            S2.peds.push(ped);
            M.data.ped = ped;
            M.ownPed(ped);
          },
        },
        gotoStage('Take your fare to the destination', b.x, b.y, 56, { passenger: true }),
      ],
      outro: [],
    };
  }
  // theft
  const spot = pick(rng, S.city.parkedSpots.length ? S.city.parkedSpots : [{ x: a.x, y: a.y, angle: 0 }]);
  return {
    id: 'side-theft', title: 'Chop List', side: true,
    reward: { cash: 300, respect: 6 },
    intro: [{ who: 'Dispatcher', text: 'One car on the list, marked on your map. The shop pays cash, no names.' }],
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
      gotoStage('Deliver it to the Chop Shop', P.chopshop.x, P.chopshop.y, 58, { needsCar: true }),
    ],
    outro: [],
  };
}

/** Where each kind of work is offered: place key -> side job kind. */
export const JOB_GIVERS = [
  { place: 'garage0', kind: 'delivery', label: 'Courier work — SunSpray downtown' },
  { place: 'cafe', kind: 'fare', label: 'Fares — Café Palma' },
  { place: 'chopshop', kind: 'theft', label: 'Chop list — Docks' },
];

/** Begin a mission: build its runtime, run the first stage's setup. */
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
  const stage = def.stages[0];
  if (stage.setup) stage.setup(S, M);
  if (stage.lockWanted) setWanted(S, stage.lockWanted, stage.lockWanted);
  S.events.push({ kind: 'toast', text: `Mission: ${def.title}` });
  return M;
}

/** End a mission either way: free its actors, release any wanted lock. */
export function endMission(S, passed) {
  const M = S.mission;
  if (!M) return;
  for (const car of M.ownedCars) {
    if (S.player.car === car) continue;
    const i = S.cars.indexOf(car);
    if (i >= 0) S.cars.splice(i, 1);
  }
  for (const ped of M.ownedPeds) {
    if (ped.inCar) continue;
    const i = S.peds.indexOf(ped);
    if (i >= 0) S.peds.splice(i, 1);
  }
  if (S.wanted.locked > 0) S.wanted.locked = 0;
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

/** The stage the player is on, or null between missions. */
export function currentStage(S) {
  return S.mission ? S.mission.def.stages[S.mission.idx] : null;
}

function advanceStage(S) {
  const M = S.mission;
  const stage = M.def.stages[M.idx];
  if (stage.lockWanted) S.wanted.locked = 0;
  if (stage.passenger && M.data.ped) {
    // The passenger gets out here and walks away into the city.
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
    if (def.outro && def.outro.length) S.pendingOutro = def;
    return;
  }
  const next = M.def.stages[M.idx];
  if (next.setup) next.setup(S, M);
  if (next.lockWanted) setWanted(S, next.lockWanted, next.lockWanted);
  S.events.push({ kind: 'pickupSound' });
}

/** One frame of mission logic: markers, timers, stage checks. */
export function updateMission(S, dt) {
  const M = S.mission;
  if (!M) {
    S.objective = null;
    return;
  }
  const stage = M.def.stages[M.idx];
  const P = S.player;
  M.t += dt;

  // The objective line the HUD draws, with live counts where they matter.
  let text = stage.text;
  if (stage.kind === 'kill' && M.data.gang) {
    const left = M.data.gang.filter((p) => !p.dead).length;
    text = `Clear the Glass Serpents — ${left} left`;
  }
  if (stage.kind === 'defend' && M.data.alive) {
    const left = M.data.alive.filter((p) => !p.dead).length;
    text = `Hold the warehouse yard — wave ${M.data.wave}/2, ${left} Serpents standing`;
  }
  if (stage.kind === 'race' && M.data.checkpoints) {
    text = `Checkpoint ${Math.min(M.data.cp + 1, M.data.checkpoints.length)}/${M.data.checkpoints.length} — beat the Serpents`;
  }
  if (stage.kind === 'escape') {
    text = S.wanted.stars > 0 ? `Lose the police — ${S.wanted.stars}★, stay out of sight` : 'Lose the police';
  }
  let marker = { x: stage.x, y: stage.y };
  if (stage.kind === 'steal' && M.data.car && !P.inCar) marker = { x: M.data.car.x, y: M.data.car.y };
  if (stage.needsCar && M.data.car && P.car !== M.data.car) marker = { x: M.data.car.x, y: M.data.car.y };
  if (stage.kind === 'race' && M.data.checkpoints) marker = M.data.checkpoints[Math.min(M.data.cp, M.data.checkpoints.length - 1)] ?? marker;
  S.objective = { title: M.def.title, text, x: marker.x, y: marker.y, timer: stage.timer ? Math.max(0, stage.timer - M.t) : null };
  if (stage.kind === 'race') S.checkpoints = { list: M.data.checkpoints, current: M.data.cp };
  else S.checkpoints = null;

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
      } else if (M.data.car && M.data.car.dead) endMission(S, false);
      break;
    }
    case 'pickup': {
      const ped = M.data.ped;
      if (ped && P.inCar && distTo(ped.x, ped.y) < stage.r) {
        ped.inCar = P.car;
        ped.state = 'ride';
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
      } else M.data.awayT = 0;
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
  }
}

/** The Avenida Kings race: rivals chase checkpoints; the player must too. */
function updateRace(S, M, dt) {
  const cps = M.data.checkpoints;
  const P = S.player;
  // Rivals.
  for (const car of M.data.rivals) {
    if (car.dead) continue;
    const cp = cps[Math.min(car.cp, cps.length - 1)];
    if (cp && Math.hypot(car.x - cp.x, car.y - cp.y) < 95) car.cp += 1;
    const target = cps[Math.min(car.cp, cps.length - 1)];
    if (target) {
      const ctrl = steerControls(car, target.x, target.y, car.top * car.skill);
      stepCar(S, car, dt, ctrl);
    }
  }
  // The player.
  const cp = cps[M.data.cp];
  if (cp && P.inCar && Math.hypot(P.x - cp.x, P.y - cp.y) < 95) {
    M.data.cp += 1;
    S.events.push({ kind: 'pickupSound' });
    S.events.push({ kind: 'toast', text: M.data.cp >= cps.length ? 'Finish!' : `Checkpoint ${M.data.cp}/${cps.length}` });
  }
  if (M.data.cp >= cps.length) {
    const place = 1 + M.data.rivals.filter((c) => c.cp >= cps.length).length;
    if (place === 1) S.player.cash += 250;
    S.events.push({ kind: 'toast', text: place === 1 ? 'You win Avenida Kings! +$250 bonus' : `You placed ${place}${place === 2 ? 'nd' : 'rd'} — Vera pays the job, not the crown` });
    advanceStage(S);
  }
}
