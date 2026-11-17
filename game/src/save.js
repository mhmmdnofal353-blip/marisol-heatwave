// The saved game: cash, respect, story progress and where Juno stood, kept
// in localStorage between visits. One slot, written at the safehouse, after
// every mission, and whenever the game is paused.

import { SAVE_KEY } from './config.js';

/** The saved game object, or null when there is none (or it is unreadable). */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

/** Write the saved game. */
export function storeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* private mode and full disks lose saves quietly */
  }
}

/** Forget the saved game (a new game overwrites it anyway). */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** Whether a saved game exists for the title screen's Continue button. */
export function hasSave() {
  return loadSave() !== null;
}

/** Snapshot the parts of the state worth keeping. */
export function snapshotOf(S) {
  return {
    cash: S.player.cash,
    respect: S.player.respect,
    storyIdx: S.storyIdx,
    sideDone: S.sideDone,
    x: Math.round(S.player.x),
    y: Math.round(S.player.y),
    when: Date.now(),
  };
}
