# 3D Asteroids

A 3D Asteroids game built with [Babylon.js](https://www.babylonjs.com/) — entirely created through human + AI collaboration using the Engineering Journey System with sub-agents.

This game serves as a fun, playable proof that EJS works with multi-agent workflows. The whole game was designed, coded, and iterated on through agent collaboration, demonstrating the kind of creative work EJS can capture.

## How to Run

The game is a single HTML file with all dependencies included — no build step, no install, no internet required.

**Just open `index.html` in your browser.**

> Babylon.js v8.50.2 (Apache-2.0) is bundled as `babylon.local.js` and `babylon.gui.local.js`.

## Controls

| Key | Action |
|---|---|
| `W` / `↑` | Thrust forward |
| `S` / `↓` | Brake / reverse thrust |
| `A` / `←` | Rotate left |
| `D` / `→` | Rotate right |
| `Space` | Fire |
| `R` | Restart (when game over) |

## Gameplay

- Destroy asteroids to earn points. Large asteroids split into medium ones, which split into small ones.
- Clear all asteroids to advance to the next wave — each wave spawns more asteroids.
- You start with 3 lives. Colliding with an asteroid costs a life and gives you brief invulnerability.
- The ship wraps around the arena edges, as do asteroids.

## Scoring

| Asteroid Size | Points |
|---|---|
| Large | 20 |
| Medium | 50 |
| Small | 100 |
