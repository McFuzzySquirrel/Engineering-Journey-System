# 3D Asteroids

A 3D Asteroids game built with [Babylon.js](https://www.babylonjs.com/) — entirely created through human + AI collaboration using the Engineering Journey System with sub-agents.

This game serves as a fun, playable proof that EJS works with multi-agent workflows. The whole game was designed, coded, and iterated on through agent collaboration, demonstrating the kind of creative work EJS can capture.

## How to Run

The game is a single HTML file (`index.html`) with no build step required. You just need to serve it with the Babylon.js dependencies available.

### Option 1: Use CDN (quickest)

1. Open `index.html` in a text editor.
2. Replace the two local script tags:
   ```html
   <script src="babylon.local.js"></script>
   <script src="babylon.gui.local.js"></script>
   ```
   with the CDN versions:
   ```html
   <script src="https://cdn.babylonjs.com/babylon.js"></script>
   <script src="https://cdn.babylonjs.com/gui/babylon.gui.min.js"></script>
   ```
3. Open `index.html` in your browser.

### Option 2: Download Babylon.js locally

1. Download the Babylon.js files into the `game/` folder:
   - [babylon.js](https://cdn.babylonjs.com/babylon.js) → save as `babylon.local.js`
   - [babylon.gui.min.js](https://cdn.babylonjs.com/gui/babylon.gui.min.js) → save as `babylon.gui.local.js`
2. Open `index.html` in your browser.

> **Note:** The local files (`babylon.local.js` and `babylon.gui.local.js`) are listed in `.gitignore` so they won't be committed to the repository.

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
