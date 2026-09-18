# Meal Planner — deployment and setup

Netlify is linked to `GZod56/meal-planner`, branch `main`. A commit to
`main` triggers a production deploy.

## Required Netlify environment variables

Set these directly in Netlify, with **Functions** scope and the
**Production** context (also Deploy Previews if you want to test there):

- `OPENAI_API_KEY`: your OpenAI API key.
- `APP_PASSWORD`: a unique household password of at least 16 characters.
  Use this same password in the app on each device. Changing it invalidates
  existing signed-in sessions.

Never commit these values or paste them into a chat. Redeploy after changing
environment variables. The old Anthropic key is no longer used.

Optional: `OPENAI_MODEL` overrides the default `gpt-5-mini`. The selected
model must support the Responses API and low reasoning effort.

## Build

`netlify.toml` sets the build command to `npm run build`, the publish
directory to `public`, and the functions directory to `netlify/functions`.
Use Node 22 or newer. Run `npm ci`, `npm test`, and `npm run build`.
The build copies only browser assets into the published directory.
Deploy through the Git-connected build; uploading only the static folder
would omit the server functions.

## App behavior

- Library is the home screen. The Freezer tab is removed.
- Add or edit recipes in Library. URL imports read structured recipe data
  from public HTTPS pages and open an editable preview before saving.
  Unsupported or restricted sites can be entered manually.
- Delete recipe excludes it from Library and future plans. Restore it from
  Menu → Deleted recipes. Recipes in an existing plan remain usable.
- Shopping combines compatible quantities, applies the chosen batch scale,
  and keeps ambiguous amounts and side dishes in separate checklists.
- The assistant uses OpenAI, requires household sign-in, and sends the
  current conversation and meal-planning context with `store: false`.
  A fresh local chat key prevents the previous assistant context carrying over.

## Household sync

Select **Connect household** and sign in with `APP_PASSWORD` on each device.
Recipes and edits, deletions, plans, history, checkmarks, side choices, and
uploaded photos sync through a private Netlify Blobs store. Existing local
data is preserved. Chat history and personal setup values stay on the device.

Sync runs on connection, after changes, when returning to the app, and every
30 seconds while online. It pauses while editing or cooking. Offline edits
wait locally. If both devices change the same item, the app asks which
version to keep. Photos are stored individually. Keys and passwords remain
on the server; sign-in uses a signed HttpOnly cookie valid for 30 days.

The account supports two Netlify rate-limit rules. Sign-in and chat each
allow 10 requests per minute per IP and domain. Import and sync require
household sign-in and bound payload sizes, without additional edge rate limits.
Chat also bounds input size and caps model output at 2,400 tokens. These
request limits are not a monetary spending cap.

## Validation and remaining live checks

Ten automated tests pass, covering quantity aggregation, recipe normalization,
session protection, sync conflicts and offline edits, import parsing and
private-address rejection, and mocked OpenAI responses. The production build
passes. Browser checks covered add/edit, sign-in, a real URL import, and
sync between two independent local storage areas.

After publishing, verify the Netlify Blobs integration and rate limits in
the deployed environment, then test a real OpenAI reply and sync between
your actual devices. These live checks require the configured secrets and
repository write access.

Service-worker cache version: `mp-v10`. Bump it when browser code changes.
