/**
 * Repo Velocity — Main Application Entry
 *
 * Orchestrates: input → fetch → compute → render
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
import { renderDashboard } from './ui/dashboard.js'

// ─── State ───────────────────────────────────────────────────────────────────
let currentRepo = null

// ─── DOM Elements ─────────────────────────────────────────────────────────────
const hero = document.getElementById('hero')
const loadingScreen = document.getElementById('loadingScreen')
const errorScreen = document.getElementById('errorScreen')
const dashboard = document.getElementById('dashboard')
const searchForm = document.getElementById('searchForm')
const repoInput = document.getElementById('repoInput')
const searchBtn = document.getElementById('searchBtn')
const errorTitle = document.getElementById('errorTitle')
const errorMessage = document.getElementById('errorMessage')
const errorRetry = document.getElementById('errorRetry')
const newSearchBtn = document.getElementById('newSearchBtn')
const loadingTitle = document.getElementById('loadingTitle')

// ─── Example chips ────────────────────────────────────────────────────────────
document.querySelectorAll('.example-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    repoInput.value = chip.dataset.repo
    repoInput.focus()
  })
})

// ─── Search form ──────────────────────────────────────────────────────────────
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const raw = repoInput.value.trim()
  if (!raw) return

  // Accept "owner/repo" or full GitHub URL
  const match = raw.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s?#]+)/)
  if (!match) {
    showError('Invalid format', 'Please enter a repo in the format owner/repo — for example: vercel/next.js')
    return
  }

  const [, owner, repo] = match
  await analyzeRepo(owner, repo.replace(/\.git$/, ''))
})

// ─── Back to search ───────────────────────────────────────────────────────────
function backToSearch() {
  show('hero')
  repoInput.value = currentRepo || ''
  repoInput.focus()
}

errorRetry.addEventListener('click', backToSearch)
newSearchBtn.addEventListener('click', backToSearch)

// ─── URL routing ──────────────────────────────────────────────────────────────
function checkURL() {
  const params = new URLSearchParams(window.location.search)
  const repo = params.get('repo') || params.get('r')
  if (repo) {
    const match = repo.match(/^([^/]+)\/([^/]+)$/)
    if (match) {
      repoInput.value = repo
      analyzeRepo(match[1], match[2])
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
let currentStep = 0

function setStep(stepId) {
  const idx = STEPS.indexOf(stepId)
  STEPS.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`)
    if (!el) return
    if (i < idx) el.className = 'loading-step done'
    else if (i === idx) el.className = 'loading-step active'
    else el.className = 'loading-step'
  })
  // Reset symbols
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

// ─── Core analysis pipeline ───────────────────────────────────────────────────
async function analyzeRepo(owner, repo) {
  currentRepo = `${owner}/${repo}`
  loadingTitle.textContent = `Analyzing ${owner}/${repo}…`
  show('loading')
  searchBtn.disabled = true

  // Update URL without reload
  const url = new URL(window.location.href)
  url.searchParams.set('repo', `${owner}/${repo}`)
  window.history.pushState({}, '', url)

  try {
    const since = subDays(new Date(), 90).toISOString()

    // ── Step 1: Repo info ──
    setStep('repo')
    const repoData = await getRepo(owner, repo)

    // ── Step 2: Commits ──
    setStep('commits')
    const commits = await getCommits(owner, repo, since)

    // ── Step 3: Pull Requests ──
    setStep('prs')
    const pullRequests = await getPullRequests(owner, repo, 'all', 5)

    // ── Step 4: Issues ──
    setStep('issues')
    const issues = await getIssues(owner, repo, 'all', 5)

    // ── Step 5: Contributors (derived from commits) ──
    setStep('contributors')
    const leaderboardTop = buildContributorLeaderboard(commits)
    const busFactor = calcBusFactor(leaderboardTop)

    // ── Step 6: Releases ──
    setStep('releases')
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

    // ── Render ──
    renderDashboard({
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
    })

    show('dashboard')
    window.scrollTo({ top: 0, behavior: 'smooth' })

  } catch (err) {
    console.error('[repo-velocity]', err)
    showError('Analysis failed', err.message || 'Unknown error. Please try again.')
  } finally {
    searchBtn.disabled = false
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
checkURL()
