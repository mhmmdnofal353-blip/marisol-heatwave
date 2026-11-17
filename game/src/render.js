// The renderer: Marisol Bay from above at golden hour. Ground, roads with
// markings and crosswalks, parks, the beach and the animated sea, buildings
// with long shadows and named roofs, palms and lamps, then the traffic, the
// people and Juno herself — with skid marks, tracers and particles over it
// all, and a warm light wash to finish.

import { ROADS, WORLD, BEACH_X, WATER_X } from './config.js';

const DISTRICT_LABELS = [
  ['CORAL HEIGHTS', 1150, 570],
  ['PALMERA STRIP', 3960, 570],
  ['DOWNTOWN', 2830, 1650],
  ['THE FLATS', 1150, 2730],
  ['SUNPORT DOCKS', 3400, 2730],
  ['OLD MARINA', 2280, 3270],
  ['BAHÍA BEACH', 4690, 1900],
];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/** Advance the short-lived effects: particles and tracers. */
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

/** Spawn a burst of particles: sparks, smoke, flame, blood, spray. */
export function burst(S, x, y, kind, n = 8) {
  const styles = {
    sparks: { colors: ['#ffd166', '#ffb703', '#ffffff'], sp: [40, 190], size: [1.4, 2.6], life: [0.2, 0.5], rise: 0 },
    smoke: { colors: ['#5a5a5e', '#76767c', '#43434a'], sp: [8, 42], size: [5, 11], life: [0.7, 1.6], rise: 26 },
    flame: { colors: ['#ef476f', '#f78c6b', '#ffd166'], sp: [10, 60], size: [3.4, 7], life: [0.25, 0.6], rise: 40 },
    blood: { colors: ['#b3001b', '#8d0801'], sp: [20, 90], size: [1.6, 3], life: [0.25, 0.5], rise: 0 },
    spray: { colors: ['#a8dadc', '#f1fa8c'], sp: [30, 120], size: [1.4, 2.4], life: [0.2, 0.45], rise: 0 },
  };
  const st = styles[kind] ?? styles.sparks;
  for (let i = 0; i < n; i++) {
    const a = S.rng() * Math.PI * 2;
    const sp = st.sp[0] + S.rng() * (st.sp[1] - st.sp[0]);
    S.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: st.life[0] + S.rng() * (st.life[1] - st.life[0]),
      max: st.life[1],
      size: st.size[0] + S.rng() * (st.size[1] - st.size[0]),
      color: st.colors[Math.floor(S.rng() * st.colors.length)],
      rise: st.rise,
      kind,
    });
  }
  if (S.particles.length > 700) S.particles.splice(0, S.particles.length - 700);
}

function inView(S, x, y, pad = 80) {
  const c = S.camera;
  const hw = S.viewW / 2 / c.zoom + pad;
  const hh = S.viewH / 2 / c.zoom + pad;
  return x > c.x - hw && x < c.x + hw && y > c.y - hh && y < c.y + hh;
}

/** Draw everything: the world, then the light over it. The HUD is hud.js. */
export function drawWorld(ctx, S, W, H) {
  const cam = S.camera;
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
  drawSkids(ctx, S);
  for (const car of S.cars) if (inView(S, car.x, car.y, 90)) drawCar(ctx, S, car);
  for (const ped of S.peds) if (!ped.inCar && inView(S, ped.x, ped.y, 40)) drawPed(ctx, S, ped);
  if (!S.player.inCar) drawPlayer(ctx, S);
  drawFx(ctx, S);
  ctx.restore();

  // Golden-hour wash and a soft vignette.
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, 'rgba(255,190,90,0.07)');
  grad.addColorStop(0.55, 'rgba(255,140,80,0.03)');
  grad.addColorStop(1, 'rgba(70,30,80,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawGround(ctx, S, vx0, vy0, vx1, vy1) {
  // Land: warm pavement everywhere the city stands.
  ctx.fillStyle = '#98907f';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Sand.
  ctx.fillStyle = '#ecd29a';
  ctx.fillRect(Math.max(vx0, BEACH_X), vy0, Math.min(vx1, WATER_X) - Math.max(vx0, BEACH_X), vy1 - vy0);
  // Sea: layered teal with drifting sparkle.
  if (vx1 > WATER_X) {
    const sea = ctx.createLinearGradient(WATER_X, 0, WORLD.width, 0);
    sea.addColorStop(0, '#2a9d8f');
    sea.addColorStop(0.25, '#1d7a9e');
    sea.addColorStop(1, '#155e75');
    ctx.fillStyle = sea;
    ctx.fillRect(Math.max(vx0, WATER_X), vy0, vx1 - Math.max(vx0, WATER_X), vy1 - vy0);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
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
  // District names, painted large and faint on the land.
  ctx.font = '700 44px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.textAlign = 'center';
  for (const [label, x, y] of DISTRICT_LABELS) {
    if (x > vx0 - 300 && x < vx1 + 300 && y > vy0 - 60 && y < vy1 + 60) ctx.fillText(label, x, y);
  }
}

function drawRoads(ctx, S, vx0, vy0, vx1, vy1) {
  const half = ROADS.width / 2;
  // Sidewalk skirts first, wider and paler than the asphalt.
  ctx.fillStyle = '#c9c0ae';
  for (const a of ROADS.avenues) ctx.fillRect(a - half - 9, Math.max(0, vy0), ROADS.width + 18, vy1 - vy0);
  for (const s of ROADS.streets) ctx.fillRect(Math.max(0, vx0), s - half - 9, Math.min(BEACH_X + 60, vx1) - vx0, ROADS.width + 18);
  ctx.fillStyle = '#3b4046';
  for (const a of ROADS.avenues) ctx.fillRect(a - half, Math.max(0, vy0), ROADS.width, vy1 - vy0);
  for (const s of ROADS.streets) ctx.fillRect(Math.max(0, vx0), s - half, Math.min(BEACH_X + 60, vx1) - vx0, ROADS.width);
  // Lane dashes.
  ctx.strokeStyle = 'rgba(240,240,230,0.5)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const a of ROADS.avenues) {
    for (const off of [-ROADS.lane - 11, ROADS.lane + 11]) {
      void off;
    }
    ctx.moveTo(a, vy0);
    ctx.lineTo(a, vy1);
  }
  for (const s of ROADS.streets) {
    ctx.moveTo(vx0, s);
    ctx.lineTo(Math.min(BEACH_X + 60, vx1), s);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Centre double-yellow on the Avenida del Sol.
  ctx.strokeStyle = 'rgba(255,196,0,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ROADS.avenues[3] - 3, vy0);
  ctx.lineTo(ROADS.avenues[3] - 3, vy1);
  ctx.moveTo(ROADS.avenues[3] + 3, vy0);
  ctx.lineTo(ROADS.avenues[3] + 3, vy1);
  ctx.stroke();
  // Crosswalks at the intersections in view.
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
  for (const p of city.parks) {
    if (p.x > vx1 || p.x + p.w < vx0 || p.y > vy1 || p.y + p.h < vy0) continue;
    ctx.fillStyle = '#5f9e52';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(236,210,154,0.5)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h / 2);
    ctx.lineTo(p.x + p.w, p.y + p.h / 2);
    ctx.moveTo(p.x + p.w / 2, p.y);
    ctx.lineTo(p.x + p.w / 2, p.y + p.h);
    ctx.stroke();
  }
  for (const lot of city.lots) {
    if (lot.x > vx1 || lot.x + lot.w < vx0 || lot.y > vy1 || lot.y + lot.h < vy0) continue;
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
  // Shadows first, so every roof sits in its own shade.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    const off = 7 + b.floors * 1.7;
    ctx.fillStyle = 'rgba(30,20,10,0.30)';
    ctx.fillRect(b.x + off, b.y + off * 0.7, b.w, b.h);
  }
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = shade(b.color, 0.62);
    ctx.fillRect(b.x - 2.5, b.y - 2.5, b.w + 5, b.h + 5);
    ctx.fillStyle = shade(b.color, 1.0);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(b.color, 1.13);
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Rooftop furniture from the building's own seed: AC boxes and a skylight.
    const h1 = ((b.seed * 2654435761) >>> 0) / 4294967295;
    const h2 = ((b.seed * 40503 + 77) >>> 0) / 4294967295;
    ctx.fillStyle = 'rgba(40,42,48,0.5)';
    const acw = Math.max(9, b.w * 0.13);
    ctx.fillRect(b.x + 8 + h1 * (b.w - acw - 16), b.y + 8 + h2 * (b.h - 26), acw, 11);
    if (b.floors >= 4) ctx.fillRect(b.x + b.w - acw - 10 - h2 * 20, b.y + b.h - 22 - h1 * 14, acw, 11);
    ctx.fillStyle = 'rgba(190,232,245,0.35)';
    ctx.fillRect(b.x + b.w * (0.3 + h1 * 0.3), b.y + b.h * 0.36, b.w * 0.24, b.h * 0.2);
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
  for (const c of city.crates) {
    if (!inView(S, c.x, c.y, 60)) continue;
    ctx.fillStyle = 'rgba(30,20,10,0.25)';
    ctx.fillRect(c.x + 5, c.y + 4, c.w, c.h);
    ctx.fillStyle = c.c;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }
  // Palms, trees, lamps, umbrellas.
  for (const t of city.palms) if (inView(S, t.x, t.y, 46)) drawPalm(ctx, t);
  for (const t of city.trees) if (inView(S, t.x, t.y, 46)) drawTree(ctx, t);
  ctx.fillStyle = '#2f3542';
  for (const l of city.lamps) {
    if (!inView(S, l.x, l.y, 20)) continue;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const u of city.umbrellas) {
    if (!inView(S, u.x, u.y, 26)) continue;
    ctx.fillStyle = 'rgba(30,20,10,0.18)';
    ctx.beginPath();
    ctx.arc(u.x + 4, u.y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = u.c;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
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
    ctx.quadraticCurveTo(t.x + Math.cos(a) * 12 * t.s, t.y + Math.sin(a) * 12 * t.s - 4, t.x + Math.cos(a) * 19 * t.s, t.y + Math.sin(a) * 19 * t.s + 3);
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

function drawMarkers(ctx, S) {
  // Checkpoint pillars for the race.
  if (S.checkpoints) {
    S.checkpoints.list.forEach((cp, i) => {
      if (!inView(S, cp.x, cp.y, 120)) return;
      const current = i === S.checkpoints.current;
      if (i < S.checkpoints.current) return;
      beam(ctx, S, cp.x, cp.y, current ? '#ffd166' : 'rgba(120,200,255,0.75)', current ? 26 : 17);
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = current ? '#ffd166' : '#bfe8ff';
      ctx.fillText(String(i + 1), cp.x, cp.y - 96 - Math.sin(S.time * 3) * 3);
    });
  }
  // The objective marker.
  if (S.objective && S.screen === 'play') beam(ctx, S, S.objective.x, S.objective.y, '#ffd166', 30);
  // A standing invitation: the next job's marker.
  if (S.marker && S.screen === 'play') {
    beam(ctx, S, S.marker.x, S.marker.y, S.marker.color, 24);
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(S.marker.icon, S.marker.x, S.marker.y - 104 - Math.sin(S.time * 3) * 3.5);
  }
}

/** A pillar of light with a pulsing base ring: the genre's wayfinding. */
function beam(ctx, S, x, y, color, r) {
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
  for (const s of S.skids) {
    if (!inView(S, s.x, s.y, 30)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.a);
    ctx.globalAlpha = Math.min(0.4, s.life / 9 * 0.4);
    ctx.fillRect(-2, -8, 15, 3.4);
    ctx.fillRect(-2, 5, 15, 3.4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// --- actors ------------------------------------------------------------------

function drawCar(ctx, S, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // Ground shadow.
  ctx.fillStyle = 'rgba(25,18,8,0.32)';
  ctx.beginPath();
  ctx.ellipse(5, 6, car.len * 0.56, car.wid * 0.62, car.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(car.angle);
  const L = car.len;
  const Wd = car.wid;
  const body = car.dead ? '#2b2b30' : car.color;
  // Wheels; the front pair turns with the steering.
  ctx.fillStyle = '#14151a';
  const ww = 6.4;
  const wh = 3.4;
  for (const [wx, wy, front] of [[L * 0.3, -Wd / 2, 1], [L * 0.3, Wd / 2, 1], [-L * 0.3, -Wd / 2, 0], [-L * 0.3, Wd / 2, 0]]) {
    ctx.save();
    ctx.translate(wx, wy);
    if (front) ctx.rotate(car.steerVis * 0.42);
    ctx.fillRect(-ww / 2, -wh / 2, ww, wh + 1.4);
    ctx.restore();
  }
  // Body.
  ctx.beginPath();
  ctx.roundRect(-L / 2, -Wd / 2, L, Wd, 5.5);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,10,14,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  if (car.type === 'police' && !car.dead) {
    ctx.fillStyle = '#17202b';
    ctx.fillRect(-L * 0.16, -Wd / 2, L * 0.34, Wd);
    ctx.font = '700 6.4px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f6f8';
    ctx.fillText('MBPD', 0, 2.4);
  }
  if (car.type === 'taxi' && !car.dead) {
    ctx.fillStyle = '#14232e';
    ctx.fillRect(-2, -Wd / 2, 4, Wd);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-L * 0.06, -3.4, L * 0.13, 6.8);
  }
  if ((car.type === 'van' || car.type === 'armored') && !car.dead) {
    ctx.strokeStyle = 'rgba(10,10,14,0.3)';
    ctx.strokeRect(-L * 0.44, -Wd / 2 + 2.4, L * 0.6, Wd - 4.8);
    if (car.type === 'armored') {
      ctx.font = '700 7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,240,240,0.85)';
      ctx.fillText('BRINKS', -L * 0.14, 2.6);
    }
  }
  // Cabin and glass.
  if (car.type !== 'van' && car.type !== 'armored') {
    ctx.beginPath();
    ctx.roundRect(-L * 0.2, -Wd / 2 + 2.6, L * 0.36, Wd - 5.2, 3.6);
    ctx.fillStyle = car.dead ? '#1c1c20' : '#a8d8ea';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(L * 0.06, -Wd / 2 + 3.4, 3, Wd - 6.8);
  }
  // Lights.
  ctx.fillStyle = '#fff7ae';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 2, 2.4, 3.6);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 5.6, 2.4, 3.6);
  const braking = car._brake;
  ctx.fillStyle = braking ? '#ff2e4d' : '#a4133c';
  ctx.fillRect(-L / 2 - 0.4, -Wd / 2 + 2, 2.4, 3.6);
  ctx.fillRect(-L / 2 - 0.4, Wd / 2 - 5.6, 2.4, 3.6);
  // Police light bar, flashing.
  if (car.type === 'police' && !car.dead) {
    const phase = Math.sin(car.lightT * 3.2) > 0;
    ctx.fillStyle = phase ? '#ff2e4d' : '#5a0f1d';
    ctx.fillRect(-3.4, -Wd / 2 + 1.6, 6.8, 4.6);
    ctx.fillStyle = phase ? '#274bdb' : '#4dabff';
    ctx.fillRect(-3.4, Wd / 2 - 6.2, 6.8, 4.6);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = phase ? '#ff2e4d' : '#4dabff';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  // The car the mission wants glitters gold.
  if (car.mission === 'steal' && !car.dead) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,209,102,${0.65 + Math.sin(S.time * 5) * 0.3})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(car.x, car.y, car.len * 0.72, car.len * 0.5, car.angle, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Smoke and flame from a dying engine.
  if (!car.dead && car.hp < car.maxHp * 0.42 && Math.random() < 0.3) {
    burst(S, car.x + Math.cos(car.angle) * car.len * 0.4, car.y + Math.sin(car.angle) * car.len * 0.4, 'smoke', 1);
  }
  if (car.dead && Math.random() < 0.4) {
    burst(S, car.x, car.y, 'flame', 1);
    if (Math.random() < 0.3) burst(S, car.x, car.y, 'smoke', 1);
  }
}

function drawPed(ctx, S, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(25,18,8,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 7.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ped.dead) {
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
  // Legs swing with the walk phase.
  if (ped.speed > 4) {
    ctx.strokeStyle = '#26303a';
    ctx.lineWidth = 2.6;
    const sw = Math.sin(ped.phase) * 4.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ped.angle) * sw - Math.sin(ped.angle) * 2.4, Math.sin(ped.angle) * sw + Math.cos(ped.angle) * 2.4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(ped.angle) * sw + Math.sin(ped.angle) * 2.4, -Math.sin(ped.angle) * sw - Math.cos(ped.angle) * 2.4);
    ctx.stroke();
  }
  // Body and head.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 6.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.role === 'officer' ? '#1d3557' : ped.hair;
  ctx.beginPath();
  ctx.arc(-0.8, -0.6, 2.7, Math.PI * 0.7, Math.PI * 1.9);
  ctx.fill();
  if (ped.role === 'ganger') {
    // A Serpent's blue bandana and, when fighting, the gun in his hand.
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
  // Mission people wear a gold diamond so the eye finds them.
  if (ped.role === 'friend' && ped.state === 'wait') {
    const bob = Math.sin(S.time * 3.4) * 3;
    ctx.save();
    ctx.translate(ped.x, ped.y - 20 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4.4, -4.4, 8.8, 8.8);
    ctx.restore();
  }
}

function drawPlayer(ctx, S) {
  const P = S.player;
  // A soft gold ring marks Juno in a crowd.
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
    ctx.strokeStyle = '#26303a';
    ctx.lineWidth = 2.7;
    const sw = Math.sin(P.phase) * 4.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(P.angle) * sw - Math.sin(P.angle) * 2.4, Math.sin(P.angle) * sw + Math.cos(P.angle) * 2.4);
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(P.angle) * sw + Math.sin(P.angle) * 2.4, -Math.sin(P.angle) * sw - Math.cos(P.angle) * 2.4);
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
  // The pistol, toward the mouse.
  ctx.strokeStyle = '#14151a';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(Math.cos(P.angle) * 4, Math.sin(P.angle) * 4);
  ctx.lineTo(Math.cos(P.angle) * 13, Math.sin(P.angle) * 13);
  ctx.stroke();
  ctx.restore();
}

function drawFx(ctx, S) {
  for (const t of S.tracers) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, t.t / 0.08);
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
    ctx.restore();
  }
  for (const p of S.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.save();
    ctx.globalAlpha = p.kind === 'smoke' ? 0.3 * a : 0.85 * a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === 'smoke' ? 1 + (1 - a) * 1.6 : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
