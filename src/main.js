/**
 * RepoRacer — Main Application Entry
 * 
 * Supports multi-repo comparison and velocity analysis
 */

import { subDays } from 'date-fns'
import {
  getRepo,
  getCommits,
  getPullRequests,
  getIssues,
  getReleases,
} from './api/github.js'
import { commitsByWeek, commitHeatmap, uniqueContributors, commitDensity } from './metrics/commits.js'
import { analyzePRs, prsByWeek } from './metrics/pullRequests.js'
import { analyzeIssues, issuesByWeek } from './metrics/issues.js'
import { buildContributorLeaderboard, calcBusFactor, contributorsByWeek } from './metrics/contributors.js'
import { analyzeReleases } from './metrics/releases.js'
import { calcVelocityScore, fmtNumber } from './metrics/score.js'
import { renderDashboard, renderComparison, renderVelocityCards, renderInsights } from './ui/dashboard.js'

// ─── State ───────────────────────────────────────────────────────────────────
let currentRepos = []
let analyzedData = {}
let currentView = 'analyze'

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const hero = document.getElementById('hero')
const loadingScreen = document.getElementById('loadingScreen')
const errorScreen = document.getElementById('errorScreen')
const dashboard = document.getElementById('dashboard')
const leaderboardView = document.getElementById('leaderboardView')
const navBar = document.getElementById('navBar')
const searchForm = document.getElementById('searchForm')
const repoInput = document.getElementById('repoInput')
const searchInputs = document.getElementById('searchInputs')
const addRepoBtn = document.getElementById('addRepoBtn')
const searchBtn = document.getElementById('searchBtn')
const errorTitle = document.getElementById('errorTitle')
const errorMessage = document.getElementById('errorMessage')
const errorRetry = document.getElementById('errorRetry')
const newSearchBtn = document.getElementById('newSearchBtn')
const loadingTitle = document.getElementById('loadingTitle')
const loadingRepo = document.getElementById('loadingRepo')

// ─── Navigation ──────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view
    setView(view)
  })
})

function setView(view) {
  currentView = view
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'))
  document.querySelector(`.nav-tab[data-view="${view}"]`)?.classList.add('active')
  
  hero.classList.add('hidden')
  loadingScreen.classList.add('hidden')
  errorScreen.classList.add('hidden')
  dashboard.classList.add('hidden')
  leaderboardView.classList.add('hidden')
  
  if (view === 'analyze') {
    hero.classList.remove('hidden')
  } else if (view === 'compare') {
    if (analyzedData && Object.keys(analyzedData).length > 0) {
      dashboard.classList.remove('hidden')
    } else {
      hero.classList.remove('hidden')
    }
  } else if (view === 'leaderboard') {
    leaderboardView.classList.remove('hidden')
    renderLeaderboard()
  }
}

// ─── Multi-repo Input ─────────────────────────────────────────────────────────
addRepoBtn.addEventListener('click', () => {
  const inputs = searchInputs.querySelectorAll('.search-input-wrap')
  if (inputs.length >= 4) {
    alert('Maximum 4 repos for comparison')
    return
  }
  
  const wrap = document.createElement('div')
  wrap.className = 'search-input-wrap'
  wrap.innerHTML = `
    <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
    </svg>
    <input type="text" class="search-input" placeholder="owner/repo" aria-label="GitHub repository" />
    <button type="button" class="remove-repo-btn" title="Remove">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `
  
  const removeBtn = wrap.querySelector('.remove-repo-btn')
  removeBtn.addEventListener('click', () => {
    if (searchInputs.children.length > 1) {
      wrap.remove()
    }
  })
  
  searchInputs.appendChild(wrap)
  wrap.querySelector('input').focus()
})

// ─── Example chips ────────────────────────────────────────────────────────────
document.querySelectorAll('.example-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const firstInput = searchInputs.querySelector('.search-input')
    if (firstInput) {
      firstInput.value = chip.dataset.repo
      firstInput.focus()
    }
  })
})

// ─── Search form ──────────────────────────────────────────────────────────────
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  
  const inputs = Array.from(searchInputs.querySelectorAll('.search-input'))
    .map(input => input.value.trim())
    .filter(Boolean)
  
  if (inputs.length === 0) return

  const repos = []
  for (const raw of inputs) {
    const match = raw.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s?#]+)/)
    if (match) {
      const [, owner, repo] = match
      repos.push({ owner, repo: repo.replace(/\.git$/, '') })
    }
  }
  
  if (repos.length === 0) {
    showError('Invalid format', 'Please enter repos in the format owner/repo — for example: vercel/next.js')
    return
  }

  await analyzeRepos(repos)
})

// ─── Back to search ───────────────────────────────────────────────────────────
function backToSearch() {
  show('hero')
  repoInput.value = currentRepos.join(', ') || ''
  repoInput.focus()
}

errorRetry.addEventListener('click', backToSearch)
newSearchBtn.addEventListener('click', backToSearch)

// ─── URL routing ──────────────────────────────────────────────────────────────
function checkURL() {
  const params = new URLSearchParams(window.location.search)
  const repo = params.get('repo') || params.get('r')
  if (repo) {
    const parts = repo.split(',').map(r => r.trim()).filter(Boolean)
    if (parts.length > 0) {
      const match = parts[0].match(/^([^/]+)\/([^/]+)$/)
      if (match) {
        repoInput.value = parts[0]
        analyzeRepos([{ owner: match[1], repo: match[2] }])
      }
    }
  }
}

// ─── Show/hide screens ────────────────────────────────────────────────────────
function show(screen) {
  hero.classList.add('hidden')
  loadingScreen.classList.add('hidden')
  errorScreen.classList.add('hidden')
  dashboard.classList.add('hidden')

  document.getElementById(
    screen === 'hero' ? 'hero' :
    screen === 'loading' ? 'loadingScreen' :
    screen === 'error' ? 'errorScreen' :
    'dashboard'
  ).classList.remove('hidden')
}

function showError(title, message) {
  errorTitle.textContent = title
  errorMessage.textContent = message
  show('error')
}

// ─── Loading steps ────────────────────────────────────────────────────────────
const STEPS = ['repo', 'commits', 'prs', 'issues', 'contributors', 'releases']

function setStep(stepId, repoName) {
  const idx = STEPS.indexOf(stepId)
  loadingRepo.textContent = repoName
  
  STEPS.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`)
    if (!el) return
    if (i < idx) el.className = 'loading-step done'
    else if (i === idx) el.className = 'loading-step active'
    else el.className = 'loading-step'
  })
  
  STEPS.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`)
    if (!el) return
    const label = {
      repo: 'Repository info',
      commits: 'Commit history',
      prs: 'Pull requests',
      issues: 'Issues',
      contributors: 'Contributors',
      releases: 'Releases',
    }[s]
    if (i < idx) el.textContent = `✓ ${label}`
    else if (i === idx) el.textContent = `◉ ${label}`
    else el.textContent = `○ ${label}`
  })
}

function resetSteps() {
  STEPS.forEach(s => {
    const el = document.getElementById(`step-${s}`)
    if (!el) return
    el.className = 'loading-step'
    el.textContent = `○ ${['Repository info', 'Commit history', 'Pull requests', 'Issues', 'Contributors', 'Releases'][STEPS.indexOf(s)]}`
  })
}

// ─── Core analysis pipeline ───────────────────────────────────────────────────
async function analyzeRepos(repos) {
  currentRepos = repos.map(r => `${r.owner}/${r.repo}`)
  loadingTitle.textContent = repos.length > 1 ? `Comparing ${repos.length} repositories…` : `Analyzing ${repos[0].owner}/${repos[0].repo}…`
  show('loading')
  resetSteps()
  searchBtn.disabled = true
  
  analyzedData = {}

  // Update URL without reload
  const url = new URL(window.location.href)
  url.searchParams.set('repo', currentRepos.join(','))
  window.history.pushState({}, '', url)

  try {
    for (let i = 0; i < repos.length; i++) {
      const { owner, repo } = repos[i]
      const repoKey = `${owner}/${repo}`
      
      try {
        const data = await analyzeSingleRepo(owner, repo)
        analyzedData[repoKey] = data
      } catch (err) {
        console.error(`Failed to analyze ${repoKey}:`, err)
        analyzedData[repoKey] = { error: err.message }
      }
    }

    // Check for all errors
    const errors = Object.entries(analyzedData).filter(([k, v]) => v.error)
    if (errors.length === repos.length) {
      showError('Analysis failed', errors[0][1].error || 'All repositories failed to load')
      return
    }

    // Render dashboard with comparison data
    renderFullDashboard(analyzedData)
    
    show('dashboard')
    window.scrollTo({ top: 0, behavior: 'smooth' })

  } finally {
    searchBtn.disabled = false
  }
}

async function analyzeSingleRepo(owner, repo) {
  const since = subDays(new Date(), 90).toISOString()

  // ── Step 1: Repo info ──
  setStep('repo', `${owner}/${repo}`)
  const repoData = await getRepo(owner, repo)

  // ── Step 2: Commits ──
  setStep('commits', `${owner}/${repo}`)
  const commits = await getCommits(owner, repo, since)

  // ── Step 3: Pull Requests ──
  setStep('prs', `${owner}/${repo}`)
  const pullRequests = await getPullRequests(owner, repo, 'all', 5)

  // ── Step 4: Issues ──
  setStep('issues', `${owner}/${repo}`)
  const issues = await getIssues(owner, repo, 'all', 5)

  // ── Step 5: Contributors (derived from commits) ──
  setStep('contributors', `${owner}/${repo}`)
  const leaderboardTop = buildContributorLeaderboard(commits)
  const busFactor = calcBusFactor(leaderboardTop)

  // ── Step 6: Releases ──
  setStep('releases', `${owner}/${repo}`)
  const releases = await getReleases(owner, repo)

  // ── Compute metrics ──
  const commitWeeks = commitsByWeek(commits)
  const heatmap = commitHeatmap(commits)
  const density = commitDensity(commits)
  const prMetrics = analyzePRs(pullRequests)
  const issueMetrics = analyzeIssues(issues)
  const releaseMetrics = analyzeReleases(releases)
  const prWeeks = prsByWeek(pullRequests)
  const issueWeeks = issuesByWeek(issues)
  const contribWeeks = contributorsByWeek(commits)

  const commitSummary = {
    total: commits.length,
    avgPerWeek: commitWeeks.length > 0
      ? Math.round(commitWeeks.reduce((s, w) => s + w.count, 0) / commitWeeks.length)
      : 0,
    activeDays: density.activeDays,
    uniqueContributors: uniqueContributors(commits),
  }

  const velocity = calcVelocityScore({
    commits: commitSummary,
    prs: prMetrics,
    issues: issueMetrics,
    releases: releaseMetrics,
    leaderboard: { busFactor },
    commitWeeks,
  })

  return {
    repo: repoData,
    velocity,
    commits: commitSummary,
    prs: prMetrics,
    issues: issueMetrics,
    releases: releaseMetrics,
    leaderboard: { top: leaderboardTop, busFactor },
    commitWeeks,
    prWeeks,
    issueWeeks,
    contributorWeeks: contribWeeks,
    heatmap,
  }
}

// ─── Render full dashboard with comparison ─────────────────────────────────
function renderFullDashboard(data) {
  const repoKeys = Object.keys(data).filter(k => !data[k].error)
  
  // Render repo header
  if (repoKeys.length === 1) {
    renderSingleRepoHeader(data[repoKeys[0]].repo)
  } else {
    renderMultiRepoHeader(data, repoKeys)
  }
  
  // Render velocity cards
  renderVelocityCards(data, repoKeys)
  
  // Render comparison table if multiple repos
  if (repoKeys.length > 1) {
    renderComparison(data, repoKeys)
  }
  
  // Render KPIs (show first repo or combined)
  const mainData = data[repoKeys[0]]
  if (mainData && !mainData.error) {
    renderDashboard({
      repo: mainData.repo,
      velocity: mainData.velocity,
      commits: mainData.commits,
      prs: mainData.prs,
      issues: mainData.issues,
      releases: mainData.releases,
      leaderboard: mainData.leaderboard,
      commitWeeks: mainData.commitWeeks,
      prWeeks: mainData.prWeeks,
      issueWeeks: mainData.issueWeeks,
      contributorWeeks: mainData.contributorWeeks,
      heatmap: mainData.heatmap,
    })
  }
  
  // Render insights
  renderInsights(data, repoKeys)
}

function renderSingleRepoHeader(repo) {
  const avatarsEl = document.getElementById('repoAvatars')
  avatarsEl.innerHTML = `<img class="repo-avatar" src="${repo.owner.avatar_url}" alt="${repo.owner.login}" />`
  
  document.getElementById('repoName').textContent = repo.full_name
  document.getElementById('repoDescription').textContent = repo.description || 'No description'
  document.getElementById('repoLink').href = repo.html_url
  
  const tagsEl = document.getElementById('repoTags')
  tagsEl.innerHTML = ''
  const tags = [repo.language, repo.license?.spdx_id].filter(Boolean)
  for (const tag of tags) {
    const span = document.createElement('span')
    span.className = 'repo-tag'
    span.textContent = tag
    tagsEl.appendChild(span)
  }
  
  const statsEl = document.getElementById('repoStatsMini')
  statsEl.innerHTML = `
    <div class="repo-stat-mini"><span>⭐</span> ${fmtNumber(repo.stargazers_count)}</div>
    <div class="repo-stat-mini"><span>🍴</span> ${fmtNumber(repo.forks_count)}</div>
    <div class="repo-stat-mini"><span>👁</span> ${fmtNumber(repo.watchers_count)}</div>
  `
}

function renderMultiRepoHeader(data, repoKeys) {
  const avatarsEl = document.getElementById('repoAvatars')
  avatarsEl.innerHTML = repoKeys.map(k => 
    `<img class="repo-avatar" src="${data[k].repo.owner.avatar_url}" alt="${data[k].repo.owner.login}" title="${k}"/>`
  ).join('')
  
  const names = repoKeys.map(k => `<strong>${k}</strong>`).join(' vs ')
  document.getElementById('repoName').innerHTML = names
  document.getElementById('repoDescription').textContent = `${repoKeys.length} repositories compared`
  document.getElementById('repoLink').href = data[repoKeys[0]].repo.html_url
  
  const tagsEl = document.getElementById('repoTags')
  tagsEl.innerHTML = ''
  
  const statsEl = document.getElementById('repoStatsMini')
  const totalStars = repoKeys.reduce((sum, k) => sum + (data[k].repo?.stargazers_count || 0), 0)
  const totalForks = repoKeys.reduce((sum, k) => sum + (data[k].repo?.forks_count || 0), 0)
  statsEl.innerHTML = `
    <div class="repo-stat-mini"><span>⭐</span> ${fmtNumber(totalStars)} total</div>
    <div class="repo-stat-mini"><span>🍴</span> ${fmtNumber(totalForks)} total</div>
  `
}

// ─── Leaderboard ───────────────────────────────────────────────────────────
function renderLeaderboard() {
  const listEl = document.getElementById('leaderboardList')
  
  // Sample leaderboard data - in production, this would come from a database
  const sampleRepos = [
    { name: 'microsoft/vscode', stars: 156000, velocity: 92 },
    { name: 'facebook/react', stars: 219000, velocity: 88 },
    { name: 'vercel/next.js', stars: 119000, velocity: 95 },
    { name: 'tailwindlabs/tailwindcss', stars: 76000, velocity: 90 },
    { name: 'nodejs/node', stars: 99000, velocity: 85 },
  ]
  
  listEl.innerHTML = sampleRepos.map((r, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''
    return `
      <div class="leaderboard-item">
        <div class="leaderboard-rank ${rankClass}">#${i + 1}</div>
        <div class="leaderboard-repo">
          <div style="width:36px;height:36px;background:var(--bg-elevated);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;">📁</div>
          <div>
            <div class="leaderboard-repo-name">${r.name}</div>
            <div class="leaderboard-repo-stats">⭐ ${fmtNumber(r.stars)}</div>
          </div>
        </div>
        <div class="leaderboard-score">
          <div class="leaderboard-score-value">${r.velocity}</div>
          <div class="leaderboard-score-label">Velocity</div>
        </div>
      </div>
    `
  }).join('')
}

// ─── Init ─────────────────────────────────────────────────────────────────────
checkURL()
