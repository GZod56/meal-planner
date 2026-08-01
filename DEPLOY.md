# Meal Planner — deploy

Netlify → your site → **Deploys** tab → drag the **unzipped `meal_planner_app` folder**
onto the drop zone. Not the zip, not the folder's contents — the folder itself.

After it says Published, check: `<your-site>/recipes.json` should return JSON.
If it 404s, the files landed a level deep — redeploy.

Cache key is `mp-v5`. `recipes.json`, `index.html` and `engine.js` are now fetched
network-first, so a stale cache can no longer hide a good deploy.

If the library fails to load the app now says so on screen, with the URL it tried,
and unregisters its own service worker so the next reload starts clean.

`ANTHROPIC_API_KEY` lives in Netlify env vars, not in this folder.
