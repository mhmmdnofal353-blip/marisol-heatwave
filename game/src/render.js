// render.js — Marisol Bay from above, at golden hour. The draw order is
// the depth order: ground and sea, roads with their markings, blocks and
// buildings with long shadows, wayfinding beams, skid marks, then cars,
// people, and Juno, with tracers and particles over everything and a warm
// light wash to finish. Every sprite is drawn in code; there are no image
// assets. Effects (particles, tracers, skid marks) live here too: updateFx
// ages them, burst spawns them.

import { ROADS, WORLD, BEACH_X, WATER_X } from './config.js';

/** District names painted large and faint across their own ground. */
const DISTRICT_LABELS = [
  ['CORAL HEIGHTS', 1150, 570],
  ['PALMERA STRIP', 3960, 570],
  ['DOWNTOWN', 2830, 1650],
  ['THE FLATS', 1150, 2730],
  ['SUNPORT DOCKS', 3400, 2730],
  ['OLD MARINA', 2280, 3270],
  ['BAHÍA BEACH', 4690, 1900],
];

/** A hex colour scaled by a brightness factor, as an rgb() string. */
function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
  return `rgb(${clamp((n >> 16) & 255)},${clamp((n >> 8) & 255)},${clamp(n & 255)})`;
}

/** Age the short-lived effects; dead ones are dropped. */
export function updateFx(S, dt) {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      S.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    if (p.rise) p.y -= p.rise * dt;
  }
  for (let i = S.tracers.length - 1; i >= 0; i--) {
    S.tracers[i].t -= dt;
    if (S.tracers[i].t <= 0) S.tracers.splice(i, 1);
  }
  for (let i = S.skids.length - 1; i >= 0; i--) {
    S.skids[i].life -= dt;
    if (S.skids[i].life <= 0) S.skids.splice(i, 1);
  }
}

/** Particle recipes by kind: colours, speeds, sizes, lifetimes, rise. */
const BURST_STYLES = {
  sparks: { colors: ['#ffd166', '#ffb703', '#ffffff'], speed: [40, 190], size: [1.4, 2.6], life: [0.2, 0.5], rise: 0 },
  smoke: { colors: ['#5a5a5e', '#76767c', '#43434a'], speed: [8, 42], size: [5, 11], life: [0.7, 1.6], rise: 26 },
  flame: { colors: ['#ef476f', '#f78c6b', '#ffd166'], speed: [10, 60], size: [3.4, 7], life: [0.25, 0.6], rise: 40 },
  blood: { colors: ['#b3001b', '#8d0801'], speed: [20, 90], size: [1.6, 3], life: [0.25, 0.5], rise: 0 },
  spray: { colors: ['#a8dadc', '#f1fa8c'], speed: [30, 120], size: [1.4, 2.4], life: [0.2, 0.45], rise: 0 },
};

/** Spawn n particles of a kind at a point, in every direction. */
export function burst(S, x, y, kind, n = 8) {
  const style = BURST_STYLES[kind] ?? BURST_STYLES.sparks;
  const between = (pair) => pair[0] + S.rng() * (pair[1] - pair[0]);
  for (let i = 0; i < n; i++) {
    const angle = S.rng() * Math.PI * 2;
    const speed = between(style.speed);
    S.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: between(style.life),
      max: style.life[1],
      size: between(style.size),
      color: style.colors[Math.floor(S.rng() * style.colors.length)],
      rise: style.rise,
      kind,
    });
  }
  if (S.particles.length > 700) S.particles.splice(0, S.particles.length - 700);
}

/** True when a point is inside the camera's view, with padding. */
function inView(S, x, y, pad = 80) {
  const cam = S.camera;
  const hw = S.viewW / 2 / cam.zoom + pad;
  const hh = S.viewH / 2 / cam.zoom + pad;
  return x > cam.x - hw && x < cam.x + hw && y > cam.y - hh && y < cam.y + hh;
}

/** Draw the whole world, then the golden-hour light over it. */
export function drawWorld(ctx, S, W, H) {
  const cam = S.camera;
  // The light breathes: a slow drift between late gold and early dusk,
  // one long cycle the shadows, the lamps and the wash all read from.
  S.daylight = 0.8 + 0.2 * Math.sin(S.time * 0.01 + 0.8);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / cam.zoom - 90;
  const vy0 = cam.y - H / 2 / cam.zoom - 90;
  const vx1 = cam.x + W / 2 / cam.zoom + 90;
  const vy1 = cam.y + H / 2 / cam.zoom + 90;

  drawGround(ctx, S, vx0, vy0, vx1, vy1);
  drawRoads(ctx, S, vx0, vy0, vx1, vy1);
  drawBlocks(ctx, S, vx0, vy0, vx1, vy1);
  drawMarkers(ctx, S);
  drawStashes(ctx, S);
  drawSkids(ctx, S);
  for (const car of S.cars) if (inView(S, car.x, car.y, 90)) drawCar(ctx, S, car);
  for (const ped of S.peds) if (!ped.inCar && inView(S, ped.x, ped.y, 40)) drawPed(ctx, S, ped);
  if (!S.player.inCar) drawPlayer(ctx, S);
  drawFx(ctx, S);
  ctx.restore();

  // Golden hour: warm from the top-left, dusk violet at the far corner —
  // the violet deepens as the light drifts down toward evening.
  const dusk = 1 - S.daylight;
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, `rgba(255,190,90,${0.07 - dusk * 0.03})`);
  wash.addColorStop(0.55, 'rgba(255,140,80,0.03)');
  wash.addColorStop(1, `rgba(70,30,80,${0.10 + dusk * 0.22})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);
}

function drawGround(ctx, S, vx0, vy0, vx1, vy1) {
  // The land itself: warm pavement under everything the city stands on.
  ctx.fillStyle = '#98907f';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Sand, from the beach line to the water line.
  const sandFrom = Math.max(vx0, BEACH_X);
  ctx.fillStyle = '#ecd29a';
  ctx.fillRect(sandFrom, vy0, Math.min(vx1, WATER_X) - sandFrom, vy1 - vy0);
  // The sea: a teal gradient with two layers of drifting sparkle.
  if (vx1 > WATER_X) {
    const sea = ctx.createLinearGradient(WATER_X, 0, WORLD.width, 0);
    sea.addColorStop(0, '#2a9d8f');
    sea.addColorStop(0.25, '#1d7a9e');
    sea.addColorStop(1, '#155e75');
    ctx.fillStyle = sea;
    ctx.fillRect(Math.max(vx0, WATER_X), vy0, vx1 - Math.max(vx0, WATER_X), vy1 - vy0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    for (let y = Math.floor(vy0 / 90) * 90; y < vy1; y += 90) {
      const off = Math.sin(S.time * 0.9 + y * 0.05) * 7;
      ctx.moveTo(WATER_X + 4, y + off);
      ctx.quadraticCurveTo(WATER_X + 16, y + 5 + off, WATER_X + 30, y + off);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    for (let y = Math.floor(vy0 / 130) * 130 + 40; y < vy1; y += 130) {
      for (let x = WATER_X + 120; x < vx1; x += 210) {
        const off = Math.sin(S.time * 1.3 + x * 0.02 + y) * 5;
        ctx.moveTo(x, y + off);
        ctx.lineTo(x + 34, y + off);
      }
    }
    ctx.stroke();
  }
  // District names, painted on the land itself.
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.textAlign = 'center';
  for (const [text, x, y] of DISTRICT_LABELS) {
    if (x > vx0 - 300 && x < vx1 + 300 && y > vy0 - 60 && y < vy1 + 60) ctx.fillText(text, x, y);
  }
}

function drawRoads(ctx, S, vx0, vy0, vx1, vy1) {
  void S;
  const half = ROADS.width / 2;
  const roadEast = Math.min(BEACH_X + 60, vx1);
  // Sidewalk skirts: paler and wider than the asphalt they frame.
  ctx.fillStyle = '#c9c0ae';
  for (const a of ROADS.avenues) ctx.fillRect(a - half - 9, Math.max(0, vy0), ROADS.width + 18, vy1 - vy0);
  for (const s of ROADS.streets) ctx.fillRect(Math.max(0, vx0), s - half - 9, roadEast - vx0, ROADS.width + 18);
  // Asphalt.
  ctx.fillStyle = '#3b4046';
  for (const a of ROADS.avenues) ctx.fillRect(a - half, Math.max(0, vy0), ROADS.width, vy1 - vy0);
  for (const s of ROADS.streets) ctx.fillRect(Math.max(0, vx0), s - half, roadEast - vx0, ROADS.width);
  // Centre dashes down every road.
  ctx.strokeStyle = 'rgba(240,240,230,0.5)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const a of ROADS.avenues) {
    ctx.moveTo(a, vy0);
    ctx.lineTo(a, vy1);
  }
  for (const s of ROADS.streets) {
    ctx.moveTo(vx0, s);
    ctx.lineTo(roadEast, s);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // The Avenida del Sol rates a double yellow line.
  ctx.strokeStyle = 'rgba(255,196,0,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const off of [-3, 3]) {
    ctx.moveTo(ROADS.avenues[3] + off, vy0);
    ctx.lineTo(ROADS.avenues[3] + off, vy1);
  }
  ctx.stroke();
  // Zebra crossings at every intersection in view.
  ctx.fillStyle = 'rgba(245,245,240,0.55)';
  for (const a of ROADS.avenues) {
    if (a < vx0 - 80 || a > vx1 + 80) continue;
    for (const s of ROADS.streets) {
      if (s < vy0 - 80 || s > vy1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        ctx.fillRect(a + i * 12 - 3.4, s - half - 13, 6.8, 9);
        ctx.fillRect(a + i * 12 - 3.4, s + half + 4, 6.8, 9);
        ctx.fillRect(a - half - 13, s + i * 12 - 3.4, 9, 6.8);
        ctx.fillRect(a + half + 4, s + i * 12 - 3.4, 9, 6.8);
      }
    }
  }
}

function drawBlocks(ctx, S, vx0, vy0, vx1, vy1) {
  const city = S.city;
  const onScreen = (x, y, w, h) => !(x > vx1 || x + w < vx0 || y > vy1 || y + h < vy0);
  // Parks: grass with a pale cross of paths.
  for (const park of city.parks) {
    if (!onScreen(park.x, park.y, park.w, park.h)) continue;
    ctx.fillStyle = '#5f9e52';
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = 'rgba(236,210,154,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(park.x, park.y + park.h / 2);
    ctx.lineTo(park.x + park.w, park.y + park.h / 2);
    ctx.moveTo(park.x + park.w / 2, park.y);
    ctx.lineTo(park.x + park.w / 2, park.y + park.h);
    ctx.stroke();
  }
  // Car parks: dark lots with bay markings.
  for (const lot of city.lots) {
    if (!onScreen(lot.x, lot.y, lot.w, lot.h)) continue;
    ctx.fillStyle = '#4a4f55';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(245,245,240,0.4)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = lot.x + 8; x < lot.x + lot.w - 8; x += 52) {
      ctx.moveTo(x, lot.y + 6);
      ctx.lineTo(x, lot.y + 44);
      ctx.moveTo(x, lot.y + lot.h - 6);
      ctx.lineTo(x, lot.y + lot.h - 44);
    }
    ctx.stroke();
  }
  // Building shadows first, thrown long by the low sun — longer still
  // as the light drifts toward dusk.
  for (const b of city.buildings) {
    if (!onScreen(b.x, b.y, b.w, b.h)) continue;
    const throwLen = (7 + b.floors * 1.7) * (1.3 - 0.35 * (S.daylight ?? 1));
    ctx.fillStyle = 'rgba(30,20,10,0.30)';
    ctx.fillRect(b.x + throwLen, b.y + throwLen * 0.7, b.w, b.h);
  }
  // Then the roofs themselves: rim, face, lit inner field, furniture.
  for (const b of city.buildings) {
    if (!onScreen(b.x, b.y, b.w, b.h)) continue;
    ctx.fillStyle = shade(b.color, 0.62);
    ctx.fillRect(b.x - 2.5, b.y - 2.5, b.w + 5, b.h + 5);
    ctx.fillStyle = shade(b.color, 1.0);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(b.color, 1.13);
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    drawRoofFurniture(ctx, b);
    if (b.place === 'hospital') {
      ctx.fillStyle = '#d90429';
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      ctx.fillRect(cx - 4, cy - 15, 8, 30);
      ctx.fillRect(cx - 15, cy - 4, 30, 8);
    }
    if (b.name) {
      ctx.font = '700 12.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(24,26,34,0.6)';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }
  // Crates and containers in the working yards.
  for (const crate of city.crates) {
    if (!inView(S, crate.x, crate.y, 60)) continue;
    ctx.fillStyle = 'rgba(30,20,10,0.25)';
    ctx.fillRect(crate.x + 5, crate.y + 4, crate.w, crate.h);
    ctx.fillStyle = crate.c;
    ctx.fillRect(crate.x, crate.y, crate.w, crate.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(crate.x + 1, crate.y + 1, crate.w - 2, crate.h - 2);
  }
  // Greenery and street furniture.
  for (const palm of city.palms) if (inView(S, palm.x, palm.y, 46)) drawPalm(ctx, palm);
  for (const tree of city.trees) if (inView(S, tree.x, tree.y, 46)) drawTree(ctx, tree);
  ctx.fillStyle = '#2f3542';
  for (const lamp of city.lamps) {
    if (!inView(S, lamp.x, lamp.y, 20)) continue;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // As the light dips the lamps come on, one warm halo at a time.
    const glow = (0.88 - (S.daylight ?? 1)) * 2.4;
    if (glow > 0.04) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, glow);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2f3542';
    }
  }
  // Beach towels: bright rectangles abandoned on the sand.
  for (const towel of city.towels) {
    if (!inView(S, towel.x, towel.y, 24)) continue;
    ctx.save();
    ctx.translate(towel.x, towel.y);
    ctx.rotate(towel.a);
    ctx.fillStyle = towel.c;
    ctx.fillRect(-8, -4.5, 16, 9);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-8, -1.2, 16, 2.4);
    ctx.restore();
  }
  for (const umb of city.umbrellas) {
    if (!inView(S, umb.x, umb.y, 26)) continue;
    ctx.fillStyle = 'rgba(30,20,10,0.18)';
    ctx.beginPath();
    ctx.arc(umb.x + 4, umb.y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = umb.c;
    ctx.beginPath();
    ctx.arc(umb.x, umb.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** AC boxes and a skylight, placed by the building's own seed. */
function drawRoofFurniture(ctx, b) {
  const h1 = ((b.seed * 2654435761) >>> 0) / 4294967295;
  const h2 = ((b.seed * 40503 + 77) >>> 0) / 4294967295;
  const acWidth = Math.max(9, b.w * 0.13);
  ctx.fillStyle = 'rgba(40,42,48,0.5)';
  ctx.fillRect(b.x + 8 + h1 * (b.w - acWidth - 16), b.y + 8 + h2 * (b.h - 26), acWidth, 11);
  if (b.floors >= 4) {
    ctx.fillRect(b.x + b.w - acWidth - 10 - h2 * 20, b.y + b.h - 22 - h1 * 14, acWidth, 11);
  }
  ctx.fillStyle = 'rgba(190,232,245,0.35)';
  ctx.fillRect(b.x + b.w * (0.3 + h1 * 0.3), b.y + b.h * 0.36, b.w * 0.24, b.h * 0.2);
}

function drawPalm(ctx, t) {
  ctx.strokeStyle = 'rgba(30,20,10,0.22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(t.x + 5, t.y + 6);
  ctx.lineTo(t.x, t.y);
  ctx.stroke();
  ctx.strokeStyle = '#3e8914';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + t.x * 0.01;
    ctx.moveTo(t.x, t.y);
    ctx.quadraticCurveTo(
      t.x + Math.cos(a) * 12 * t.s, t.y + Math.sin(a) * 12 * t.s - 4,
      t.x + Math.cos(a) * 19 * t.s, t.y + Math.sin(a) * 19 * t.s + 3);
  }
  ctx.stroke();
}

function drawTree(ctx, t) {
  ctx.fillStyle = 'rgba(30,20,10,0.2)';
  ctx.beginPath();
  ctx.arc(t.x + 5, t.y + 5, 13 * t.s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath();
  ctx.arc(t.x, t.y, 13 * t.s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#40916c';
  ctx.beginPath();
  ctx.arc(t.x - 4, t.y - 3, 8 * t.s, 0, Math.PI * 2);
  ctx.fill();
}

// --- wayfinding ---------------------------------------------------------------

function drawMarkers(ctx, S) {
  if (S.checkpoints) {
    S.checkpoints.list.forEach((cp, i) => {
      if (i < S.checkpoints.current) return; // already taken
      if (!inView(S, cp.x, cp.y, 120)) return;
      const current = i === S.checkpoints.current;
      drawBeam(ctx, S, cp.x, cp.y, current ? '#ffd166' : 'rgba(120,200,255,0.75)', current ? 26 : 17);
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = current ? '#ffd166' : '#bfe8ff';
      ctx.fillText(String(i + 1), cp.x, cp.y - 96 - Math.sin(S.time * 3) * 3);
    });
  }
  if (S.objective && S.screen === 'play') {
    drawBeam(ctx, S, S.objective.x, S.objective.y, '#ffd166', 30);
  }
  if (S.marker && S.screen === 'play') {
    drawBeam(ctx, S, S.marker.x, S.marker.y, S.marker.color, 24);
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(S.marker.icon, S.marker.x, S.marker.y - 104 - Math.sin(S.time * 3) * 3.5);
  }
}

/**
 * The hidden parcels still out there: a small gold drop-box under a
 * mint glow, bobbing gently, with a sparkle that climbs and fades.
 * Nearer and quieter than a mission beam — a secret, not a signpost.
 */
function drawStashes(ctx, S) {
  for (const stash of S.city.stashes) {
    if (stash.taken || !inView(S, stash.x, stash.y, 60)) continue;
    const bob = Math.sin(S.time * 2.6 + stash.id * 1.7) * 2.2;
    ctx.save();
    ctx.strokeStyle = `rgba(123,241,168,${0.5 + Math.sin(S.time * 3.4 + stash.id) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(stash.x, stash.y, 15 + Math.sin(S.time * 3.4 + stash.id) * 2.4, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.translate(stash.x, stash.y + bob);
    ctx.rotate(0.5);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-6.5, -6.5, 13, 13);
    ctx.fillStyle = '#06d6a0';
    ctx.fillRect(-6.5, -1.8, 13, 3.6);
    ctx.fillRect(-1.8, -6.5, 3.6, 13);
    ctx.restore();
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(S.time * 5 + stash.id * 2.3)})`;
    ctx.beginPath();
    ctx.arc(stash.x + 8, stash.y - 12 + bob, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A pillar of light with a pulsing ground ring: the genre's signpost. */
function drawBeam(ctx, S, x, y, color, r) {
  const pulse = 1 + Math.sin(S.time * 4.4) * 0.1;
  ctx.save();
  const grad = ctx.createLinearGradient(0, y - 130, 0, y);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, color);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = grad;
  ctx.fillRect(x - 7, y - 130, 14, 130);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r * pulse, r * 0.42 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSkids(ctx, S) {
  ctx.fillStyle = 'rgba(18,18,20,0.4)';
  for (const skid of S.skids) {
    if (!inView(S, skid.x, skid.y, 30)) continue;
    ctx.save();
    ctx.translate(skid.x, skid.y);
    ctx.rotate(skid.a);
    ctx.globalAlpha = Math.min(0.4, (skid.life / 9) * 0.4);
    ctx.fillRect(-2, -8, 15, 3.4);
    ctx.fillRect(-2, 5, 15, 3.4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// --- actors -------------------------------------------------------------------

function drawCar(ctx, S, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.fillStyle = 'rgba(25,18,8,0.32)';
  ctx.beginPath();
  ctx.ellipse(5, 6, car.len * 0.56, car.wid * 0.62, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = car.len;
  const Wd = car.wid;
  // Wheels; the front pair turns with the steering.
  ctx.fillStyle = '#14151a';
  const wheelPositions = [
    [L * 0.3, -Wd / 2, true], [L * 0.3, Wd / 2, true],
    [-L * 0.3, -Wd / 2, false], [-L * 0.3, Wd / 2, false],
  ];
  for (const [wx, wy, isFront] of wheelPositions) {
    ctx.save();
    ctx.translate(wx, wy);
    if (isFront) ctx.rotate(car.steerVis * 0.42);
    ctx.fillRect(-3.2, -2.4, 6.4, 4.8 + 1.4);
    ctx.restore();
  }
  // Body.
  ctx.beginPath();
  ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 5.5);
  ctx.fillStyle = car.dead ? '#2b2b30' : car.color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,10,14,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (!car.dead) drawCarLivery(ctx, car, L, Wd);
  // The buggy has no glasshouse: an open roll cage and a spare wheel.
  if (car.type === 'buggy' && !car.dead) {
    ctx.strokeStyle = '#26303a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-L * 0.22, -Wd / 2 + 2.4);
    ctx.lineTo(-L * 0.22, Wd / 2 - 2.4);
    ctx.moveTo(L * 0.14, -Wd / 2 + 2.4);
    ctx.lineTo(L * 0.14, Wd / 2 - 2.4);
    ctx.moveTo(-L * 0.22, 0);
    ctx.lineTo(L * 0.14, 0);
    ctx.stroke();
    ctx.fillStyle = '#14151a';
    ctx.beginPath();
    ctx.arc(-L * 0.36, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3f4a';
    ctx.beginPath();
    ctx.arc(-L * 0.36, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Glasshouse, except on the box vans and the open buggy.
  if (car.type !== 'van' && car.type !== 'armored' && car.type !== 'buggy') {
    ctx.beginPath();
    ctx.roundRect(-L * 0.2, -Wd / 2 + 2.6, L * 0.36, Wd - 5.2, 3.6);
    ctx.fillStyle = car.dead ? '#1c1c20' : '#a8d8ea';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(L * 0.06, -Wd / 2 + 3.4, 3, Wd - 6.8);
  }
  // Headlights and tail lights; the tails flare under braking.
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 2.4, 3.6);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 5.6, 2.4, 3.6);
  ctx.fillStyle = car._brake ? '#ff2e4d' : '#a4133c';
  ctx.fillRect(-L / 2 - 0.4, -Wd / 2 + 2, 2.4, 3.6);
  ctx.fillRect(-L / 2 - 0.4, Wd / 2 - 5.6, 2.4, 3.6);
  if (car.type === 'police' && !car.dead) drawLightBar(ctx, car, Wd);
  ctx.restore();

  // The car a mission wants wears a glittering gold outline.
  if (car.mission === 'steal' && !car.dead) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,209,102,${0.65 + Math.sin(S.time * 5) * 0.3})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(car.x, car.y, car.len * 0.72, car.len * 0.5, car.angle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // A hurt engine smokes; a dead one burns.
  if (!car.dead && car.hp < car.maxHp * 0.42 && Math.random() < 0.3) {
    burst(S, car.x + Math.cos(car.angle) * car.len * 0.4, car.y + Math.sin(car.angle) * car.len * 0.4, 'smoke', 1);
  }
  if (car.dead && Math.random() < 0.4) {
    burst(S, car.x, car.y, 'flame', 1);
    if (Math.random() < 0.3) burst(S, car.x, car.y, 'smoke', 1);
  }
}

/** Livery per type: MBPD doors, the cab's sign, the van's cargo box. */
function drawCarLivery(ctx, car, L, Wd) {
  if (car.type === 'police') {
    ctx.fillStyle = '#17202b';
    ctx.fillRect(-L * 0.16, -Wd / 2, L * 0.34, Wd);
    ctx.font = '700 6.4px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f6f8';
    ctx.fillText('MBPD', 0, 2.4);
  } else if (car.type === 'taxi') {
    ctx.fillStyle = '#14232e';
    ctx.fillRect(-2, -Wd / 2, 4, Wd);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-L * 0.06, -3.4, L * 0.13, 6.8);
  } else if (car.type === 'van' || car.type === 'armored') {
    ctx.strokeStyle = 'rgba(10,10,14,0.3)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-L * 0.44, -Wd / 2 + 2.4, L * 0.6, Wd - 4.8);
    if (car.type === 'armored') {
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,240,240,0.85)';
      ctx.fillText('BRINKS', -L * 0.14, 2.6);
    }
  }
}

/** The police light bar: alternating red and blue, with a soft halo. */
function drawLightBar(ctx, car, Wd) {
  const redPhase = Math.sin(car.lightT * 3.2) > 0;
  ctx.fillStyle = redPhase ? '#ff2e4d' : '#5a0f1d';
  ctx.fillRect(-3.4, -Wd / 2 + 1.6, 6.8, 4.6);
  ctx.fillStyle = redPhase ? '#274bdb' : '#4dabff';
  ctx.fillRect(-3.4, Wd / 2 - 6.2, 6.8, 4.6);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = redPhase ? '#ff2e4d' : '#4dabff';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPed(ctx, S, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(25,18,8,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 7.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.dead) {
    // Down: body stretched along the fall, head to one side.
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(9.6, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (ped.speed > 4) drawWalkLegs(ctx, ped);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 6.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair, or the dark blue of an officer's cap.
  ctx.fillStyle = ped.role === 'officer' ? '#1d3557' : ped.hair;
  ctx.beginPath();
  ctx.arc(-0.8, -0.6, 2.7, Math.PI * 0.7, Math.PI * 1.9);
  ctx.fill();
  // A walker's straw sun hat: a wide pale brim over the hair.
  if (ped.hat) {
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.6, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.arc(0, 0, 2.9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ped.role === 'ganger') {
    // The Serpents' blue bandana, and the gun when he is fighting.
    ctx.fillStyle = '#28418c';
    ctx.beginPath();
    ctx.arc(0.6, 0.4, 2.8, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'fight') {
      ctx.strokeStyle = '#14151a';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4);
      ctx.lineTo(Math.cos(ped.angle) * 12, Math.sin(ped.angle) * 12);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Mission people carry a bobbing gold diamond so the eye finds them.
  if (ped.role === 'friend' && ped.state === 'wait') {
    ctx.save();
    ctx.translate(ped.x, ped.y - 20 + Math.sin(S.time * 3.4) * 3);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4.4, -4.4, 8.8, 8.8);
    ctx.restore();
  }
}

/** Two legs swinging against each other with the walk phase. */
function drawWalkLegs(ctx, ped) {
  const swing = Math.sin(ped.phase) * 4.4;
  const fx = Math.cos(ped.angle);
  const fy = Math.sin(ped.angle);
  ctx.strokeStyle = ped.pants ?? '#26303a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(fx * swing - fy * 2.4, fy * swing + fx * 2.4);
  ctx.moveTo(0, 0);
  ctx.lineTo(-fx * swing + fy * 2.4, -fy * swing - fx * 2.4);
  ctx.stroke();
}

function drawPlayer(ctx, S) {
  const P = S.player;
  // A soft gold ring keeps Juno findable in a crowd.
  ctx.save();
  ctx.strokeStyle = `rgba(255,209,102,${0.5 + Math.sin(S.time * 4) * 0.18})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(P.x, P.y + 2, 13, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(P.x, P.y);
  ctx.fillStyle = 'rgba(25,18,8,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 7.6, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (P.moving) {
    const swing = Math.sin(P.phase) * 4.6;
    const fx = Math.cos(P.angle);
    const fy = Math.sin(P.angle);
    ctx.strokeStyle = '#26303a';
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fx * swing - fy * 2.4, fy * swing + fx * 2.4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-fx * swing + fy * 2.4, -fy * swing - fx * 2.4);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff6b5e'; // Juno's coral jacket
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2e2a';
  ctx.beginPath();
  ctx.arc(-0.8, -0.6, 2.8, Math.PI * 0.7, Math.PI * 1.9);
  ctx.fill();
  // The pistol, levelled at the mouse.
  ctx.strokeStyle = '#14151a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(Math.cos(P.angle) * 4, Math.sin(P.angle) * 4);
  ctx.lineTo(Math.cos(P.angle) * 13, Math.sin(P.angle) * 13);
  ctx.stroke();
  ctx.restore();
}

function drawFx(ctx, S) {
  for (const tracer of S.tracers) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, tracer.t / 0.08);
    ctx.strokeStyle = tracer.color;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(tracer.x1, tracer.y1);
    ctx.lineTo(tracer.x2, tracer.y2);
    ctx.stroke();
    ctx.restore();
  }
  for (const p of S.particles) {
    const fade = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = p.kind === 'smoke' ? 0.3 * fade : 0.85 * fade;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    const size = p.kind === 'smoke' ? p.size * (1 + (1 - fade) * 1.6) : p.size;
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
