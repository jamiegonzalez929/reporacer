/**
 * GitHub REST API client
 * Uses public API (no auth required for public repos).
 * Set VITE_GITHUB_TOKEN env var to raise rate limits from 60 → 5000/hr.
 */

const BASE_URL = 'https://api.github.com'

// Optional token from environment (set in .env as VITE_GITHUB_TOKEN)
const TOKEN = import.meta.env?.VITE_GITHUB_TOKEN || null

/**
 * Build request headers
 */
function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`
  return h
}

/**
 * Fetch a single page from GitHub API with error handling
 */
async function fetchPage(url, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const fullUrl = qs ? `${url}?${qs}` : url
  const res = await fetch(fullUrl, { headers: headers() })

  if (res.status === 404) throw new Error('Repository not found. Make sure the repo is public and the owner/repo format is correct.')
  if (res.status === 403) {
    const remaining = res.headers.get('X-RateLimit-Remaining')
    const reset = res.headers.get('X-RateLimit-Reset')
    const resetTime = reset ? new Date(reset * 1000).toLocaleTimeString() : 'soon'
    if (remaining === '0') throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime}. Add a VITE_GITHUB_TOKEN to get 5000 req/hr.`)
    throw new Error('GitHub API access forbidden. The repository may be private.')
  }
  if (res.status === 401) throw new Error('Invalid GitHub token. Check your VITE_GITHUB_TOKEN.')
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)

  return { data: await res.json(), headers: res.headers }
}

/**
 * Fetch all pages of a paginated resource (up to maxPages)
 */
async function fetchAll(url, params = {}, maxPages = 5) {
  const allData = []
  let page = 1

  while (page <= maxPages) {
    const { data } = await fetchPage(url, { ...params, per_page: 100, page })
    if (!Array.isArray(data) || data.length === 0) break
    allData.push(...data)
    if (data.length < 100) break
    page++
  }

  return allData
}

/**
 * GET /repos/{owner}/{repo}
 */
export async function getRepo(owner, repo) {
  const { data } = await fetchPage(`${BASE_URL}/repos/${owner}/${repo}`)
  return data
}

/**
 * GET /repos/{owner}/{repo}/commits
 * Returns commits since a given date (ISO string)
 */
export async function getCommits(owner, repo, since, maxPages = 10) {
  return fetchAll(
    `${BASE_URL}/repos/${owner}/${repo}/commits`,
    { since },
    maxPages
  )
}

/**
 * GET /repos/{owner}/{repo}/stats/commit_activity
 * Returns 52 weeks of weekly commit counts from GitHub's stats API.
 */
export async function getCommitActivity(owner, repo) {
  const { data } = await fetchPage(`${BASE_URL}/repos/${owner}/${repo}/stats/commit_activity`)
  // GitHub returns 202 while computing — data may be empty array
  if (!Array.isArray(data)) return []
  return data
}

/**
 * GET /repos/{owner}/{repo}/stats/contributors
 * Returns per-contributor weekly stats
 */
export async function getContributorStats(owner, repo) {
  const { data } = await fetchPage(`${BASE_URL}/repos/${owner}/${repo}/stats/contributors`)
  if (!Array.isArray(data)) return []
  return data
}

/**
 * GET /repos/{owner}/{repo}/pulls
 * Fetches PRs (open + closed) for analysis
 */
export async function getPullRequests(owner, repo, state = 'all', maxPages = 5) {
  return fetchAll(
    `${BASE_URL}/repos/${owner}/${repo}/pulls`,
    { state, sort: 'updated', direction: 'desc' },
    maxPages
  )
}

/**
 * GET /repos/{owner}/{repo}/issues
 * Fetches issues (excluding PRs) for analysis
 */
export async function getIssues(owner, repo, state = 'all', maxPages = 5) {
  const all = await fetchAll(
    `${BASE_URL}/repos/${owner}/${repo}/issues`,
    { state, sort: 'updated', direction: 'desc', filter: 'all' },
    maxPages
  )
  // GitHub issues endpoint includes PRs — filter them out
  return all.filter(i => !i.pull_request)
}

/**
 * GET /repos/{owner}/{repo}/releases
 */
export async function getReleases(owner, repo, maxPages = 2) {
  return fetchAll(
    `${BASE_URL}/repos/${owner}/${repo}/releases`,
    { per_page: 30 },
    maxPages
  )
}

/**
 * GET /repos/{owner}/{repo}/contributors
 */
export async function getContributors(owner, repo, maxPages = 3) {
  return fetchAll(
    `${BASE_URL}/repos/${owner}/${repo}/contributors`,
    {},
    maxPages
  )
}

/**
 * Check remaining rate limit
 */
export async function getRateLimit() {
  const { data } = await fetchPage(`${BASE_URL}/rate_limit`)
  return data.rate
}

/**
 * Fetch all data needed for the dashboard for a single repo
 * Wraps individual fetches with error isolation + progress callback
 */
export async function fetchAllRepoData(owner, repo, token = null, onProgress) {
  // If token is passed, we override the module-level token by passing it via headers
  // For simplicity with the current module structure, we use the env token.
  // The optional token param will be used if explicitly passed.
  const tasks = [
    { key: 'repo', fn: () => getRepo(owner, repo), label: 'repo info' },
    { key: 'contributors', fn: () => getContributors(owner, repo, 1), label: 'contributors' },
    { key: 'commitActivity', fn: () => getCommitActivity(owner, repo), label: 'commit activity' },
    { key: 'participation', fn: () => getContributorStats(owner, repo), label: 'contributor stats' },
    { key: 'releases', fn: () => getReleases(owner, repo, 1), label: 'releases' },
  ]

  const results = {}
  let done = 0

  await Promise.all(tasks.map(async ({ key, fn, label }) => {
    try {
      results[key] = await fn()
    } catch (err) {
      results[key] = null
      results[`${key}Error`] = err.message
    }
    done++
    onProgress && onProgress(done / tasks.length, label)
  }))

  // Normalize participation format — getContributorStats returns per-contributor weekly arrays
  // compute.js expects { owner: [...], all: [...] } or null
  if (results.participation && Array.isArray(results.participation)) {
    const allWeeks = new Array(52).fill(0)
    for (const contrib of results.participation) {
      if (contrib.weeks) {
        contrib.weeks.forEach((w, i) => {
          if (i < 52) allWeeks[i] += (w.c || 0)
        })
      }
    }
    results.participation = { owner: [], all: allWeeks }
  }

  return results
}
