// config.js — the numbers Marisol Heatwave is tuned by: the size of the
// world, the road grid, the price of crime, the strength of the law, and
// the car catalogue. Pure data; every other module reads from here and
// nothing in this file runs.

/** The world in pixels. West is grass and suburbs, east is sand and sea. */
export const WORLD = { width: 5120, height: 3840 };

/**
 * The road grid. Avenues run north–south, streets east–west; `width` is the
 * full asphalt width, `lane` the offset of a driving lane from a centre
 * line, and `walk` how far from a centre line the sidewalk strollers walk.
 */
export const ROADS = {
  avenues: [320, 880, 1440, 2000, 2560, 3120, 3680, 4240],
  streets: [300, 840, 1380, 1920, 2460, 3000, 3540],
  width: 88,
  lane: 22,
  walk: 58,
};

/** The beach starts at BEACH_X; open water at WATER_X. */
export const BEACH_X = 4560;
export const WATER_X = 4820;

/** Heat points needed to hold each wanted star (index 0..5). */
export const HEAT_PER_STAR = [0, 1, 26, 52, 84, 122];

/** What a witnessed crime adds to the heat total. */
export const CRIME = {
  carjack: 26,
  hitPed: 30,
  killPed: 65,
  hitPolice: 42,
  hitCar: 8,
  shotFired: 12,
  explosion: 55,
  missionFelony: 40,
};

/** Pursuit cars the MBPD fields at each wanted level (index 0..5). */
export const POLICE_COUNT = [0, 2, 3, 4, 6, 8];

/**
 * The hidden parcels: glowing drops Vera's runners lost all over the bay.
 * `count` are scattered on open ground; each banks cash and respect, every
 * sixth pays a finder bonus, and the full set pays the sweep bonus.
 */
export const STASH = { count: 24, cash: 75, respect: 2, setBonus: 250, allBonus: 1000 };

/**
 * The car catalogue. len/wid are body pixels; top is top speed in px/s,
 * accel in px/s^2, grip the steering authority, hp the damage a body takes
 * before it burns. `colours` are the liveries a model is seen in, and the
 * optional `sand` is the share of top speed a type keeps on the beach —
 * the Dune Raider was built for the sand, and the MBPD's interceptors are
 * shod well enough to follow her onto it.
 */
export const CAR_TYPES = {
  compact: { label: 'Pico Compact', len: 34, wid: 17, top: 265, accel: 300, grip: 7.5, hp: 70, colours: ['#c94f42', '#4f7ec9', '#57a773', '#d9a441', '#8d99ae'] },
  sedan: { label: 'Meridian Sedan', len: 40, wid: 18, top: 300, accel: 320, grip: 7.0, hp: 90, colours: ['#3d5a80', '#98c1d9', '#606c76', '#7d8597', '#293241'] },
  taxi: { label: 'Sol Cab', len: 40, wid: 18, top: 295, accel: 315, grip: 7.0, hp: 90, colours: ['#f2b705'] },
  coupe: { label: 'Vireo Coupe', len: 40, wid: 18, top: 345, accel: 390, grip: 7.8, hp: 85, colours: ['#e07a5f', '#3d405b', '#81b29a', '#f2cc8f'] },
  sports: { label: 'Katana GT', len: 42, wid: 19, top: 405, accel: 470, grip: 8.4, hp: 80, colours: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5'] },
  buggy: { label: 'Dune Raider', len: 36, wid: 19, top: 330, accel: 430, grip: 8.6, hp: 75, sand: 0.85, colours: ['#ffb703', '#06d6a0', '#ef476f', '#f4f1de'] },
  suv: { label: 'Bastion SUV', len: 44, wid: 21, top: 285, accel: 300, grip: 6.4, hp: 130, colours: ['#22223b', '#4a4e69', '#9a8c98', '#c9ada7'] },
  van: { label: 'Hauler Van', len: 46, wid: 21, top: 255, accel: 260, grip: 6.0, hp: 140, colours: ['#e8e9eb', '#b8b8bd', '#5e60ce'] },
  armored: { label: 'Brinks Armored Van', len: 48, wid: 22, top: 270, accel: 270, grip: 6.2, hp: 260, colours: ['#5b6770'] },
  police: { label: 'MBPD Interceptor', len: 42, wid: 19, top: 385, accel: 440, grip: 8.2, hp: 150, sand: 0.62, colours: ['#f4f6f8'] },
};

/** The wardrobe pedestrians are drawn from. */
export const PED_SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#e0aaff', '#90be6d', '#f9c74f', '#43aa8b', '#577590', '#f28482', '#fdf0d5'];
export const PED_SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

/** Where the saved game lives in localStorage. */
export const SAVE_KEY = 'marisol-heatwave-save-v1';
