// The Onyx Ledger — a top-down stealth heist game (Node 22, standard library only).
// This program hands the entry in: it copies the playable game (game/, plain static
// files a desktop browser loads offline — index.html and its ES modules, no library
// and no network request) and the maker's screenshots (screenshots/, the first by
// name is the cover) from beside this file to /output, then writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library (vendor/makefun-game.ts, the kit's copy, unchanged).
// The game itself: a thief crosses a museum room at midnight, slipping past three
// patrolling guards with vision cones and two sweeping CCTV cameras, lifting the
// Onyx Ledger and the side loot while the alarm meter stays low, then reaching the
// emergency exit. Serve it locally with `node serve.ts`, then open
// http://localhost:8080. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// One line on stdout so a local run shows what was handed in; the files in
// /output themselves are byte for byte what the dossier builder wrote.
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`onyx-ledger: game/ + screenshots/ copied to ${out}, dossier.json ${dossierBytes} bytes`);
