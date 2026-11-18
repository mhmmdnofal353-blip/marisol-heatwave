# marisol-heatwave

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mhmmdnofal353-blip/marisol-heatwave/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mhmmdnofal353-blip/marisol-heatwave/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Marisol Heatwave** is an open-world crime game that runs in the browser,
built from scratch in vanilla JavaScript — no engine, no image or audio
assets. The city is drawn on a 2D canvas at golden hour and every sound,
from the engine note to the police siren, is synthesised live with
WebAudio.

Welcome to Marisol Bay: seven districts of seeded streets, from the pastel
blocks of Coral Heights to the Sunport docks and the sand of Bahía Beach.
You are Juno Marchetti, back in town and broke. Fixer Vera Solano has work —
a six-mission story of deliveries, a daylight car theft, a family rescue
run under a locked three-star hunt, a shootout with the Glass Serpents, the
Avenida Kings checkpoint race, and an armored-van finale — plus repeatable
courier, fare, and chop-shop jobs, the Shore Run street race against two
Kings regulars down the shore road and back, and a standing hunt: twenty-
four of Vera's lost parcels glow on open ground across all seven
districts, each one banking cash and respect, every sixth paying a
finder's bonus, and the full set paying a sweep bonus.

The city lives around you: traffic that follows lanes, turns, brakes, and
honks; pedestrians who stroll the sidewalks and run from trouble, some in
straw sun hats, some wandering down onto the sand past the towels and
umbrellas; ten drivable car types, any of them stealable, each with its
own handling, damage model, and drift — including the Dune Raider, a
roll-caged buggy that holds its speed on the beach, where ordinary cars
bog down and throw rooster tails of dust. The light drifts as you play:
shadows lengthen toward dusk, the wash deepens, and the street lamps come
on. Crime the city witnesses becomes heat. One to five wanted stars bring
MBPD pursuit drivers who steer to intercept — further ahead of you the
hotter the hunt runs — officers on foot, a filling BUSTED meter, and
roadblocks that come thick and fast at five stars: lose their eyes, wait
out the search, or buy a SunSpray respray and drive out clean in a
different colour. Fight on foot with mouse-aimed pistol combat, follow
the minimap blips (the mint pips are parcels still out there) and the
objective banner, earn cash and respect, and rest at Juno's loft to heal
and save.

Controls: WASD or arrows to walk and drive, mouse to aim, click to shoot,
scroll to trim the camera zoom, F or E to enter cars and take work, Space
for the handbrake, H to honk, Shift to sprint, P or Esc to pause, M to
mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

The playable game is the static `game/` folder — serve it with any static
file server and open `game/index.html`; it needs no network and no build
step. `node main.ts` is the hand-in program: it copies `game/` and
`screenshots/` to the output directory (`MAKEFUN_OUTPUT_DIR` outside the
grader) and writes the `dossier.json` the make.fun judge reads. The
screenshots are deterministic staged scenes (`game/src/shots.js`, listed in
`shots.json`) captured from the running game with
`node take-screenshots.mjs`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=h7qfy6r1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
