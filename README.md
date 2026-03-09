# ⚡ Repo Velocity

> Engineering velocity dashboard for any public GitHub repository.

Paste any `owner/repo` and get an instant snapshot of the team's engineering cadence — commit frequency, PR throughput, issue health, release cadence, contributor diversity, and a composite velocity score.

**No login required. No API key needed for basic usage.**

![Repo Velocity Screenshot](https://via.placeholder.com/1200x630/0d0f14/6378ff?text=Repo+Velocity+Dashboard)

---

## Features

- **Velocity Score (0–100)** — Composite grade across 6 dimensions with a radar chart
- **12+ KPI cards** — Commits, PR merge rate, issue close time, active days, and more
- **4 trend charts** — Weekly commit activity, PR throughput, issue resolution, contributor count
- **Commit heatmap** — Day-of-week × hour-of-day activity matrix
- **Top contributors** — Leaderboard with bus factor analysis
- **PR health panel** — Merge rate, avg/median merge time, open count
- **Release timeline** — Visual history with cadence metrics
- **URL routing** — Share links like `/?repo=vercel/next.js`
- **Example repos** — Quick-load chips on the homepage

---

## Quick Start

### Run locally

```bash
git clone https://github.com/YOUR_USERNAME/repo-velocity
cd repo-velocity
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter any `owner/repo`.

### Build for production

```bash
npm run build
# → dist/ is ready to deploy anywhere
```

### Preview the production build

```bash
npm run preview
```

---

## GitHub API Rate Limits

| Mode | Limit |
|------|-------|
| No token (default) | 60 requests/hour |
| With token | 5,000 requests/hour |

For personal use, the unauthenticated limit is fine for occasional lookups. For heavier use or CI:

1. Copy `.env.example` → `.env`
2. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) — **no scopes needed** for public repos
3. Add it: `VITE_GITHUB_TOKEN=ghp_your_token_here`
4. Restart `npm run dev`

The token is used client-side and **never sent anywhere except GitHub's API**. Never commit your `.env` file.

---

## Deploy

### Vercel (recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/repo-velocity)

1. Import repo into Vercel
2. Build command: `npm run build`
3. Output directory: `dist`
4. (Optional) Add `VITE_GITHUB_TOKEN` as an environment variable

### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/repo-velocity)

`netlify.toml` is already configured.

### GitHub Pages

Push to `main` — the included GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically builds and deploys to GitHub Pages.

Enable Pages in repo Settings → Pages → Source: GitHub Actions.

---

## Metrics Explained

### Velocity Score

A 0–100 composite score across 6 weighted dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Commit Cadence | 25% | Avg weekly commits over 90 days |
| PR Throughput | 20% | Volume of PRs merged + merge rate |
| Issue Health | 15% | Resolution rate + avg close time |
| Release Frequency | 15% | Days between releases |
| Team Breadth | 10% | Bus factor / contributor diversity |
| Consistency | 15% | Variance in weekly commit volume |

**Grades:** A (80+) · B (60–79) · C (40–59) · D (<40)

### Bus Factor

Fewest contributors whose combined commits exceed 50% of total commits. A bus factor of 1 means one person leaving would severely impact the project.

### Data Window

Most metrics analyze the **last 90 days** of activity. Some charts show the last 13 weeks (~3 months).

---

## Tech Stack

- **[Vite](https://vitejs.dev/)** — build tooling
- **[Chart.js](https://www.chartjs.org/)** — charts (tree-shaken, ~80kb gzip)
- **[date-fns](https://date-fns.org/)** — date math
- **GitHub REST API** — public data source
- Pure vanilla JS (no framework)
- Static build — deploy anywhere

---

## Project Structure

```
repo-velocity/
├── index.html              # Entry point
├── src/
│   ├── main.js             # App orchestrator
│   ├── api/
│   │   └── github.js       # GitHub REST API client
│   ├── metrics/
│   │   ├── commits.js      # Commit calculations
│   │   ├── pullRequests.js # PR calculations
│   │   ├── issues.js       # Issue calculations
│   │   ├── contributors.js # Contributor / bus factor
│   │   ├── releases.js     # Release cadence
│   │   └── score.js        # Composite velocity score
│   ├── ui/
│   │   ├── dashboard.js    # DOM renderer
│   │   └── charts.js       # Chart.js builders
│   └── styles/
│       └── main.css        # Dark theme
├── .env.example            # Token setup guide
├── vercel.json             # Vercel config
├── netlify.toml            # Netlify config
└── .github/workflows/
    └── deploy.yml          # GitHub Pages CI
```

---

## Limitations

- **Public repos only** — private repos require a token with `repo` scope
- **Stats API warm-up** — GitHub's `/stats/*` endpoints can take a few seconds on first load for inactive repos
- **Large repos** — the client fetches up to 500 commits, 500 PRs, 500 issues. Extremely large repos (Linux kernel, etc.) will show a representative sample
- **Rate limits** — 60 req/hr unauthenticated is sufficient for ~5 analyses/hour

---

## Contributing

PRs welcome. Ideas for improvement:

- [ ] Code churn / lines changed metrics
- [ ] DORA metrics (deployment frequency, lead time, MTTR, change failure rate)
- [ ] Compare two repos side-by-side
- [ ] Export metrics as JSON/CSV
- [ ] Dark/light theme toggle
- [ ] Caching to localStorage

---

## License

MIT © 2024

---

*Built with the GitHub REST API. Not affiliated with GitHub.*
