# gnanreddy13.github.io

my corner of the internet. plain html, css and js, no build step. a github action publishes it on every push to `main`, and again every night.

## what's where

- `index.html`, `site.css`, `app.js`: the home page
- `404.html`: shown for any missing url (uses `site.css`)
- `icons/`: official logos for the stack and projects (simple-icons, and devicon's multi-colour originals)
- `life/`: the slice of life page (`/life/`): `site.css` for the look, plus its own `life.css` and `life.js`
- `life/data.json`: everything on that page: lately, places (with their google photos albums), the backdrop photo's place and month, the lifting week and plan, gym days, and the media lists
- `life/photos/`, `life/covers/`: the backdrop, one photo per place, and the media posters (resized, metadata stripped)
- `fonts/`: Geist for the type, Caveat for the handwriting on the life page (both self-hosted, OFL)
- `data/`: github + leetcode activity. the deploy fetches fresh copies; the ones in the repo are only a fallback
- `scripts/update-activity.mjs`: fetches that data
- `.github/workflows/deploy.yml`: runs the script, then publishes the site (on push, and at 02:00 IST)

## notes

- the action uses the `GH_STATS_TOKEN` secret if it's set, otherwise the default `GITHUB_TOKEN`
- after a gym session, add its date (`yyyy-mm-dd`) to `"gym"` in `life/data.json`: it shows as a tick on the week strip under the sticky note
- no need to bump the `?v=` on `site.css` / `app.js` / `life.css` / `life.js`: the deploy sets it to the commit
