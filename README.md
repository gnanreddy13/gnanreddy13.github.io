# gnanreddy13.github.io

my corner of the internet. plain html, css and js, no build step. a github action publishes it on every push to `main`, and again every night.

## what's where

- `index.html`, `style.css`, `app.js`: the site
- `404.html`: shown for any missing url
- `music/`: the track and its cover art
- `data/`: github + leetcode activity. the deploy fetches fresh copies; the ones in the repo are only a fallback
- `scripts/update-activity.mjs`: fetches that data
- `.github/workflows/deploy.yml`: runs the script, then publishes the site (on push, and at 02:00 IST)

## notes

- the action uses the `GH_STATS_TOKEN` secret if it's set, otherwise the default `GITHUB_TOKEN`
- no need to bump the `?v=` on `style.css` / `app.js`: the deploy sets it to the commit
