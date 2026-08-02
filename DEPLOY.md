# Meal Planner — deploy

Netlify is linked to `github.com/GZod56/meal-planner` (branch `main`).
Any push to `main` triggers a rebuild automatically — no drag-and-drop, no CLI.

Build settings: no build command, publish directory `.`, functions from `netlify.toml`.
`ANTHROPIC_API_KEY` lives in Netlify env vars, not in this repo.

`recipes.json` is the single canonical library. The app fetches it network-first,
so recipe edits land on the next load without a cache bust.

Bump `V` in `sw.js` whenever `index.html` or `engine.js` changes, so an old cached
shell can't run against new data. Current key: `mp-v6`.
