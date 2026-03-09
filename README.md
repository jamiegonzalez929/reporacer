# 🏎️ RepoRacer

> Engineering velocity dashboard for open-source GitHub repositories

Drop in up to 5 GitHub repos and instantly see commit velocity, contributor health, bus factor risk, and more — **no login required**.

**Live site:** https://jamiegonzalez929.github.io/reporacer/

## Features

- 📊 Commit velocity (52-week history + sparklines)
- 👥 Contributor analysis & bus factor proxy
- ⭐ Stars growth rate
- 🔥 Recent vs historical velocity comparison
- 🆚 Side-by-side comparison table for multiple repos
- 🔗 Shareable URLs (all state in query params)
- 💾 Client-side caching (1-hour TTL, no backend needed)
- 🌙 Dark mode, responsive

## Usage

Visit the site and enter `owner/repo` format, comma-separated:

```
vercel/next.js, facebook/react, vuejs/vue
```

Or use the shareable URL format:

```
https://jamiegonzalez929.github.io/reporacer/?repos=vercel/next.js,facebook/react
```

## Optional: Raise Rate Limits

GitHub's public API is limited to 60 requests/hour unauthenticated. Add a [GitHub token](https://github.com/settings/tokens) (no scopes needed) to raise it to 5,000/hour.

## Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy Your Own

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jamiegonzalez929/reporacer)

Or fork and enable GitHub Pages (Settings → Pages → GitHub Actions).

## License

MIT — by [Jamie Gonzalez](https://github.com/jamiegonzalez929)
