# gnanreddy13.github.io

my corner of the internet. plain html, css and js, no build step. github pages serves it straight from `main`.

## what's where

- `index.html`, `style.css`, `app.js`: the site
- `404.html`: shown for any missing url
- `music/`: the track and its cover art
- `data/`: github + leetcode activity, rewritten every night
- `scripts/update-activity.mjs`: fetches that data
- `.github/workflows/activity.yml`: runs the script at 02:00 IST and commits whatever changed

## notes

- the action uses the `GH_STATS_TOKEN` secret if it's set, otherwise the default `GITHUB_TOKEN`
- the bot commits to `main` every night, so `git pull --rebase` before pushing
- bump the `?v=` on `style.css` / `app.js` in `index.html` (and `404.html` for the css) after editing them
