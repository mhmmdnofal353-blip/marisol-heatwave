// city.js — Marisol Bay itself. buildCity grows the whole city from a seed:
// a grid of blocks between the avenues and streets, each block a stand of
// buildings, a park, or a car park, with eight named places (Vera's
// warehouse, the respray garages, Juno's loft, the hospital, MBPD HQ, Café
// Palma, the chop shop) set into fixed blocks. East of the last avenue the
// city gives out to beach and sea. The other modules ask this file where
// roads run, what ground a point stands on, and what a moving circle hits.

import { WORLD, ROADS, BEACH_X, WATER_X } from './config.js';
import { range, int, pick, chance } from './random.js';

const HALF_ROAD = ROADS.width / 2;
const BLOCK_INSET = HALF_ROAD + 18; // building line: this far from a road centre

const HOTEL_NAMES = ['Hotel Azul', 'The Coral Crown', 'Palmera Grand', 'Hotel Brisa', 'Casa Del Mar'];
const SHOP_NAMES = ['Café Palma', 'Taco Brasa', 'Surf & Sun', 'Panadería Luna', 'Farmacia Mar', 'Gym Ola', 'Nauti Buoys', 'Laundromat Sol', 'Floristería Rosa', 'Bar El Faro'];
const OFFICE_NAMES = ['Banco del Sol', 'Marina Insurance', 'Sunport Freight', 'Solano Logistics', 'Bahía Legal', 'Onda Media'];

/** Roof colours by district, warmest on the Strip, greyest at the docks. */
const PALETTES = {
  heights: ['#f6bd60', '#f7ede2', '#f5cac3', '#84a98c', '#e5989b'],
  strip: ['#ff8fa3', '#ffb703', '#8ecae6', '#f4f1de', '#e07a5f', '#81b29a'],
  downtown: ['#e9c46a', '#f4a261', '#e76f51', '#2a9d8f', '#a8dadc', '#f1fa8c'],
  flats: ['#9a8c98', '#6d6875', '#b5838d', '#7f7f7f'],
  docks: ['#6c757d', '#495057', '#7d8597', '#5e60ce'],
  marina: ['#caf0f8', '#ade8f4', '#90e0ef', '#f4f1de'],
};

/** The district a block belongs to, from its grid column and row. */
function districtOf(col, row) {
  if (col === 6 && row <= 2) return 'strip';
  if (col <= 2 && row <= 1) return 'heights';
  if (col <= 2 && row >= 3) return 'flats';
  if (col >= 3 && row >= 4) return 'docks';
  if (col === 6 && row >= 3) return 'marina';
  return 'downtown';
}

/** A name source that hands out each name once before repeating any. */
function shuffledNames(rng, names) {
  const bag = [...names];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return { next: () => (bag.length > 0 ? bag.pop() : pick(rng, names)) };
}

/** Grow the whole city. Deterministic in the seed. */
export function buildCity(rng) {
  const hotels = shuffledNames(rng, HOTEL_NAMES);
  const shops = shuffledNames(rng, SHOP_NAMES);
  const offices = shuffledNames(rng, OFFICE_NAMES);
  const city = {
    buildings: [], parks: [], lots: [], palms: [], trees: [], lamps: [],
    crates: [], umbrellas: [], blockers: [], parkedSpots: [], places: {}, blocks: [],
  };
  const addBuilding = (b) => {
    city.buildings.push(b);
    city.blockers.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    return b;
  };

  // The named places sit in fixed blocks so the story always knows its map.
  const placeBlocks = new Map([
    ['3,4', 'warehouse'], // Vera Solano's freight warehouse, Old Marina edge
    ['4,2', 'garage'], // SunSpray Respray, downtown
    ['1,3', 'garage'], // SunSpray Respray, the Flats
    ['1,0', 'safehouse'], // Juno's loft, Coral Heights
    ['5,1', 'hospital'], // Marisol General
    ['3,2', 'police'], // MBPD Headquarters
    ['6,1', 'cafe'], // Café Palma on the Strip
    ['5,5', 'chopshop'], // the docks chop shop
  ]);

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 6; row++) {
      const block = {
        x: ROADS.avenues[col] + BLOCK_INSET,
        y: ROADS.streets[row] + BLOCK_INSET,
        w: ROADS.avenues[col + 1] - ROADS.avenues[col] - BLOCK_INSET * 2,
        h: ROADS.streets[row + 1] - ROADS.streets[row] - BLOCK_INSET * 2,
        col, row,
        district: districtOf(col, row),
      };
      city.blocks.push(block);
      const key = placeBlocks.get(`${col},${row}`);
      if (key) buildPlace(city, block, key, rng, addBuilding);
      else if (col === 5 && row === 4) buildLot(city, block, rng); // the Sunport dockyard: open ground for pickups
      else buildBlock(city, block, rng, addBuilding, { hotels, shops, offices });
    }
  }

  // Beach dressing: palms and umbrellas scattered over the sand.
  for (let i = 0; i < 46; i++) {
    city.palms.push({ x: range(rng, BEACH_X + 30, WATER_X - 60), y: range(rng, 60, WORLD.height - 60), s: range(rng, 0.8, 1.25) });
  }
  for (let i = 0; i < 26; i++) {
    city.umbrellas.push({ x: range(rng, BEACH_X + 60, WATER_X - 40), y: range(rng, 80, WORLD.height - 80), c: pick(rng, ['#ef476f', '#ffd166', '#06d6a0', '#118ab2']) });
  }
  // A palm row down the Avenida del Sol median.
  for (let y = 140; y < WORLD.height; y += 150) {
    city.palms.push({ x: ROADS.avenues[3], y: y + range(rng, -16, 16), s: range(rng, 0.9, 1.15) });
  }
  // Street lamps on the corners of every intersection.
  for (const ax of ROADS.avenues) {
    for (const sy of ROADS.streets) {
      city.lamps.push({ x: ax - HALF_ROAD - 6, y: sy - HALF_ROAD - 6 });
      city.lamps.push({ x: ax + HALF_ROAD + 6, y: sy + HALF_ROAD + 6 });
    }
  }
  return city;
}

/** Fill an ordinary block: a park, a car park, or buildings, by the roll. */
function buildBlock(city, block, rng, addBuilding, names) {
  const roll = rng();
  if (roll < 0.16) {
    // A park: open grass with shade trees and palms; nothing blocks a walk.
    city.parks.push({ x: block.x, y: block.y, w: block.w, h: block.h });
    const count = int(rng, 5, 9);
    for (let i = 0; i < count; i++) {
      const tree = {
        x: range(rng, block.x + 30, block.x + block.w - 30),
        y: range(rng, block.y + 30, block.y + block.h - 30),
        s: range(rng, 0.9, 1.4),
      };
      if (chance(rng, 0.4)) city.palms.push(tree);
      else city.trees.push(tree);
    }
    return;
  }
  if (roll < 0.30) {
    buildLot(city, block, rng);
    return;
  }
  // Buildings: one slab, a pair of slabs, or four smaller footprints.
  const layout = rng();
  const cells = layout < 0.34
    ? [[0, 0, 1, 1]]
    : layout < 0.67
      ? [[0, 0, 0.52, 1], [0.56, 0, 0.44, 1]]
      : [[0, 0, 0.48, 0.48], [0.52, 0, 0.48, 0.48], [0, 0.52, 0.48, 0.48], [0.52, 0.52, 0.48, 0.48]];
  const palette = PALETTES[block.district];
  for (const [fx, fy, fw, fh] of cells) {
    const pad = 12;
    const b = {
      x: block.x + fx * block.w + pad,
      y: block.y + fy * block.h + pad,
      w: fw * block.w - pad * 2,
      h: fh * block.h - pad * 2,
      floors: floorsFor(block.district, rng),
      color: pick(rng, palette),
      seed: int(rng, 1, 99999),
      name: null,
      district: block.district,
    };
    if (chance(rng, 0.34)) {
      b.name = block.district === 'strip'
        ? names.hotels.next()
        : chance(rng, 0.5) ? names.shops.next() : names.offices.next();
    }
    addBuilding(b);
  }
  if (chance(rng, 0.6)) {
    city.trees.push({ x: block.x + 14, y: block.y + 14, s: range(rng, 0.8, 1.1) });
  }
}

/** A car park: bays along both long edges, most of them holding a car. */
function buildLot(city, block, rng) {
  city.lots.push({ x: block.x, y: block.y, w: block.w, h: block.h });
  for (let x = block.x + 34; x < block.x + block.w - 20; x += 52) {
    for (const y of [block.y + 26, block.y + block.h - 26]) {
      if (chance(rng, 0.72)) city.parkedSpots.push({ x, y, angle: Math.PI / 2 });
    }
  }
}

/** Storey counts by district: towers on the Strip, sheds at the docks. */
function floorsFor(district, rng) {
  if (district === 'strip') return int(rng, 8, 16);
  if (district === 'downtown') return int(rng, 4, 11);
  if (district === 'flats' || district === 'docks') return int(rng, 1, 2);
  return int(rng, 2, 6);
}

/** What each named place looks like and how the map labels it. */
const PLACE_DEFS = {
  warehouse: { name: 'Solano Freight Warehouse', color: '#5e60ce', floors: 2, label: "Vera's Warehouse", icon: 'V' },
  garage: { name: 'SunSpray Respray', color: '#06d6a0', floors: 1, label: 'SunSpray Respray', icon: 'S' },
  safehouse: { name: "Juno's Loft", color: '#f6bd60', floors: 5, label: "Juno's Loft (Safehouse)", icon: 'H' },
  hospital: { name: 'Marisol General Hospital', color: '#f8f9fa', floors: 6, label: 'Marisol General', icon: '+' },
  police: { name: 'MBPD Headquarters', color: '#3d5a80', floors: 5, label: 'MBPD Headquarters', icon: 'P' },
  cafe: { name: 'Café Palma', color: '#e07a5f', floors: 2, label: 'Café Palma', icon: 'C' },
  chopshop: { name: 'Docks Chop Shop', color: '#495057', floors: 1, label: 'Chop Shop', icon: 'X' },
};

/** Build a named place: its landmark building and the marker missions use. */
function buildPlace(city, block, key, rng, addBuilding) {
  const def = PLACE_DEFS[key];
  const building = addBuilding({
    x: block.x + 30,
    y: block.y + 26,
    w: block.w - 60,
    h: block.h * 0.52,
    floors: def.floors,
    color: def.color,
    seed: int(rng, 1, 99999),
    name: def.name,
    district: block.district,
    place: key,
  });
  // The forecourt south of the building stays open: the marker stands there.
  const place = {
    key,
    label: def.label,
    icon: def.icon,
    x: block.x + block.w / 2,
    y: block.y + block.h * 0.78,
    building,
    block,
  };
  if (key === 'garage') {
    if (!city.places.garages) city.places.garages = [];
    city.places.garages.push(place);
  } else {
    city.places[key] = place;
  }
  // Working yards get crates and containers, kept clear of the marker.
  if (key === 'warehouse' || key === 'chopshop') {
    for (let i = 0; i < 7; i++) {
      const crate = {
        x: range(rng, block.x + 8, block.x + block.w - 46),
        y: range(rng, block.y + block.h * 0.6, block.y + block.h - 40),
        w: 38, h: 26,
        c: pick(rng, ['#bc6c25', '#606c38', '#283618', '#7f4f24']),
      };
      if (Math.abs(crate.x - place.x) < 60 && Math.abs(crate.y - place.y) < 60) continue;
      city.crates.push(crate);
      city.blockers.push(crate);
    }
  }
}

/** True when a point is on asphalt: a road or a car park. */
export function isRoad(city, x, y) {
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= HALF_ROAD) return true;
  for (const sy of ROADS.streets) if (Math.abs(y - sy) <= HALF_ROAD) return true;
  for (const lot of city.lots) {
    if (x >= lot.x && x <= lot.x + lot.w && y >= lot.y && y <= lot.y + lot.h) return true;
  }
  return false;
}

/** The ground under a point: 'water', 'sand', 'road', 'park' or 'concrete'. */
export function surfaceAt(city, x, y) {
  if (x >= WATER_X) return 'water';
  if (x >= BEACH_X) return 'sand';
  if (isRoad(city, x, y)) return 'road';
  for (const park of city.parks) {
    if (x >= park.x && x <= park.x + park.w && y >= park.y && y <= park.y + park.h) return 'park';
  }
  return 'concrete';
}

/**
 * Push a circle (mutated in place) out of every building and crate, and
 * keep it inside the world and out of the sea. Returns true on any hit.
 */
export function collideCircle(city, pos, r) {
  let hit = false;
  for (const b of city.blockers) {
    const nearX = Math.max(b.x, Math.min(pos.x, b.x + b.w));
    const nearY = Math.max(b.y, Math.min(pos.y, b.y + b.h));
    const dx = pos.x - nearX;
    const dy = pos.y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= r * r) continue;
    hit = true;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      pos.x = nearX + (dx / dist) * r;
      pos.y = nearY + (dy / dist) * r;
    } else {
      // The centre is inside the box: leave by whichever face is nearest.
      const exits = [
        { d: pos.x - b.x, apply: () => { pos.x = b.x - r; } },
        { d: b.x + b.w - pos.x, apply: () => { pos.x = b.x + b.w + r; } },
        { d: pos.y - b.y, apply: () => { pos.y = b.y - r; } },
        { d: b.y + b.h - pos.y, apply: () => { pos.y = b.y + b.h + r; } },
      ];
      exits.sort((a, z) => a.d - z.d);
      exits[0].apply();
    }
  }
  if (pos.x > WATER_X - r) { pos.x = WATER_X - r; hit = true; }
  if (pos.x < r) { pos.x = r; hit = true; }
  if (pos.y < r) { pos.y = r; hit = true; }
  if (pos.y > WORLD.height - r) { pos.y = WORLD.height - r; hit = true; }
  return hit;
}

/** A random point on a road, in the ring between minD and maxD of (cx, cy). */
export function roadPoint(rng, cx, cy, minD, maxD) {
  for (let tries = 0; tries < 24; tries++) {
    let x;
    let y;
    if (chance(rng, 0.5)) {
      x = pick(rng, ROADS.avenues) + range(rng, -HALF_ROAD + 12, HALF_ROAD - 12);
      y = range(rng, 40, WORLD.height - 40);
    } else {
      y = pick(rng, ROADS.streets) + range(rng, -HALF_ROAD + 12, HALF_ROAD - 12);
      x = range(rng, 40, BEACH_X - 40);
    }
    const d = Math.hypot(x - cx, y - cy);
    if (d >= minD && d <= maxD) return { x, y };
  }
  return { x: ROADS.avenues[2], y: ROADS.streets[2] };
}

/** The closest road centre line to a point: {kind, at, dist}. */
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
