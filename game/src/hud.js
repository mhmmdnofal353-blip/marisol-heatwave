// hud.js — everything drawn over the world: the circular minimap with its
// blips, wanted stars, cash and respect, health and armour bars, the car
// panel, the objective banner, toasts, dialogue, and the full-screen menus
// (title, how to play, pause, busted, wasted, story complete). Buttons are
// data — menuItems says what a screen offers and menuItemBox where each
// button sits — so main.js can hit-test clicks against the very boxes this
// file draws.

import { ROADS, WORLD, BEACH_X, WATER_X } from './config.js';
import { input } from './input.js';

/** A rounded rectangle path, ready to fill or stroke. */
function panel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One line of HUD text with the game's defaults. */
function label(ctx, str, x, y, size, color, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

/** Word-wrap a dialogue line to a pixel width; returns the lines. */
function wrapLine(ctx, str, size, maxWidth) {
  ctx.font = `500 ${size}px system-ui, sans-serif`;
  const words = str.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// --- the minimap -----------------------------------------------------------

const MAP_SPAN = 1560; // world pixels shown across the minimap

/** The circular minimap: land, roads, sea, and every blip that matters. */
export function drawMinimap(ctx, S, cx, cy, radius) {
  const P = S.player;
  const scale = (radius * 2) / MAP_SPAN;
  const toMap = (wx, wy) => [cx + (wx - P.x) * scale, cy + (wy - P.y) * scale];

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#20313d';
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Sand and sea down the east edge.
  const [sandEdge] = toMap(BEACH_X, 0);
  const [seaEdge] = toMap(WATER_X, 0);
  ctx.fillStyle = '#c2a36b';
  ctx.fillRect(sandEdge, cy - radius, Math.max(0, seaEdge - sandEdge), radius * 2);
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(seaEdge, cy - radius, radius * 2, radius * 2);

  // City blocks as faint land parcels.
  ctx.fillStyle = '#273c47';
  for (const block of S.city.blocks) {
    const [bx, by] = toMap(block.x, block.y);
    ctx.fillRect(bx, by, block.w * scale, block.h * scale);
  }

  // The road grid.
  ctx.strokeStyle = '#5b7183';
  ctx.lineWidth = Math.max(2, ROADS.width * scale);
  ctx.beginPath();
  for (const avenue of ROADS.avenues) {
    const [x0, y0] = toMap(avenue, 0);
    const [, y1] = toMap(avenue, WORLD.height);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0, y1);
  }
  for (const street of ROADS.streets) {
    const [x0, y0] = toMap(0, street);
    const [x1] = toMap(WORLD.width, street);
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y0);
  }
  ctx.stroke();

  const blip = (wx, wy, color, r = 3.4) => {
    const [x, y] = toMap(wx, wy);
    if (x < cx - radius || x > cx + radius || y < cy - radius || y > cy + radius) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const garage of S.city.places.garages ?? []) blip(garage.x, garage.y, '#06d6a0', 3);
  if (S.city.places.safehouse) {
    blip(S.city.places.safehouse.x, S.city.places.safehouse.y, '#ffffff', 3);
  }
  if (S.marker && S.screen === 'play') blip(S.marker.x, S.marker.y, '#ffd166', 4);
  for (const ped of S.peds) {
    if (ped.dead || ped.inCar) continue;
    if (ped.role === 'ganger') blip(ped.x, ped.y, '#ef476f', 3);
    else if (ped.role === 'officer') blip(ped.x, ped.y, '#4dabff', 3);
    else if (ped.role === 'friend') blip(ped.x, ped.y, '#ffd166', 3.4);
  }
  for (const car of S.cars) {
    if (car.dead) continue;
    if (car.role === 'police') blip(car.x, car.y, Math.sin(S.time * 7) > 0 ? '#4dabff' : '#ef476f', 3.4);
    else if (car.mission === 'steal') blip(car.x, car.y, '#ffd166', 3.6);
  }
  if (S.objective) {
    blip(S.objective.x, S.objective.y, '#ffd166', 4.6 + Math.sin(S.time * 5) * 1.1);
  }
  ctx.restore();

  // Juno's arrow, centred, facing the way she faces.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(P.angle + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -7.5);
  ctx.lineTo(5.2, 6);
  ctx.lineTo(0, 2.6);
  ctx.lineTo(-5.2, 6);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#10222e';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  // The rim: quiet grey, or the red-blue pulse of an active hunt.
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = S.wanted.stars > 0
    ? (Math.sin(S.time * 7) > 0 ? '#3f8cff' : '#ef476f')
    : 'rgba(10,20,28,0.75)';
  ctx.stroke();
  label(ctx, 'N', cx, cy - radius - 6, 11, '#cfe3ee', 'center', 700);
}

/** One wanted star: gold and filled, or a hollow outline. */
function drawStar(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let point = 0; point < 5; point++) {
    const outer = -Math.PI / 2 + (point * 2 * Math.PI) / 5;
    const inner = outer + Math.PI / 5;
    if (point === 0) ctx.moveTo(x + Math.cos(outer) * r, y + Math.sin(outer) * r);
    else ctx.lineTo(x + Math.cos(outer) * r, y + Math.sin(outer) * r);
    ctx.lineTo(x + Math.cos(inner) * r * 0.45, y + Math.sin(inner) * r * 0.45);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#ffd166';
    ctx.fill();
  }
  ctx.strokeStyle = filled ? '#a86e00' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// --- the in-play HUD ---------------------------------------------------------

/** Everything overlaid on the world while playing (and while paused). */
export function drawHUD(ctx, S, W, H) {
  const P = S.player;
  drawMinimap(ctx, S, 108, H - 108, 88);

  // Top right: the stars, and beneath them money and standing.
  const shakingOff = S.wanted.stars > 0 && !S.wanted.seen && S.wanted.searchT > 0;
  const blinkOff = shakingOff && Math.sin(S.time * 6) > 0.2;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, W - 34 - (4 - i) * 34, 36, 13, i < S.wanted.stars && !blinkOff);
  }
  if (shakingOff) label(ctx, 'LOSING THEM…', W - 34, 66, 11, '#9fd8ff', 'right', 700);
  label(ctx, `$${P.cash.toLocaleString('en-US')}`, W - 30, 100, 27, '#7bf1a8', 'right', 800);
  label(ctx, `RESPECT · LV ${Math.floor(P.respect / 60) + 1}`, W - 30, 122, 12, '#ffd166', 'right', 700);

  // The BUSTED meter, only while it is filling.
  if (S.wanted.bust > 0.02) {
    panel(ctx, W - 190, 132, 160, 12, 6);
    ctx.fillStyle = 'rgba(10,16,22,0.7)';
    ctx.fill();
    panel(ctx, W - 190, 132, 160 * S.wanted.bust, 12, 6);
    ctx.fillStyle = '#ef476f';
    ctx.fill();
    label(ctx, 'BUSTED', W - 110, 126, 11, '#ef476f', 'center', 800);
  }

  // Bottom left over the minimap: health, and armour when she wears any.
  const barX = 24;
  const barY = H - 236;
  panel(ctx, barX, barY, 168, 13, 6);
  ctx.fillStyle = 'rgba(10,16,22,0.65)';
  ctx.fill();
  panel(ctx, barX, barY, 168 * Math.max(0, P.hp / P.maxHp), 13, 6);
  ctx.fillStyle = P.hp > 30 ? '#57cc5e' : '#ef476f';
  ctx.fill();
  label(ctx, 'HEALTH', barX, barY - 5, 10, '#cfe3ee', 'left', 700);
  if (P.armor > 0) {
    panel(ctx, barX, barY + 22, 168, 9, 5);
    ctx.fillStyle = 'rgba(10,16,22,0.65)';
    ctx.fill();
    panel(ctx, barX, barY + 22, 168 * Math.min(1, P.armor / 100), 9, 5);
    ctx.fillStyle = '#4dabff';
    ctx.fill();
    label(ctx, 'ARMOUR', barX, barY + 17, 10, '#cfe3ee', 'left', 700);
  }

  // Bottom right: the car she is in, or the pistol she is carrying.
  if (P.inCar && P.car) {
    const car = P.car;
    label(ctx, car.label.toUpperCase(), W - 30, H - 66, 13, '#cfe3ee', 'right', 700);
    label(ctx, `${Math.round(Math.abs(car.speed) * 0.36)}`, W - 74, H - 26, 34, '#ffffff', 'right', 800);
    label(ctx, 'km/h', W - 30, H - 26, 13, '#9fb6c3', 'right', 600);
    panel(ctx, W - 190, H - 56, 160, 7, 4);
    ctx.fillStyle = 'rgba(10,16,22,0.65)';
    ctx.fill();
    panel(ctx, W - 190, H - 56, 160 * Math.max(0, car.hp / car.maxHp), 7, 4);
    ctx.fillStyle = car.hp > car.maxHp * 0.35 ? '#ffd166' : '#ef476f';
    ctx.fill();
  } else {
    label(ctx, 'PISTOL · ∞', W - 30, H - 30, 13, '#cfe3ee', 'right', 700);
  }

  drawObjective(ctx, S, W);
  drawToasts(ctx, S, W);
  drawBanner(ctx, S, W, H);

  // The standing prompt: one key does the thing the world is offering.
  if (S.prompt) {
    panel(ctx, W / 2 - 150, H - 64, 300, 30, 8);
    ctx.fillStyle = 'rgba(10,16,22,0.78)';
    ctx.fill();
    label(ctx, S.prompt, W / 2, H - 43, 14, '#ffffff', 'center', 700);
  }

  if (S.dialogue) drawDialogue(ctx, S, W, H);

  // Crosshair, while she is on foot and the game is live.
  if (!P.inCar && S.screen === 'play') {
    const m = input.mouse;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(m.x - 1, m.y - 1, 2, 2);
  }

  // Pain: a red flash on the hit, a pulsing frame while she is dying.
  if (S.hurtFlash > 0) {
    ctx.fillStyle = `rgba(239,71,111,${0.22 * S.hurtFlash})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (P.hp < 28 && S.screen === 'play') {
    ctx.strokeStyle = `rgba(239,71,111,${0.25 + 0.2 * Math.sin(S.time * 5)})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(0, 0, W, H);
  }
}

/** The objective banner across the top centre, with timer and distance. */
function drawObjective(ctx, S, W) {
  const o = S.objective;
  if (!o) return;
  const P = S.player;
  const metres = Math.round(Math.hypot(o.x - P.x, o.y - P.y) / 10);
  ctx.save();
  ctx.globalAlpha = 0.88;
  panel(ctx, W / 2 - 265, 16, 530, o.timer != null ? 62 : 50, 10);
  ctx.fillStyle = '#0b1620';
  ctx.fill();
  ctx.restore();
  label(ctx, o.title.toUpperCase(), W / 2, 38, 12, '#ffd166', 'center', 800);
  label(ctx, o.text, W / 2, 58, 14.5, '#ffffff', 'center', 600);
  if (o.timer != null) {
    const total = Math.max(0, Math.ceil(o.timer));
    const clock = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
    label(ctx, `${clock} · ${metres}m`, W / 2, 74, 12.5, o.timer < 16 ? '#ef476f' : '#9fd8ff', 'center', 700);
  } else {
    label(ctx, `${metres}m`, W / 2, 74, 11.5, '#9fb6c3', 'center', 600);
  }
}

/** Short-lived notices stacked under the banner. */
function drawToasts(ctx, S, W) {
  let y = S.objective ? 96 : 30;
  for (const toast of S.toasts) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, toast.ttl) * 0.92;
    label(ctx, toast.text, W / 2, y, 14, '#ffe9a8', 'center', 700);
    ctx.restore();
    y += 20;
  }
}

/** The big centre announcement: MISSION PASSED, MISSION FAILED. */
function drawBanner(ctx, S, W, H) {
  const b = S.banner;
  if (!b) return;
  const alpha = Math.max(0, Math.min(1, b.t / 0.4, (b.dur - b.t) / 0.6));
  ctx.save();
  ctx.globalAlpha = alpha;
  label(ctx, b.title, W / 2, H * 0.3, 44, '#ffd166', 'center', 900);
  if (b.sub) label(ctx, b.sub, W / 2, H * 0.3 + 34, 17, '#ffffff', 'center', 600);
  ctx.restore();
}

/** The dialogue box: speaker, wrapped lines, and the advance hint. */
function drawDialogue(ctx, S, W, H) {
  const d = S.dialogue;
  const line = d.lines[d.i];
  const lines = wrapLine(ctx, line.text, 16.5, 660);
  const boxH = 58 + lines.length * 22;
  panel(ctx, W / 2 - 360, H - boxH - 18, 720, boxH, 10);
  ctx.fillStyle = 'rgba(8,14,20,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  label(ctx, line.who.toUpperCase(), W / 2 - 336, H - boxH + 12, 12.5, '#ffd166', 'left', 800);
  lines.forEach((text, i) => {
    label(ctx, text, W / 2 - 336, H - boxH + 38 + i * 22, 16.5, '#f4f8fb', 'left', 500);
  });
  label(ctx, 'E ▸', W / 2 + 330, H - 30, 12, '#9fb6c3', 'right', 700);
}

// --- the menus ---------------------------------------------------------------

/** The buttons a screen offers, as {id, label} pairs. main.js acts on them. */
export function menuItems(S) {
  switch (S.screen) {
    case 'title':
      return [
        ...(S.hasSave ? [{ id: 'continue', label: 'CONTINUE' }] : []),
        { id: 'new', label: 'NEW GAME' },
        { id: 'howto', label: 'HOW TO PLAY' },
        { id: 'mute', label: S.muted ? 'SOUND: OFF' : 'SOUND: ON' },
      ];
    case 'howto':
      return [{ id: 'back', label: 'BACK' }];
    case 'pause':
      return [
        { id: 'resume', label: 'RESUME' },
        { id: 'save', label: 'SAVE GAME' },
        { id: 'howto', label: 'HOW TO PLAY' },
        { id: 'mute', label: S.muted ? 'SOUND: OFF' : 'SOUND: ON' },
        { id: 'quit', label: 'QUIT TO TITLE' },
      ];
    case 'busted':
    case 'wasted':
      return [{ id: 'respawn', label: 'CARRY ON' }];
    case 'complete':
      return [{ id: 'freeroam', label: 'KEEP DRIVING — FREE ROAM' }];
    default:
      return [];
  }
}

/** The box a menu item is drawn in; clicks are tested against the same box. */
export function menuItemBox(W, H, index, count) {
  return {
    x: W / 2 - 150,
    y: H * 0.52 + index * 52 - (count > 4 ? 30 : 0),
    w: 300,
    h: 40,
  };
}

const HOWTO_TEXT = [
  'WASD / Arrows — walk and drive · Shift — sprint',
  'Mouse — aim · Click — shoot (on foot)',
  'F / E — enter and leave cars, talk, take work',
  'Space — handbrake · P / Esc — pause · M — mute',
  '',
  'Steal cars. Run Vera\'s story from the freight warehouse.',
  'Take side work at Café Palma, the SunSpray garage, the chop shop.',
  'Crime that is seen is heat earned, and stars bring the MBPD:',
  'lose their eyes and wait out the search, or pay for a respray.',
  'Busted costs a fine. Wasted costs the hospital. Both cost the job.',
];

/** The full-screen menus, drawn over a dimmed living city. */
export function drawMenus(ctx, S, W, H) {
  if (S.screen === 'play') return;
  ctx.fillStyle = 'rgba(6,12,20,0.55)';
  ctx.fillRect(0, 0, W, H);

  if (S.screen === 'title') drawTitleText(ctx, S, W, H);
  else if (S.screen === 'howto') {
    label(ctx, 'HOW TO PLAY', W / 2, H * 0.2, 34, '#ffd166', 'center', 900);
    HOWTO_TEXT.forEach((line, i) => {
      label(ctx, line, W / 2, H * 0.3 + i * 27, 16.5, '#eaf6fb', 'center', 500);
    });
  } else if (S.screen === 'pause') {
    label(ctx, 'PAUSED', W / 2, H * 0.3, 40, '#ffffff', 'center', 900);
    const stats = `$${S.player.cash.toLocaleString('en-US')} · Respect ${S.player.respect} · Story ${Math.min(S.storyIdx, 6)}/6`;
    label(ctx, stats, W / 2, H * 0.3 + 34, 15, '#b8d4e2', 'center', 500);
  } else if (S.screen === 'busted') {
    label(ctx, 'BUSTED', W / 2, H * 0.34, 64, '#4dabff', 'center', 900);
    label(ctx, 'The MBPD impound your wheels and fine you 10% of your cash.', W / 2, H * 0.34 + 40, 16, '#eaf6fb', 'center', 500);
  } else if (S.screen === 'wasted') {
    label(ctx, 'WASTED', W / 2, H * 0.34, 64, '#ef476f', 'center', 900);
    label(ctx, 'Marisol General patches you up and bills you 10% of your cash.', W / 2, H * 0.34 + 40, 16, '#eaf6fb', 'center', 500);
  } else if (S.screen === 'complete') {
    label(ctx, 'STORY COMPLETE', W / 2, H * 0.3, 46, '#ffd166', 'center', 900);
    label(ctx, 'Marisol Bay is Juno\'s now. The city stays open: side work, street races,', W / 2, H * 0.3 + 38, 16, '#eaf6fb', 'center', 500);
    label(ctx, 'and all the trouble you can buy. Your game is saved.', W / 2, H * 0.3 + 62, 16, '#eaf6fb', 'center', 500);
  }

  const items = menuItems(S);
  items.forEach((item, i) => {
    const box = menuItemBox(W, H, i, items.length);
    const m = input.mouse;
    const hover = m.x >= box.x && m.x <= box.x + box.w && m.y >= box.y && m.y <= box.y + box.h;
    panel(ctx, box.x, box.y, box.w, box.h, 9);
    ctx.fillStyle = hover ? 'rgba(255,209,102,0.92)' : 'rgba(10,20,30,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.65)';
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, item.label, W / 2, box.y + 27, 16, hover ? '#14232e' : '#f4f8fb', 'center', 800);
  });

  if (S.screen === 'title') {
    label(ctx, 'WASD drive & walk · mouse aim · F enter cars · a complete city: traffic, police, missions, combat',
      W / 2, H - 26, 12.5, '#8fb0c2', 'center', 500);
  }
}

/** The title screen's wordmark and straplines. */
function drawTitleText(ctx, S, W, H) {
  void S;
  const grad = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.55);
  grad.addColorStop(0, '#ffd166');
  grad.addColorStop(1, '#ef476f');
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = grad;
  ctx.fillText('MARISOL', W / 2, H * 0.3);
  ctx.fillText('HEATWAVE', W / 2, H * 0.3 + 82);
  label(ctx, 'An open-world crime story in the sun-soaked city of Marisol Bay',
    W / 2, H * 0.3 + 118, 16.5, '#eaf6fb', 'center', 500);
  label(ctx, 'Juno Marchetti is back in town. Vera Solano has work. The law has opinions.',
    W / 2, H * 0.3 + 142, 14, '#b8d4e2', 'center', 400);
}
