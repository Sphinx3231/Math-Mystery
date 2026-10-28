# Math Club Announces Its New Surprise

A scroll-driven 3D treasure-map website for the Math Club puzzle hunt.

An aged parchment map peels away into a living 3D island (beach, waterfall, jungle temple,
desert of primes, rope bridge, cave). Halfway through, a surprise timed question pops up.
A correct answer unlocks the rest of the journey and the treasure-chest reveal:
**"The Math Puzzle Hunt is now officially activated."**

## Run it
Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No install needed.
It loads three.js r128 and Google Fonts from public CDNs, so it needs an internet connection.

### Host it free with GitHub Pages
Repo **Settings → Pages → Deploy from a branch → `main` / root**. Your site appears at
`https://<your-username>.github.io/<repo-name>/`.

## Edit the questions
Open `src/head.html` (or `index.html`) and find `CONFIG` near the top of the script:

```js
questions: [
  { question: "Solve for x: 2x + 5 = 17", answers: ["6", "x=6"] },
  { question: "Square root of 144?", answers: ["12", "twelve"] },
],
```

- One question is picked at random each time the page loads.
- Spaces and capital letters in answers are ignored.
- Other settings: `seconds` (timer, default 30), `tickSound`, `triggerAt` (where the surprise pops, 0–1),
  `failOnTabLeave`, `successTitle`.

If you edit files in `src/`, run `./build.sh` to rebuild `index.html`.

## Rules during the question
- Wrong answer or timer runs out → "You're out."
- Leaving full screen, switching tabs, or clicking away → "You have been caught cheating."
- Reloading the page starts everything fresh.

## Files
| Path | What it is |
|---|---|
| `index.html` | The complete, ready-to-run site (single file) |
| `src/head.html` | Page layout, styles, text cards and `CONFIG` |
| `src/island.js` | Island terrain, trail and the parchment map drawing |
| `src/helpers.js` | Materials, textures, vegetation, treasure chest |
| `src/extras.js` | Temple, ruins, waterfall, bridge, cave, wind, mist |
| `src/animals.js` | Crab, turtle, parrots, monkey, snake, camel, jaguar, bats |
| `src/quality.js` | Ground textures, triplanar stone/rock, clouds |
| `src/grade.js` | Film-style colour grade |
| `src/main.js` | Scene setup, scroll/camera choreography, surprise question logic |
| `build.sh` | Joins `src/` back into `index.html` |
