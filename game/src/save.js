// save.js — the saved game. One slot in localStorage holding Juno's cash,
// respect, story progress, last position, and the hidden parcels she has
// already banked. Written when she rests at the
// loft, after every mission, and from the pause menu; read at boot for the
// title screen's Continue button. Every access is guarded: a browser that
// refuses storage simply plays without saving.

import { SAVE_KEY } from './config.js';

/** The parsed save, or null when there is none worth trusting. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // A hand-edited or half-written save can carry NaN or a string where
    // the purse should be; only a finite cash figure is worth trusting.
    const usable = typeof data === 'object' && data !== null && Number.isFinite(data.cash);
    return usable ? data : null;
  } catch {
    return null;
  }
}

/** Persist a save object. Failures (private mode, quota) are silent. */
export function storeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* the game goes on unsaved */
  }
}

/** Remove the save entirely. */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to remove */
  }
}

/** True when a readable save exists. */
export function hasSave() {
  return loadSave() !== null;
}

/** The slice of the live state worth keeping between visits. */
export function snapshotOf(S) {
  return {
    v: 1, // save format version, so a future shape can be told apart
    cash: S.player.cash,
    respect: S.player.respect,
    storyIdx: S.storyIdx,
    sideDone: S.sideDone,
    stashIds: S.city.stashes.filter((s) => s.taken).map((s) => s.id),
    x: Math.round(S.player.x),
    y: Math.round(S.player.y),
    when: Date.now(),
  };
}
