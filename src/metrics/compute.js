/**
 * Compute derived metrics from raw GitHub API data
 */

import { differenceInDays, parseISO, formatDistanceToNow } from 'date-fns'

export function computeMetrics(raw) {
  const { repo, contributors, commitActivity, participation, releases } = raw

  if (!repo) return null

  const now = new Date()
  const createdAt = parseISO(repo.created_at)
  const pushedAt = parseISO(repo.pushed_at)
  const updatedAt = parseISO(repo.updated_at)

  const agedays = differenceInDays(now, createdAt)
  const daysSincePush = differenceInDays(now, pushedAt)
  const daysSinceUpdate = differenceInDays(now, updatedAt)

  // --- Commit velocity ---
  let weeklyCommits = []
  let totalCommits52w = 0
  let avgWeeklyCommits = 0
  let recentCommitVelocity = 0 // last 4 weeks avg

  if (commitActivity && Array.isArray(commitActivity)) {
    weeklyCommits = commitActivity.map(w => w.total)
    totalCommits52w = weeklyCommits.reduce((a, b) => a + b, 0)
    avgWeeklyCommits = totalCommits52w / 52
    const last4 = weeklyCommits.slice(-4)
    recentCommitVelocity = last4.reduce((a, b) => a + b, 0) / 4
  }

  // --- Participation ---
  let ownerParticipation = []
  let allParticipation = []
  if (participation) {
    ownerParticipation = participation.owner || []
    allParticipation = participation.all || []
  }

  // --- Contributors & bus factor proxy ---
  let totalContributors = repo.network_count || 0
  let busFactor = '?'
  let top1Pct = 0
  let top3Pct = 0

  if (contributors && Array.isArray(contributors) && contributors.length > 0) {
    const totalCommitsByContribs = contributors.reduce((a, c) => a + c.contributions, 0)
    if (totalCommitsByContribs > 0) {
      top1Pct = Math.round((contributors[0].contributions / totalCommitsByContribs) * 100)
      const top3Total = contributors.slice(0, 3).reduce((a, c) => a + c.contributions, 0)
      top3Pct = Math.round((top3Total / totalCommitsByContribs) * 100)
    }
    // Bus factor: rough proxy — how many contributors needed to reach 50% of commits
    let cumulative = 0
    let bf = 0
    for (const c of contributors) {
      cumulative += c.contributions
      bf++
      if (cumulative / (totalCommitsByContribs || 1) >= 0.5) break
    }
    busFactor = bf
  }

  // --- Releases ---
  let latestRelease = null
  let releaseCount = 0
  let daysSinceRelease = null
  if (releases && Array.isArray(releases) && releases.length > 0) {
    releaseCount = releases.length
    latestRelease = releases[0]
    daysSinceRelease = differenceInDays(now, parseISO(latestRelease.published_at))
  }

  // --- Stars growth rate ---
  const starsPerDay = agedays > 0 ? (repo.stargazers_count / agedays).toFixed(2) : 0

  // --- Health score (0-100) ---
  const healthScore = computeHealthScore({
    daysSincePush,
    avgWeeklyCommits,
    recentCommitVelocity,
    top1Pct,
    openIssues: repo.open_issues_count,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    daysSinceRelease,
  })

  return {
    // Basics
    name: repo.full_name,
    description: repo.description,
    language: repo.language,
    license: repo.license?.spdx_id || null,
    homepage: repo.homepage,
    topics: repo.topics || [],
    archived: repo.archived,

    // Size
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.subscribers_count,
    openIssues: repo.open_issues_count,
    size: repo.size,

    // Time
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    agedays,
    daysSincePush,
    daysSinceUpdate,
    createdAgo: formatDistanceToNow(createdAt, { addSuffix: true }),
    pushedAgo: formatDistanceToNow(pushedAt, { addSuffix: true }),

    // Velocity
    weeklyCommits,
    totalCommits52w,
    avgWeeklyCommits: Math.round(avgWeeklyCommits * 10) / 10,
    recentCommitVelocity: Math.round(recentCommitVelocity * 10) / 10,
    ownerParticipation,
    allParticipation,

    // Contributors
    contributorCount: contributors?.length || 0,
    busFactor,
    top1Pct,
    top3Pct,
    topContributors: (contributors || []).slice(0, 5),

    // Releases
    latestRelease,
    releaseCount,
    daysSinceRelease,

    // Stars growth
    starsPerDay: parseFloat(starsPerDay),

    // Score
    healthScore,
  }
}

function computeHealthScore({ daysSincePush, avgWeeklyCommits, recentCommitVelocity, top1Pct, openIssues, stars, forks, daysSinceRelease }) {
  let score = 50 // baseline

  // Activity recency (up to +25)
  if (daysSincePush <= 7) score += 25
  else if (daysSincePush <= 30) score += 18
  else if (daysSincePush <= 90) score += 10
  else if (daysSincePush <= 180) score += 4
  else score -= 10

  // Commit velocity (up to +15)
  if (avgWeeklyCommits >= 10) score += 15
  else if (avgWeeklyCommits >= 5) score += 10
  else if (avgWeeklyCommits >= 2) score += 6
  else if (avgWeeklyCommits >= 0.5) score += 2
  else score -= 5

  // Recent velocity vs avg (momentum signal)
  if (recentCommitVelocity > avgWeeklyCommits * 1.5) score += 5
  else if (recentCommitVelocity < avgWeeklyCommits * 0.5) score -= 5

  // Bus factor risk (-15 to 0)
  if (top1Pct > 80) score -= 15
  else if (top1Pct > 60) score -= 8
  else if (top1Pct > 40) score -= 3

  // Community signal (up to +10)
  if (stars > 10000) score += 10
  else if (stars > 1000) score += 6
  else if (stars > 100) score += 3

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function scoreColor(score) {
  if (score >= 75) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  if (score >= 25) return '#f97316'
  return '#ef4444'
}

export function scoreLabel(score) {
  if (score >= 75) return 'Healthy'
  if (score >= 50) return 'Active'
  if (score >= 25) return 'Slow'
  return 'Stale'
}
