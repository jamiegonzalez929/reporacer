import { fetchAllRepoData } from '../api/github.js'
import { computeMetrics, scoreColor, scoreLabel } from '../metrics/compute.js'
import { renderSparkline } from './sparkline.js'
import { formatNumber, daysColor } from './format.js'

const EXAMPLES = [
  'vercel/next.js',
  'facebook/react',
  'vuejs/vue',
  'denoland/deno',
  'rust-lang/rust',
]

export class App {
  constructor(container) {
    this.container = container
    this.token = localStorage.getItem('reporacer:token') || ''
  }

  mount() {
    this.container.innerHTML = this.renderShell()
    this.bindEvents()
    this.handleURLParams()
  }

  renderShell() {
    return `
      <header class="header">
        <span class="header-logo">🏎️</span>
        <span class="header-title">RepoRacer</span>
        <span class="header-sub">engineering velocity dashboard</span>
        <a href="https://github.com/jamiegonzalez929/reporacer" target="_blank" rel="noopener" class="header-github">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
      </header>

      <main id="main-content">
        <section class="hero" id="hero-section">
          <h1 class="hero-title">How fast is that repo, really?</h1>
          <p class="hero-sub">Drop in up to 5 GitHub repositories. Get instant commit velocity, contributor health, and more — no login required.</p>

          <form class="search-form" id="search-form">
            <div class="search-input-wrap">
              <input
                type="text"
                class="search-input"
                id="repo-input"
                placeholder="vercel/next.js, facebook/react, vuejs/vue"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
              />
              <button type="submit" class="search-btn" id="search-btn">Analyze →</button>
            </div>
            <div class="token-input-wrap">
              <span class="token-label">GitHub token (optional):</span>
              <input
                type="password"
                class="token-input"
                id="token-input"
                placeholder="ghp_... raises rate limit from 60 to 5000 req/hr"
                value="${this.token}"
              />
            </div>
            <div class="search-hint">
              Enter <code>owner/repo</code> format, comma-separated. Up to 5 repos.
              <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">Get a token →</a>
            </div>
          </form>

          <div class="examples" id="examples">
            ${EXAMPLES.map(e => `<button class="example-btn" data-repo="${e}">${e}</button>`).join('')}
          </div>
        </section>

        <section class="loading-section hidden" id="loading-section">
          <p class="loading-title" id="loading-msg">Fetching data from GitHub…</p>
          <div class="skeleton-grid" id="skeleton-grid"></div>
        </section>

        <section class="results-section hidden" id="results-section">
          <div class="results-header">
            <span class="results-title" id="results-title"></span>
            <button class="results-share" id="share-btn">📋 Copy Link</button>
          </div>
          <div class="cards-grid" id="cards-grid"></div>
          <div id="compare-section"></div>
        </section>
      </main>

      <footer class="footer">
        Built by <a href="https://github.com/jamiegonzalez929" target="_blank" rel="noopener">Jamie Gonzalez</a> ·
        <a href="https://github.com/jamiegonzalez929/reporacer" target="_blank" rel="noopener">Open source</a> ·
        Uses GitHub public API · Data cached 1hr
      </footer>
    `
  }

  bindEvents() {
    const form = document.getElementById('search-form')
    const tokenInput = document.getElementById('token-input')
    const shareBtn = document.getElementById('share-btn')

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      const val = document.getElementById('repo-input').value.trim()
      this.token = tokenInput.value.trim()
      if (this.token) localStorage.setItem('reporacer:token', this.token)
      if (val) this.analyze(val)
    })

    document.getElementById('examples').addEventListener('click', (e) => {
      if (e.target.classList.contains('example-btn')) {
        const repo = e.target.dataset.repo
        document.getElementById('repo-input').value = repo
        this.token = tokenInput.value.trim()
        this.analyze(repo)
      }
    })

    shareBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        shareBtn.textContent = '✅ Copied!'
        shareBtn.classList.add('copied')
        setTimeout(() => {
          shareBtn.textContent = '📋 Copy Link'
          shareBtn.classList.remove('copied')
        }, 2000)
      })
    })
  }

  handleURLParams() {
    const params = new URLSearchParams(window.location.search)
    const repos = params.get('repos')
    if (repos) {
      document.getElementById('repo-input').value = repos.replace(/,/g, ', ')
      this.analyze(repos)
    }
  }

  parseRepos(input) {
    return input
      .split(/[,\n]+/)
      .map(s => s.trim().replace(/^https?:\/\/github\.com\//, ''))
      .filter(s => /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(s))
      .slice(0, 5)
  }

  async analyze(input) {
    const repos = this.parseRepos(input)
    if (!repos.length) return

    // Update URL
    const url = new URL(window.location.href)
    url.searchParams.set('repos', repos.join(','))
    window.history.replaceState({}, '', url.toString())

    // Show loading
    document.getElementById('hero-section').classList.remove('hidden')
    document.getElementById('loading-section').classList.remove('hidden')
    document.getElementById('results-section').classList.add('hidden')

    // Skeleton cards
    const skeletonGrid = document.getElementById('skeleton-grid')
    skeletonGrid.innerHTML = repos.map(r => `
      <div class="skeleton-card">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line tall" style="margin-top:16px;"></div>
      </div>
    `).join('')

    const results = []
    let completed = 0

    await Promise.all(repos.map(async (slug) => {
      const [owner, repo] = slug.split('/')
      try {
        const raw = await fetchAllRepoData(owner, repo, this.token || null, (progress, label) => {
          document.getElementById('loading-msg').textContent =
            `Fetching ${slug}: ${label}…`
        })
        const metrics = computeMetrics(raw)
        results.push({ slug, metrics, error: null })
      } catch (err) {
        results.push({ slug, metrics: null, error: err.message })
      }
      completed++
      if (completed === repos.length) {
        this.showResults(results)
      }
    }))
  }

  showResults(results) {
    document.getElementById('loading-section').classList.add('hidden')
    const section = document.getElementById('results-section')
    section.classList.remove('hidden')

    const successful = results.filter(r => r.metrics)
    document.getElementById('results-title').textContent =
      `${successful.length} of ${results.length} repos analyzed`

    // Cards
    const cardsGrid = document.getElementById('cards-grid')
    cardsGrid.innerHTML = results.map(r => this.renderCard(r)).join('')

    // Draw sparklines
    results.forEach(r => {
      if (!r.metrics) return
      const canvas = document.getElementById(`spark-${CSS.escape(r.slug)}`)
      if (canvas && r.metrics.weeklyCommits?.length) {
        renderSparkline(canvas, r.metrics.weeklyCommits)
      }
    })

    // Comparison table
    if (successful.length > 1) {
      document.getElementById('compare-section').innerHTML = this.renderCompareTable(successful)
    }
  }

  renderCard({ slug, metrics, error }) {
    if (error || !metrics) {
      return `
        <div class="error-card">
          <strong>${slug}</strong>
          ${error || 'Failed to load data.'}
        </div>
      `
    }

    const m = metrics
    const color = scoreColor(m.healthScore)
    const label = scoreLabel(m.healthScore)
    const circumference = 2 * Math.PI * 20
    const dashOffset = circumference * (1 - m.healthScore / 100)

    return `
      <div class="repo-card">
        <div class="repo-card-header">
          <div class="repo-score-ring">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="20" fill="none" stroke="var(--surface2)" stroke-width="4"/>
              <circle cx="26" cy="26" r="20" fill="none" stroke="${color}" stroke-width="4"
                stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
                stroke-linecap="round"/>
            </svg>
            <div class="repo-score-text">${m.healthScore}</div>
          </div>
          <div class="repo-card-title">
            <a href="https://github.com/${slug}" target="_blank" rel="noopener" class="repo-name">${slug}</a>
            ${m.description ? `<div class="repo-desc">${escapeHtml(m.description)}</div>` : ''}
          </div>
        </div>

        <div class="repo-tags">
          ${m.language ? `<span class="repo-tag lang">${m.language}</span>` : ''}
          ${m.license ? `<span class="repo-tag">${m.license}</span>` : ''}
          ${m.archived ? `<span class="repo-tag archived">archived</span>` : ''}
          <span class="repo-tag" style="color:${color}">${label}</span>
        </div>

        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">⭐ Stars</div>
            <div class="metric-value">${formatNumber(m.stars)}</div>
            <div class="metric-sub">${m.starsPerDay}/day</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">🍴 Forks</div>
            <div class="metric-value">${formatNumber(m.forks)}</div>
            <div class="metric-sub">${formatNumber(m.watchers)} watching</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">📝 Commits/wk</div>
            <div class="metric-value">${m.avgWeeklyCommits}</div>
            <div class="metric-sub">last 52 weeks avg</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">🔥 Recent/wk</div>
            <div class="metric-value ${m.recentCommitVelocity >= m.avgWeeklyCommits ? 'green' : 'orange'}">${m.recentCommitVelocity}</div>
            <div class="metric-sub">last 4 weeks avg</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">⏱️ Last push</div>
            <div class="metric-value ${daysColor(m.daysSincePush)}" style="font-size:13px">${m.pushedAgo}</div>
            <div class="metric-sub">${m.daysSincePush}d ago</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">👥 Contributors</div>
            <div class="metric-value">${m.contributorCount}+</div>
            <div class="metric-sub">bus factor ~${m.busFactor}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">🚨 Open Issues</div>
            <div class="metric-value">${formatNumber(m.openIssues)}</div>
            <div class="metric-sub">open right now</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">🎯 Top contrib</div>
            <div class="metric-value ${m.top1Pct > 60 ? 'red' : m.top1Pct > 40 ? 'yellow' : 'green'}">${m.top1Pct}%</div>
            <div class="metric-sub">top-3: ${m.top3Pct}% of commits</div>
          </div>
        </div>

        ${m.weeklyCommits?.length ? `
          <div class="sparkline-wrap">
            <div class="sparkline-label">Commit activity (52 weeks)</div>
            <canvas class="sparkline-canvas" id="spark-${slug}" width="300" height="48"></canvas>
          </div>
        ` : ''}

        ${m.latestRelease ? `
          <div style="margin-top:12px;font-size:12px;color:var(--muted)">
            Latest release: <span style="color:var(--text);font-family:var(--mono)">${escapeHtml(m.latestRelease.tag_name)}</span>
            <span style="margin-left:6px">${m.daysSinceRelease}d ago</span>
          </div>
        ` : ''}
      </div>
    `
  }

  renderCompareTable(results) {
    const metrics = results.map(r => r.metrics)
    const rows = [
      { label: 'Health Score', key: 'healthScore', higher: true, format: v => v },
      { label: '⭐ Stars', key: 'stars', higher: true, format: formatNumber },
      { label: '🍴 Forks', key: 'forks', higher: true, format: formatNumber },
      { label: 'Commits/wk (avg)', key: 'avgWeeklyCommits', higher: true, format: v => v },
      { label: 'Recent commits/wk', key: 'recentCommitVelocity', higher: true, format: v => v },
      { label: 'Days since push', key: 'daysSincePush', higher: false, format: v => `${v}d` },
      { label: 'Contributors', key: 'contributorCount', higher: true, format: v => `${v}+` },
      { label: 'Bus factor', key: 'busFactor', higher: true, format: v => v },
      { label: 'Top contrib %', key: 'top1Pct', higher: false, format: v => `${v}%` },
      { label: 'Open Issues', key: 'openIssues', higher: false, format: formatNumber },
    ]

    return `
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${results.map(r => `<th>${r.slug}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => {
              const vals = metrics.map(m => m[row.key])
              const best = row.higher ? Math.max(...vals) : Math.min(...vals)
              return `
                <tr>
                  <td>${row.label}</td>
                  ${vals.map(v => {
                    const isWinner = v === best
                    return `<td class="${isWinner ? 'winner-cell' : ''}">${row.format(v)}</td>`
                  }).join('')}
                </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </div>
    `
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
