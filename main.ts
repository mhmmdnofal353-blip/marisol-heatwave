// Marisol Heatwave — the hand-in program for the gta6-01 bounty (Node 22,
// standard library only, nothing to install).
//
// What lives here: this file and nothing else at the root does the handing
// in. The game itself is the game/ folder — static files a desktop browser
// opens offline: an original open-world crime game (a seeded city, traffic
// and pedestrians, cars to steal, a wanted system with real pursuit, a
// six-mission story plus side work, mouse-aimed combat, a minimap HUD,
// menus, and a localStorage save), drawn on a 2D canvas with every sound
// synthesised in WebAudio.
//
// Running this copies game/ and screenshots/ into the output directory and
// writes dossier.json there, built by the kit's own library
// (vendor/makefun-game.ts, shipped byte for byte and never edited) — the
// document the make.fun gate checks and the judge reads.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Away from the grader, MAKEFUN_OUTPUT_DIR names the output directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoDir, 'screenshots');
if (existsSync(shotsDir)) cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The caps below are the sealed scorer's (the kit's reference/gate.json).
// text_max_bytes is the one that shapes the dossier's bytes; the rest make
// this program refuse, here and now, an entry the scorer would refuse
// anyway: over 4 screenshots or one past 256 KiB, a game/ past 993 entries
// or 48 MiB, or a single game/ path past 1000 bytes. /output as a whole is
// capped at 1000 entries and 64 MiB, shared by game/, screenshots/ and
// dossier.json, so the margins matter.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
