# Azure Bay — a GTA-style open world

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/funtoons/gta6-01-bot-r4-v5/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/funtoons/gta6-01-bot-r4-v5/reward.svg)](https://make.fun/bounty/gta6-01)

**Azure Bay** is a top-down, GTA-style open-world crime game. Nico Reyes,
an ex-getaway driver, owes loan shark Big Eddie $50,000. Fixer Carmen Vega
has six jobs that can clear the debt — if the Vipers crew and the Azure PD
don't get to him first.

## The city

A 3200×2400 golden-hour coastal city with a full road grid: eight avenues,
eight streets, intersections with working traffic lights and crosswalks, six
districts with their own palettes (Neon Mile, Marina Bay, Palm Court, The
Yards, Sunnyside, Bayside), plus a beach and a marina on the east edge.
Buildings have pseudo-height roofs, side faces, long evening shadows, lit
and unlit windows, and original signage.

## Systems

- **On foot and driving** — six car types (sedan, coupe, muscle, van, taxi,
  police, truck), each with its own handling, plus the player's two-tone
  teal Azul GT (plate AZR-01).
- **Living traffic** — cars follow the road graph, stop at red lights, turn
  at intersections, and avoid collisions.
- **Crowds** — dozens of pedestrians walk the sidewalks, cross at
  crosswalks, chat in speech bubbles, and flee gunfire.
- **Steal cars, wanted 1–5** — Azure PD pursues, rams, sets roadblocks at
  4 stars, and sends a helicopter with a spotlight at 3+ stars. Foot cops
  can bust a slow on-foot player; break line of sight to lose the heat.
- **Six story missions + ending** — from "Back in Town" to the "Payday"
  cash-truck hijack. Clear the $50,000 debt to see the ending.
- **Combat** — fists, pistol, SMG, shotgun; the Vipers fight back.
- **Side work** — taxi fares, vigilante patrols in a police car, 20 hidden
  packages, 3 checkpoint races, respray shops that clear wanted, a gun shop.
- **Save + Continue** (localStorage), a WebAudio synth radio with 3
  stations, a round minimap, and a dense HUD: mission panel, five-unit
  police dispatch, money, wanted stars, clock, health/armour, dialog
  portraits, speedometer, weapon slots.

## Play

Serve `game/` statically (for example `node serve.ts`) and open
`http://localhost:8080`. WASD to move and drive, E to enter a car, mouse to
aim, click to shoot, 1–4 to switch weapons, M for the map, P to pause,
Q for the radio.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` into the output directory and writes `dossier.json` with the
vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The game is fully deterministic and offline: a seeded LCG drives every
random choice, there are no network requests, and two runs of the same
seeded shot render byte-identical screenshots.

## License

MIT — see [LICENSE](LICENSE).
