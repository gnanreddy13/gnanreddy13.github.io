# gnanreddy13.github.io

my corner of the internet. plain html, css and js, no build step. a github action publishes it on every push to `main`, and again every night.

## what's where

- `index.html`, `home.css`, `home.js`: the home page
- `404.html`: shown for any missing url (uses `home.css`)
- `icons/`: official logos for the stack and projects (simple-icons, and devicon's multi-colour originals)
- `life/`: the slice of life page (`/life/`): `home.css` for the look, like the home page, plus its own `life.css` and `life.js`
- `life/data.json`: everything on that page: places (with their google photos albums), the lifting plan, gym days, and the media lists (anything with `"progress"` set shows as ongoing, with a green dot)
- `life/photos/`, `life/covers/`: one photo per place, the banner for link previews, and the media posters (resized, metadata stripped); `life/covers/large/` holds bigger copies of the posters (not used by the page right now)
- `fonts/`: Geist for the type, Caveat for the handwriting on the life page (both self-hosted, OFL)
- `data/`: github + leetcode activity. the deploy fetches fresh copies; the ones in the repo are only a fallback
- `scripts/update-activity.mjs`: fetches that data
- `.github/workflows/deploy.yml`: runs the script, then publishes the site (on push, and at 02:00 IST)

## notes

- the action uses the `GH_STATS_TOKEN` secret if it's set, otherwise the default `GITHUB_TOKEN`
- after a gym session, add its date (`yyyy-mm-dd`) to `"gym"` in `life/data.json`: it shows as a green square on the year graph under lifting
- no need to bump the `?v=` on `home.css` / `home.js` / `life.css` / `life.js`: the deploy sets it to the commit
- to update the resume, just replace `gnan-reddy-bobba-resume.pdf`: the deploy gives its link a new `?v=` whenever the pdf changes, so no one gets a cached copy
