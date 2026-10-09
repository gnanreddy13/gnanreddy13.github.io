import { writeFileSync } from "node:fs";

const GH_USER = process.env.GH_USER;
const LC_USER = process.env.LC_USER;
const TOKEN = process.env.GH_TOKEN;
const DAYS = 364; // GitHub's API only allows a 1-year range

const dayList = () => {
  const now = Date.now(), out = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    out.push(new Date(now - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
};

async function github() {
  const query = `query($login:String!,$from:DateTime!,$to:DateTime!){
    user(login:$login){contributionsCollection(from:$from,to:$to){
      contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "activity-script",
    },
    body: JSON.stringify({
      query,
      variables: {
        login: GH_USER,
        from: new Date(Date.now() - DAYS * 86400000).toISOString(),
        to: new Date().toISOString(),
      },
    }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error("github: " + JSON.stringify(j.errors || r.status));
  const map = {};
  for (const w of j.data.user.contributionsCollection.contributionCalendar.weeks)
    for (const d of w.contributionDays) map[d.date] = d.contributionCount;
  return map;
}

// public repo count + the most recent push to a public repo
async function githubStats() {
  const headers = {
    Authorization: `bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "activity-script",
  };
  const u = await fetch(`https://api.github.com/users/${GH_USER}`, { headers });
  if (!u.ok) throw new Error("github user: " + u.status);
  const user = await u.json();
  const r = await fetch(
    `https://api.github.com/users/${GH_USER}/repos?type=owner&sort=pushed&per_page=1`,
    { headers }
  );
  if (!r.ok) throw new Error("github repos: " + r.status);
  const list = await r.json();
  if (typeof user.public_repos !== "number" || !list[0]?.pushed_at)
    throw new Error("github: unexpected response");
  return { repos: user.public_repos, pushed: list[0].pushed_at };
}

async function leetcode() {
  const query = `query($u:String!,$y:Int){matchedUser(username:$u){userCalendar(year:$y){submissionCalendar}}}`;
  const y = new Date().getUTCFullYear();
  const map = {};
  for (const year of [y - 1, y]) {
    const r = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query, variables: { u: LC_USER, y: year } }),
    });
    const j = await r.json();
    const cal = j?.data?.matchedUser?.userCalendar?.submissionCalendar;
    if (!cal) throw new Error("leetcode: no calendar returned for " + year);
    for (const [ts, c] of Object.entries(JSON.parse(cal))) {
      const day = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
      map[day] = (map[day] || 0) + c;
    }
  }
  return map;
}

async function leetcodeStats() {
  const query = `query($u:String!){matchedUser(username:$u){submitStatsGlobal{acSubmissionNum{difficulty count}}}}`;
  const r = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "https://leetcode.com",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({ query, variables: { u: LC_USER } }),
  });
  const j = await r.json();
  const rows = j?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
  if (!rows) throw new Error("leetcode: no stats returned");
  const get = (d) => rows.find((x) => x.difficulty === d)?.count ?? 0;
  return { solved: get("All"), easy: get("Easy"), medium: get("Medium"), hard: get("Hard") };
}

let failures = 0;
for (const [file, fn] of [["data/github.json", github], ["data/leetcode.json", leetcode]]) {
  try {
    const map = await fn();
    const out = dayList().map((date) => ({ date, count: map[date] || 0 }));
    writeFileSync(file, JSON.stringify(out));
    console.log("wrote", file);
  } catch (e) {
    failures++;
    console.error("failed:", file, e.message); // old file stays untouched
  }
}

for (const [file, fn] of [["data/leetcode-stats.json", leetcodeStats], ["data/github-stats.json", githubStats]]) {
  try {
    writeFileSync(file, JSON.stringify(await fn()));
    console.log("wrote", file);
  } catch (e) {
    console.error("failed:", file, e.message); // old file stays untouched
  }
}

if (failures === 2) process.exit(1);