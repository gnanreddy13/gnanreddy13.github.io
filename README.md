# gnanreddy13.github.io

my corner of the internet. plain html, css and js, no build step. a github action publishes it on every push to `main`, and again every night.

## what's where

- `index.html`, `style.css`, `app.js`: the site
- `404.html`: shown for any missing url
- `life/`: the slice of life page (`/life/`), same look as the home page: it uses `style.css`, plus its own `life.css` and `life.js`
- `life/data.json`: everything on that page: lately, places (with their google photos albums), the cover photo, the lifting week and plan, gym days, and the media lists
- `life/photos/`, `life/covers/`: the cover photo and the media posters (resized, metadata stripped)
- `music/`: the track and its cover art
- `data/`: github + leetcode activity. the deploy fetches fresh copies; the ones in the repo are only a fallback
- `scripts/update-activity.mjs`: fetches that data
- `.github/workflows/deploy.yml`: runs the script, then publishes the site (on push, and at 02:00 IST)

## notes

- the action uses the `GH_STATS_TOKEN` secret if it's set, otherwise the default `GITHUB_TOKEN`
- no need to bump the `?v=` on `style.css` / `app.js` / `life.css` / `life.js`: the deploy sets it to the commit
- to log a gym day, add its date (`yyyy-mm-dd`) to `"gym"` in `life/data.json`
