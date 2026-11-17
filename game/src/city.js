// Marisol Bay itself: a seeded grid city of avenues and streets with named
// districts, buildings, parks, car parks, a beach and the sea. buildCity lays
// it out once; the rest of the game asks it where the roads run, what stands
// in the way, and which ground a wheel or a shoe is on.

import { WORLD, ROADS, BEACH_X, WATER_X } from './config.js';
import { range, int, pick, chance } from './random.js';

const HALF = ROADS.width / 2;
const INSET = HALF + 18; // buildings start this far from a road centre

const HOTEL_NAMES = ['Hotel Azul', 'The Coral Crown', 'Palmera Grand', 'Hotel Brisa', 'Casa Del Mar'];
const SHOP_NAMES = ['Café Palma', 'Taco Brasa', 'Surf & Sun', 'Panadería Luna', 'Farmacia Mar', 'Gym Ola', 'Nauti Buoys', 'Laundromat Sol', 'Floristería Rosa', 'Bar El Faro'];
const OFFICE_NAMES = ['Banco del Sol', 'Marina Insurance', 'Sunport Freight', 'Solano Logistics', 'Bahía Legal', 'Onda Media'];

/** Which district a block belongs to, by its grid column and row. */
function districtOf(col, row) {
  if (col === 6 && row <= 2) return 'strip';
  if (col <= 2 && row <= 1) return 'heights';
  if (col <= 2 && row >= 3) return 'flats';
  if (col >= 3 && row >= 4) return 'docks';
  if (col === 6 && row >= 3) return 'marina';
  return 'downtown';
}

const PALETTES = {
  strip: ['#ff8fa3', '#ffb703', '#8ecae6', '#f4f1de', '#e07a5f', '#81b29a'],
  heights: ['#f6bd60', '#f7ede2', '#f5cac3', '#84a98c', '#e5989b'],
  flats: ['#9a8c98', '#6d6875', '#b5838d', '#7f7f7f'],
  docks: ['#6c757d', '#495057', '#7d8597', '#5e60ce'],
  marina: ['#caf0f8', '#ade8f4', '#90e0ef', '#f4f1de'],
  downtown: ['#e9c46a', '#f4a261', '#e76f51', '#2a9d8f', '#a8dadc', '#f1fa8c'],
};

/** A shuffled copy of a name list, so neighbouring buildings rarely share a name. */
function namePool(rng, names) {
  const pool = [...names];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { next: () => (pool.length ? pool.pop() : pick(rng, names)) };
}

/** Lay out the whole city from a seeded generator. */
export function buildCity(rng) {
  const hotelNames = namePool(rng, HOTEL_NAMES);
  const shopNames = namePool(rng, SHOP_NAMES);
  const officeNames = namePool(rng, OFFICE_NAMES);
  const city = {
    buildings: [],
    parks: [],
    lots: [],
    palms: [],
    trees: [],
    lamps: [],
    crates: [],
    umbrellas: [],
    blockers: [],
    parkedSpots: [],
    places: {},
    blocks: [],
  };
  const addBuilding = (b) => {
    city.buildings.push(b);
    city.blockers.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    return b;
  };
  const special = new Map(); // "col,row" -> place key
  const placeAt = (col, row, key) => special.set(`${col},${row}`, key);

  placeAt(3, 4, 'warehouse'); // Vera Solano's warehouse, Old Marina edge
  placeAt(4, 2, 'garage'); // SunSpray Respray, downtown
  placeAt(1, 3, 'garage'); // SunSpray Respray, the Flats
  placeAt(1, 0, 'safehouse'); // Juno's loft, Coral Heights
  placeAt(5, 1, 'hospital'); // Marisol General
  placeAt(3, 2, 'police'); // MBPD Headquarters
  placeAt(6, 1, 'cafe'); // Café Palma on the Strip
  placeAt(5, 5, 'chopshop'); // the docks chop shop

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 6; row++) {
      const x0 = ROADS.avenues[col] + INSET;
      const x1 = ROADS.avenues[col + 1] - INSET;
      const y0 = ROADS.streets[row] + INSET;
      const y1 = ROADS.streets[row + 1] - INSET;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, col, row, district: districtOf(col, row) };
      city.blocks.push(block);
      const key = special.get(`${col},${row}`);
      if (key) buildPlace(city, block, key, rng, addBuilding);
      else buildBlock(city, block, rng, addBuilding, { hotelNames, shopNames, officeNames });
    }
  }

  // Beach dressing: palms and umbrellas scattered on the sand.
  for (let i = 0; i < 46; i++) {
    city.palms.push({ x: range(rng, BEACH_X + 30, WATER_X - 60), y: range(rng, 60, WORLD.height - 60), s: range(rng, 0.8, 1.25) });
  }
  for (let i = 0; i < 26; i++) {
    city.umbrellas.push({ x: range(rng, BEACH_X + 60, WATER_X - 40), y: range(rng, 80, WORLD.height - 80), c: pick(rng, ['#ef476f', '#ffd166', '#06d6a0', '#118ab2']) });
  }
  // Palms down the Avenida del Sol median and along the beach road.
  for (let y = 140; y < WORLD.height; y += 150) {
    city.palms.push({ x: ROADS.avenues[3], y: y + range(rng, -16, 16), s: range(rng, 0.9, 1.15) });
  }
  // Street lamps at intersections.
  for (const ax of ROADS.avenues) for (const sy of ROADS.streets) {
    city.lamps.push({ x: ax - HALF - 6, y: sy - HALF - 6 });
    city.lamps.push({ x: ax + HALF + 6, y: sy + HALF + 6 });
  }
  return city;
}

/** Fill one ordinary block: buildings, a park, or a car park, by district. */
function buildBlock(city, block, rng, addBuilding, namePools) {
  const roll = rng();
  const palette = PALETTES[block.district];
  if (roll < 0.16) {
    // A park: grass, palms and shade trees, no blockers but the trunks are thin air.
    city.parks.push({ x: block.x, y: block.y, w: block.w, h: block.h });
    const n = int(rng, 5, 9);
    for (let i = 0; i < n; i++) {
      const t = { x: range(rng, block.x + 30, block.x + block.w - 30), y: range(rng, block.y + 30, block.y + block.h - 30), s: range(rng, 0.9, 1.4) };
      (chance(rng, 0.4) ? city.palms : city.trees).push(t);
    }
    return;
  }
  if (roll < 0.3) {
    // A car park: marked bays along both long edges, most of them filled.
    const lot = { x: block.x, y: block.y, w: block.w, h: block.h };
    city.lots.push(lot);
    for (let x = block.x + 34; x < block.x + block.w - 20; x += 52) {
      for (const y of [block.y + 26, block.y + block.h - 26]) {
        if (chance(rng, 0.72)) city.parkedSpots.push({ x, y, angle: Math.PI / 2 });
      }
    }
    return;
  }
  // Buildings: one slab, or a pair, or a 2x2 of smaller ones.
  const layout = rng();
  const cells = [];
  if (layout < 0.34) cells.push([0, 0, 1, 1]);
  else if (layout < 0.67) cells.push([0, 0, 0.52, 1], [0.56, 0, 0.44, 1]);
  else cells.push([0, 0, 0.48, 0.48], [0.52, 0, 0.48, 0.48], [0, 0.52, 0.48, 0.48], [0.52, 0.52, 0.48, 0.48]);
  for (const [fx, fy, fw, fh] of cells) {
    const pad = 12;
    const b = {
      x: block.x + fx * block.w + pad,
      y: block.y + fy * block.h + pad,
      w: fw * block.w - pad * 2,
      h: fh * block.h - pad * 2,
      floors: block.district === 'strip' ? int(rng, 8, 16) : block.district === 'downtown' ? int(rng, 4, 11) : block.district === 'flats' || block.district === 'docks' ? int(rng, 1, 2) : int(rng, 2, 6),
      color: pick(rng, palette),
      seed: int(rng, 1, 99999),
      name: null,
      district: block.district,
    };
    if (chance(rng, 0.34)) {
      b.name = block.district === 'strip' ? namePools.hotelNames.next() : chance(rng, 0.5) ? namePools.shopNames.next() : namePools.officeNames.next();
    }
    addBuilding(b);
  }
  // A tree or two on the block's corners.
  if (chance(rng, 0.6)) city.trees.push({ x: block.x + 14, y: block.y + 14, s: range(rng, 0.8, 1.1) });
}

/** Build one named place: a landmark building plus the marker point missions use. */
function buildPlace(city, block, key, rng, addBuilding) {
  const cx = block.x + block.w / 2;
  const cy = block.y + block.h / 2;
  const defs = {
    warehouse: { name: "Solano Freight Warehouse", color: '#5e60ce', floors: 2, place: { label: "Vera's Warehouse", icon: 'V' } },
    garage: { name: 'SunSpray Respray', color: '#06d6a0', floors: 1, place: { label: 'SunSpray Respray', icon: 'S' } },
    safehouse: { name: "Juno's Loft", color: '#f6bd60', floors: 5, place: { label: "Juno's Loft (Safehouse)", icon: 'H' } },
    hospital: { name: 'Marisol General Hospital', color: '#f8f9fa', floors: 6, place: { label: 'Marisol General', icon: '+' } },
    police: { name: 'MBPD Headquarters', color: '#3d5a80', floors: 5, place: { label: 'MBPD Headquarters', icon: 'P' } },
    cafe: { name: 'Café Palma', color: '#e07a5f', floors: 2, place: { label: 'Café Palma', icon: 'C' } },
    chopshop: { name: 'Docks Chop Shop', color: '#495057', floors: 1, place: { label: 'Chop Shop', icon: 'X' } },
  };
  const def = defs[key];
  const b = addBuilding({
    x: block.x + 30, y: block.y + 26, w: block.w - 60, h: block.h * 0.52,
    floors: def.floors, color: def.color, seed: int(rng, 1, 99999), name: def.name, district: block.district, place: key,
  });
  // The forecourt south of the building is open ground where the marker stands.
  const marker = { x: cx, y: block.y + block.h * 0.78 };
  const place = { key, label: def.place.label, icon: def.place.icon, x: marker.x, y: marker.y, building: b, block };
  if (key === 'garage') (city.places.garages ??= []).push(place);
  else city.places[key] = place;
  // Docks dressing: crates and containers around the working blocks.
  if (key === 'warehouse' || key === 'chopshop') {
    for (let i = 0; i < 7; i++) {
      const crate = { x: range(rng, block.x + 8, block.x + block.w - 46), y: range(rng, block.y + block.h * 0.6, block.y + block.h - 40), w: 38, h: 26, c: pick(rng, ['#bc6c25', '#606c38', '#283618', '#7f4f24']) };
      if (Math.abs(crate.x - marker.x) < 60 && Math.abs(crate.y - marker.y) < 60) continue;
      city.crates.push(crate);
      city.blockers.push(crate);
    }
  }
}

/** True when the point is on asphalt (a road or a car park). */
export function isRoad(city, x, y) {
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= HALF) return true;
  for (const sy of ROADS.streets) if (Math.abs(y - sy) <= HALF) return true;
  for (const lot of city.lots) if (x >= lot.x && x <= lot.x + lot.w && y >= lot.y && y <= lot.y + lot.h) return true;
  return false;
}

/** The ground under a point: 'road', 'sand', 'water', 'park' or 'concrete'. */
export function surfaceAt(city, x, y) {
  if (x >= WATER_X) return 'water';
  if (x >= BEACH_X) return 'sand';
  if (isRoad(city, x, y)) return 'road';
  for (const p of city.parks) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return 'park';
  return 'concrete';
}

/** Push a circle out of every building and crate; returns true if it hit anything. */
export function collideCircle(city, pos, r) {
  let hit = false;
  for (const b of city.blockers) {
    const nx = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nx;
    const dy = pos.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * r;
        pos.y = ny + (dy / d) * r;
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = pos.x - b.x;
        const right = b.x + b.w - pos.x;
        const top = pos.y - b.y;
        const bottom = b.y + b.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = b.x - r;
        else if (m === right) pos.x = b.x + b.w + r;
        else if (m === top) pos.y = b.y - r;
        else pos.y = b.y + b.h + r;
      }
    }
  }
  if (pos.x > WATER_X - r) { pos.x = WATER_X - r; hit = true; }
  if (pos.x < r) { pos.x = r; hit = true; }
  if (pos.y < r) { pos.y = r; hit = true; }
  if (pos.y > WORLD.height - r) { pos.y = WORLD.height - r; hit = true; }
  return hit;
}

/** A random point on a road, biased to fall in the ring around (cx, cy). */
export function roadPoint(rng, cx, cy, minD, maxD) {
  for (let tries = 0; tries < 24; tries++) {
    let x;
    let y;
    if (chance(rng, 0.5)) {
      x = pick(rng, ROADS.avenues) + range(rng, -HALF + 12, HALF - 12);
      y = range(rng, 40, WORLD.height - 40);
    } else {
      y = pick(rng, ROADS.streets) + range(rng, -HALF + 12, HALF - 12);
      x = range(rng, 40, BEACH_X - 40);
    }
    const d = Math.hypot(x - cx, y - cy);
    if (d >= minD && d <= maxD) return { x, y };
  }
  return { x: ROADS.avenues[2], y: ROADS.streets[2] };
}

/** The nearest road centre line to a point: {avenue} or {street} with distance. */
export function nearestRoad(x, y) {
  let best = { kind: 'avenue', at: ROADS.avenues[0], dist: Infinity };
  for (const ax of ROADS.avenues) {
    const d = Math.abs(x - ax);
    if (d < best.dist) best = { kind: 'avenue', at: ax, dist: d };
  }
  for (const sy of ROADS.streets) {
    const d = Math.abs(y - sy);
    if (d < best.dist) best = { kind: 'street', at: sy, dist: d };
  }
  return best;
}
