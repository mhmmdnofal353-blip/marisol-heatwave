// Marisol Heatwave — the conductor. Owns the game state, the main loop, the
// event queue every other module speaks through, the interactions with the
// city's places, the dialogue flow, the camera, the menus' actions, and the
// deterministic ?shot= scenes the screenshots are taken from.

import { WORLD } from './config.js';
import { mulberry32 } from './random.js';
import { bindInput, input, tapped } from './input.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayer, nearestCar, hurtPlayer } from './player.js';
import { createCar, steerControls, stepCar, collideCars, updateTraffic, maintainTraffic, seedParkedCars, damageCar } from './vehicles.js';
import { createPed, updatePeds, maintainPeds, hurtPed } from './pedestrians.js';
import { createWanted, updatePolice, reportCrime, setWanted, nearestPoliceDist } from './police.js';
import { storyMissions, sideJob, startMission, endMission, updateMission, JOB_GIVERS } from './missions.js';
import { drawWorld, updateFx, burst } from './render.js';
import { drawHUD, drawMenus, menuItems, menuItemBox } from './hud.js';
import { loadSave, storeSave, hasSave, snapshotOf } from './save.js';
import { stageShot, shotDrive } from './shots.js';
import * as audio from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') ?? 1) || 1;

const WELCOME = [
  { who: 'Vera Solano', text: 'Juno? Tell me that is you breathing on my phone.' },
  { who: 'Juno', text: 'It is me, Vera. I am back in Marisol Bay, and I am flat broke.' },
  { who: 'Vera Solano', text: 'Then come to my freight warehouse in the Old Marina — gold marker, your map knows it. I have a run that pays.' },
];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (S) {
    S.viewW = canvas.width;
    S.viewH = canvas.height;
  }
}
window.addEventListener('resize', resize);

/** Build a whole game state, optionally from a saved game. */
function createState(saved) {
  const rng = mulberry32(SHOT ? SEED * 7919 + 13 : (Date.now() % 2000000000) + 7);
  const city = buildCity(mulberry32(90210));
  const home = city.places.warehouse;
  const S2 = {
    time: 0,
    rng,
    city,
    cars: [],
    peds: [],
    particles: [],
    tracers: [],
    skids: [],
    events: [],
    player: createPlayer(home.x + 46, home.y + 74),
    wanted: createWanted(),
    mission: null,
    storyIdx: 0,
    sideDone: 0,
    story: null,
    dialogue: null,
    pendingOutro: null,
    toasts: [],
    banner: null,
    prompt: null,
    marker: null,
    objective: null,
    checkpoints: null,
    camera: { x: home.x, y: home.y, zoom: 1 },
    viewW: canvas.width,
    viewH: canvas.height,
    mouseWorld: { x: 0, y: 0 },
    danger: { x: 0, y: 0, t: 0 },
    screen: 'title',
    hasSave: hasSave(),
    muted: audio.isMuted(),
    hurtFlash: 0,
    shake: 0,
    skidT: 0,
    howtoReturn: 'title',
    shot: SHOT,
  };
  S2.story = storyMissions(S2);
  seedParkedCars(S2);
  maintainTraffic(S2);
  maintainPeds(S2);
  if (saved) {
    S2.player.cash = saved.cash;
    S2.player.respect = saved.respect;
    S2.storyIdx = Math.min(6, saved.storyIdx ?? 0);
    S2.sideDone = saved.sideDone ?? 0;
    if (typeof saved.x === 'number' && typeof saved.y === 'number') {
      S2.player.x = Math.max(30, Math.min(WORLD.width - 30, saved.x));
      S2.player.y = Math.max(30, Math.min(WORLD.height - 30, saved.y));
    }
    S2.camera.x = S2.player.x;
    S2.camera.y = S2.player.y;
  }
  return S2;
}

let S = createState(null);
resize();
bindInput(canvas);
window.__S = () => S; // a handle for headless testing and curious players

// --- dialogue ----------------------------------------------------------------

/** Show dialogue lines; `onDone` runs when the last one is dismissed. */
function showDialogue(lines, onDone = null) {
  S.dialogue = { lines, i: 0, onDone };
}

function advanceDialogue() {
  const d = S.dialogue;
  if (!d) return;
  d.i += 1;
  if (d.i >= d.lines.length) {
    S.dialogue = null;
    if (d.onDone) d.onDone();
  }
}

// --- places and work -----------------------------------------------------------

function giverPlace(giver) {
  if (giver.place === 'garage0') return S.city.places.garages[0];
  return S.city.places[giver.place];
}

/** Decide the standing invitation marker and any interaction prompt. */
function computeInteractions() {
  S.marker = null;
  S.prompt = null;
  S.nearPlace = null;
  S.nearGiver = null;
  if (S.screen !== 'play' || S.dialogue) return;
  const P = S.player;
  const near = (x, y, d) => Math.hypot(P.x - x, P.y - y) < d;

  if (!S.mission) {
    if (S.storyIdx < 6) {
      const w = S.city.places.warehouse;
      S.marker = { x: w.x, y: w.y, color: '#ffd166', icon: '!' };
      if (near(w.x, w.y, 56)) S.prompt = `E — Talk to Vera: “${S.story[S.storyIdx].title}”`;
    } else {
      // Side work: point at the nearest giver, offer it up close.
      let best = null;
      let bd = Infinity;
      for (const giver of JOB_GIVERS) {
        const place = giverPlace(giver);
        const d = Math.hypot(P.x - place.x, P.y - place.y);
        if (d < bd) {
          bd = d;
          best = { giver, place };
        }
      }
      if (best && bd < 1100) {
        S.marker = { x: best.place.x, y: best.place.y, color: '#4dd8ff', icon: '$' };
        if (bd < 56) S.prompt = `E — ${best.giver.label}`;
        S.nearGiver = best.giver;
      }
    }
  }
  if (S.prompt) return;
  // The respray garages: drive in wanted, drive out clean and mended.
  if (P.inCar && P.car) {
    for (const g of S.city.places.garages ?? []) {
      if (near(g.x, g.y, 56)) {
        const cost = S.wanted.stars > 0 ? 120 + 90 * S.wanted.stars : 80;
        S.prompt = `E — Respray & repair ($${cost})${S.wanted.stars > 0 ? ' — clears wanted' : ''}`;
        S.nearPlace = { kind: 'garage', place: g, cost };
        return;
      }
    }
  }
  const safe = S.city.places.safehouse;
  if (near(safe.x, safe.y, 48)) {
    S.prompt = 'E — Rest at the loft (heal & save)';
    S.nearPlace = { kind: 'safehouse', place: safe };
    return;
  }
  const hosp = S.city.places.hospital;
  if (near(hosp.x, hosp.y, 48) && P.hp < P.maxHp) {
    S.prompt = 'E — Get patched up ($60)';
    S.nearPlace = { kind: 'hospital', place: hosp };
    return;
  }
  if (!P.inCar) {
    const car = nearestCar(S);
    if (car) S.prompt = `F — ${car.role === 'parked' ? 'Take' : 'Enter'} the ${car.label}`;
  }
}

/** Act on the E key against whatever computeInteractions offered. */
function useInteraction() {
  const P = S.player;
  if (!S.mission && S.marker && Math.hypot(P.x - S.marker.x, P.y - S.marker.y) < 56) {
    if (S.storyIdx < 6) {
      const def = S.story[S.storyIdx];
      showDialogue(def.intro, () => startMission(S, def));
    } else if (S.nearGiver) {
      const def = sideJob(S, S.nearGiver.kind);
      showDialogue(def.intro, () => startMission(S, def));
    }
    return;
  }
  const np = S.nearPlace;
  if (!np) return;
  if (np.kind === 'garage' && P.inCar && P.car) {
    if (P.cash < np.cost) {
      pushToast(`Respray costs $${np.cost} — you are short`);
      return;
    }
    P.cash -= np.cost;
    setWanted(S, 0);
    P.car.hp = P.car.maxHp;
    P.car.dead = false;
    P.car.color = ['#3d5a80', '#57a773', '#8d99ae', '#e07a5f'][Math.floor(S.rng() * 4)];
    audio.sfxCash();
    pushToast('Fresh paint, clean record. SunSpray thanks you.');
  } else if (np.kind === 'safehouse') {
    P.hp = P.maxHp;
    P.armor = Math.max(P.armor, 50);
    storeSave(snapshotOf(S));
    S.hasSave = true;
    audio.sfxPickup();
    pushToast('Rested. Game saved at the loft.');
  } else if (np.kind === 'hospital') {
    if (P.cash < 60) {
      pushToast('The hospital wants $60 up front');
      return;
    }
    P.cash -= 60;
    P.hp = P.maxHp;
    audio.sfxCash();
    pushToast('Patched up. Try not to bleed on the seats.');
  }
  S.nearPlace = null;
}

function pushToast(text) {
  S.toasts.push({ text, ttl: 3.6 });
  if (S.toasts.length > 3) S.toasts.shift();
}

function showBanner(title, sub) {
  S.banner = { title, sub, t: 0, dur: 3.1 };
}

// --- arrest and death -----------------------------------------------------------

function doBusted() {
  if (S.mission) endMission(S, false);
  const fine = Math.floor(S.player.cash * 0.1);
  S.player.cash -= fine;
  S.bustedFine = fine;
  audio.engine(false);
  audio.siren(0);
  audio.sfxSting();
  S.screen = 'busted';
}

function doWasted() {
  if (S.mission) endMission(S, false);
  const fine = Math.floor(S.player.cash * 0.1);
  S.player.cash -= fine;
  S.bustedFine = fine;
  audio.engine(false);
  audio.siren(0);
  audio.sfxSting();
  S.screen = 'wasted';
}

function respawn() {
  const P = S.player;
  if (P.inCar && P.car) {
    if (S.screen === 'busted') {
      const i = S.cars.indexOf(P.car);
      if (i >= 0) S.cars.splice(i, 1); // impounded
    } else {
      P.car.role = 'parked';
    }
    P.inCar = false;
    P.car = null;
  }
  const spot = S.screen === 'busted' ? S.city.places.police : S.city.places.hospital;
  P.x = spot.x + 30;
  P.y = spot.y + 30;
  P.hp = P.maxHp;
  P.armor = 0;
  setWanted(S, 0);
  S.camera.x = P.x;
  S.camera.y = P.y;
  S.screen = 'play';
}

// --- events -------------------------------------------------------------------

/** Drain the event queue: crimes to the law, sounds to the speakers, sparks to the air. */
function processEvents() {
  const events = S.events.splice(0, S.events.length);
  const P = S.player;
  const distToPlayer = (x, y) => Math.hypot(x - P.x, y - P.y);
  for (const e of events) {
    switch (e.kind) {
      case 'crime':
        reportCrime(S, e.crime, e.x, e.y);
        break;
      case 'crash':
        if (distToPlayer(e.x, e.y) < 780) audio.sfxCrash(e.strength);
        burst(S, e.x, e.y, 'sparks', 6);
        if (e.car && e.car.role === 'player') S.shake = Math.max(S.shake, 3.5);
        break;
      case 'sparks':
        burst(S, e.x, e.y, 'sparks', Math.min(8, Math.ceil(e.n)));
        break;
      case 'explosion': {
        if (distToPlayer(e.x, e.y) < 950) audio.sfxExplosion();
        burst(S, e.x, e.y, 'flame', 18);
        burst(S, e.x, e.y, 'smoke', 12);
        S.danger = { x: e.x, y: e.y, t: 3 };
        S.shake = Math.max(S.shake, 9);
        const d = distToPlayer(e.x, e.y);
        if (d < 120 && !P.inCar) hurtPlayerFromBlast(36 * (1 - d / 140));
        for (const ped of S.peds) {
          if (!ped.dead && Math.hypot(ped.x - e.x, ped.y - e.y) < 85) hurtPed(S, ped, 30);
        }
        for (const car of S.cars) {
          if (!car.dead && car !== e.car && Math.hypot(car.x - e.x, car.y - e.y) < 82) damageCar(S, car, 30, car.x, car.y);
        }
        if (e.car && e.car.role === 'player') reportCrime(S, 'explosion', e.x, e.y);
        break;
      }
      case 'tracer':
        S.tracers.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, color: e.color, t: 0.08 });
        break;
      case 'shotSound':
        if (e.own || distToPlayer(e.x, e.y) < 860) audio.sfxShot();
        break;
      case 'playerHit':
        hurtPlayerExternal(e.dmg);
        break;
      case 'carHit':
        damageCar(S, e.car, e.dmg, e.x, e.y);
        break;
      case 'pedDown':
        if (e.byPlayer && e.fatal) {
          if (e.ped.role === 'officer') reportCrime(S, 'hitPolice', e.ped.x, e.ped.y);
          else if (e.ped.role === 'walker') reportCrime(S, 'killPed', e.ped.x, e.ped.y);
        } else if (e.byPlayer && !e.fatal) {
          reportCrime(S, 'hitPed', e.ped.x, e.ped.y);
        }
        if (distToPlayer(e.ped.x, e.ped.y) < 500) audio.sfxHit();
        break;
      case 'eject': {
        const driver = createPed(e.x, e.y, S.rng);
        driver.state = 'flee';
        driver.fleeT = 2.6;
        S.peds.push(driver);
        S.danger = { x: e.x, y: e.y, t: 2 };
        break;
      }
      case 'door':
        if (distToPlayer(e.x, e.y) < 620) audio.sfxDoor();
        break;
      case 'horn':
        if (distToPlayer(e.x, e.y) < 520) audio.sfxHorn();
        break;
      case 'skid':
        if (S.skidT <= 0) {
          audio.sfxSkid(e.amount);
          S.skidT = 0.1;
        }
        break;
      case 'thud':
        if (distToPlayer(e.x, e.y) < 520) audio.sfxHit();
        break;
      case 'blood':
        burst(S, e.x, e.y, 'blood', e.n ?? 4);
        break;
      case 'pickupSound':
        audio.sfxPickup();
        break;
      case 'missionPass': {
        audio.sfxMissionPass();
        showBanner('MISSION PASSED', `${e.def.title} · +$${e.def.reward.cash}`);
        if (e.def.side) S.sideDone += 1;
        else S.storyIdx = Math.min(6, S.storyIdx + 1);
        storeSave(snapshotOf(S));
        S.hasSave = true;
        if (S.pendingOutro) {
          const def = S.pendingOutro;
          S.pendingOutro = null;
          showDialogue(def.outro, () => {
            if (def.id === 'heatwave') {
              storeSave(snapshotOf(S));
              S.screen = 'complete';
            }
          });
        }
        break;
      }
      case 'missionFail':
        audio.sfxMissionFail();
        showBanner('MISSION FAILED', e.def.title);
        break;
      case 'toast':
        pushToast(e.text);
        break;
      case 'busted':
        if (!SHOT && S.screen === 'play') doBusted();
        break;
      case 'wasted':
        if (!SHOT && S.screen === 'play') doWasted();
        break;
      default:
        break;
    }
  }
}

// Damage entry points that also feed the screen flash (kept here so
// player.js and pedestrians.js stay free of presentation).
function hurtPlayerExternal(dmg) {
  S.hurtFlash = 1;
  hurtPlayer(S, dmg);
}
function hurtPlayerFromBlast(dmg) {
  if (dmg > 1) hurtPlayerExternal(dmg);
}

// --- the world step ---------------------------------------------------------------

/** Advance the whole simulation one step. Mode: 'play', 'shot' or 'ambient'. */
function stepWorld(dt, mode) {
  S.time += dt;
  S.skidT -= dt;
  S.danger.t = Math.max(0, S.danger.t - dt);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt * 2.1);
  S.shake = Math.max(0, S.shake - dt * 26);
  for (const toast of S.toasts) toast.ttl -= dt;
  S.toasts = S.toasts.filter((t) => t.ttl > 0);
  if (S.banner) {
    S.banner.t += dt;
    if (S.banner.t > S.banner.dur) S.banner = null;
  }

  if (mode === 'play' || mode === 'shot') {
    if (S.dialogue && mode === 'play') {
      // The world breathes while people talk; Juno listens.
    } else if (mode === 'shot') {
      const drive = shotDrive(S, dt);
      if (drive && S.player.car) stepCar(S, S.player.car, dt, steerControls(S.player.car, drive.tx, drive.ty, drive.want));
      S.player.x = S.player.car ? S.player.car.x : S.player.x;
      S.player.y = S.player.car ? S.player.car.y : S.player.y;
    } else {
      updatePlayer(S, dt);
    }
    collideCars(S, dt);
    updateTraffic(S, dt);
    updatePolice(S, dt);
    updatePeds(S, dt);
    if (mode === 'play') {
      updateMission(S, dt);
      computeInteractions();
    }
    maintainTraffic(S);
    maintainPeds(S);
  } else {
    // Ambient: the title screen's living city.
    updateTraffic(S, dt);
    updatePeds(S, dt);
    maintainTraffic(S);
    maintainPeds(S);
  }
  updateFx(S, dt);
  processEvents();
  updateCamera(dt, mode);
}

function updateCamera(dt, mode) {
  const cam = S.camera;
  if (mode === 'ambient' || S.screen === 'title' || S.screen === 'howto') {
    cam.x = 2350 + Math.sin(S.time * 0.045) * 430;
    cam.y = 2620 + Math.cos(S.time * 0.032) * 300;
    cam.zoom += (0.92 - cam.zoom) * Math.min(1, dt * 2);
    return;
  }
  const P = S.player;
  let tx = P.x;
  let ty = P.y;
  if (P.inCar && P.car) {
    tx += Math.cos(P.car.angle) * P.car.speed * 0.34;
    ty += Math.sin(P.car.angle) * P.car.speed * 0.34;
  }
  const k = Math.min(1, dt * 5.2);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const targetZoom = P.inCar ? 0.86 : 1.0;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 1.8);
  const hw = S.viewW / 2 / cam.zoom;
  const hh = S.viewH / 2 / cam.zoom;
  cam.x = Math.max(hw - 260, Math.min(WORLD.width - hw + 260, cam.x));
  cam.y = Math.max(hh - 260, Math.min(WORLD.height - hh + 260, cam.y));
  if (S.shake > 0) {
    cam.x += (S.rng() - 0.5) * S.shake;
    cam.y += (S.rng() - 0.5) * S.shake;
  }
  S.mouseWorld = {
    x: cam.x + (input.mouse.x - S.viewW / 2) / cam.zoom,
    y: cam.y + (input.mouse.y - S.viewH / 2) / cam.zoom,
  };
}

// --- menus -------------------------------------------------------------------

function menuAction(id) {
  audio.initAudio();
  switch (id) {
    case 'new':
      S = createState(null);
      S.screen = 'play';
      showDialogue(WELCOME);
      audio.startMusic();
      break;
    case 'continue': {
      const saved = loadSave();
      S = createState(saved);
      S.screen = 'play';
      audio.startMusic();
      break;
    }
    case 'howto':
      S.howtoReturn = S.screen;
      S.screen = 'howto';
      break;
    case 'back':
      S.screen = S.howtoReturn;
      break;
    case 'mute':
      S.muted = audio.toggleMute();
      break;
    case 'resume':
      S.screen = 'play';
      break;
    case 'save':
      storeSave(snapshotOf(S));
      S.hasSave = true;
      pushToast('Game saved.');
      S.screen = 'play';
      break;
    case 'quit':
      S = createState(null);
      S.screen = 'title';
      break;
    case 'respawn':
      respawn();
      break;
    case 'freeroam':
      S.screen = 'play';
      break;
    default:
      break;
  }
}

function handleMenuClicks() {
  if (!input.mouse.clicked || S.screen === 'play') return;
  const items = menuItems(S);
  items.forEach((item, i) => {
    const box = menuItemBox(S.viewW, S.viewH, i, items.length);
    const m = input.mouse;
    if (m.x >= box.x && m.x <= box.x + box.w && m.y >= box.y && m.y <= box.y + box.h) menuAction(item.id);
  });
}

// --- boot: screenshot scenes or the living game ---------------------------------

if (SHOT) {
  const runSeconds = stageShot(S, SHOT);
  S.hasSave = false;
  const steps = Math.max(1, Math.round(runSeconds / (1 / 30)));
  for (let i = 0; i < steps; i++) stepWorld(1 / 30, SHOT === 'title' ? 'ambient' : 'shot');
  window.__shotReady = true;
  // Hold the staged frame: keep time (and the light bars) moving, freeze the world.
  const hold = () => {
    S.time += 1 / 30;
    for (const car of S.cars) if (car.role === 'police') car.lightT += 0.2;
    updateCamera(1 / 30, S.screen === 'title' ? 'ambient' : 'shot');
    drawWorld(ctx, S, S.viewW, S.viewH);
    if (S.screen === 'play') drawHUD(ctx, S, S.viewW, S.viewH);
    drawMenus(ctx, S, S.viewW, S.viewH);
    requestAnimationFrame(hold);
  };
  hold();
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    // First gesture wakes the audio.
    if (input.mouse.clicked || input.pressed.size > 0) {
      audio.initAudio();
      if (S.screen !== 'title') audio.startMusic();
    }
    if (tapped('KeyM')) S.muted = audio.toggleMute();

    if (S.screen === 'play') {
      if (tapped('Escape', 'KeyP')) {
        S.screen = 'pause';
      } else if (S.dialogue) {
        if (tapped('KeyE', 'Enter') || input.mouse.clicked) {
          advanceDialogue();
          input.pressed.delete('KeyE');
        }
        stepWorld(dt, 'play');
      } else {
        if (tapped('KeyE')) {
          useInteraction();
          input.pressed.delete('KeyE');
        }
        stepWorld(dt, 'play');
      }
    } else if (S.screen === 'title' || (S.screen === 'howto' && S.howtoReturn === 'title')) {
      stepWorld(dt, 'ambient');
      handleMenuClicks();
    } else {
      if (S.screen === 'pause' && tapped('Escape', 'KeyP')) S.screen = 'play';
      handleMenuClicks();
    }

    // Engine and siren voices follow the action.
    if (S.screen === 'play' && S.player.inCar && S.player.car && !S.player.car.dead) {
      audio.engine(true, Math.abs(S.player.car.speed) / S.player.car.top);
    } else {
      audio.engine(false);
    }
    if (S.screen === 'play' && S.wanted.stars > 0) {
      const d = nearestPoliceDist(S);
      audio.siren(Math.max(0, Math.min(1, 1 - d / 720)));
    } else {
      audio.siren(0);
    }

    drawWorld(ctx, S, S.viewW, S.viewH);
    if (S.screen === 'play' || S.screen === 'pause') drawHUD(ctx, S, S.viewW, S.viewH);
    drawMenus(ctx, S, S.viewW, S.viewH);
    input.pressed.clear();
    input.mouse.clicked = false;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
