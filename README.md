# marisol-heatwave

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mhmmdnofal353-blip/marisol-heatwave/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mhmmdnofal353-blip/marisol-heatwave/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Marisol Heatwave is an original open-world crime game for the browser, written in
plain JavaScript with no engine and no assets: the whole city is drawn in code on a
2D canvas and every sound is synthesised with WebAudio. Explore the sun-soaked
city of Marisol Bay on foot and by car — seven districts from Coral Heights to the
Sunport docks and Bahía Beach — with living traffic, pedestrians, and cars you can
steal and drive, from a Pico Compact to the Katana GT. Crime that gets witnessed
earns heat: the MBPD answers with pursuit drivers, officers on foot, roadblocks
and a BUSTED meter, and you shake them by losing their eyes or paying SunSpray
Respray for fresh paint. Fixer Vera Solano runs a six-mission story out of her
freight warehouse — deliveries, a daylight car theft, a family rescue under a
locked three-star hunt, a shootout with the Glass Serpents, the Avenida Kings
checkpoint race, and the Heatwave finale — with repeatable courier, fare and
chop-shop work after. Fight on foot with mouse-aimed pistol combat, follow the
minimap and objective markers, and rest at Juno's loft to heal and save.

Controls: WASD/arrows to walk and drive, mouse to aim, click to shoot, F/E to
enter cars and take work, Space handbrake, Shift sprint, P/Esc pause, M mute.

## Run it

```sh
node serve.ts
# then open http://localhost:8080 in a desktop browser
```

The game is the static `game/` folder: serve it with any static file server and open
`game/index.html`. `node main.ts` (with `MAKEFUN_OUTPUT_DIR` set outside the grader)
copies the game and its screenshots to the output directory and writes the
`dossier.json` the make.fun judge reads. Screenshots are staged, deterministic
scenes (`game/src/shots.js`) captured with `node take-screenshots.mjs`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=h7qfy6r1&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
