/**
 * Contributor and bus factor metrics
 */

import { subDays, isAfter, eachWeekOfInterval, startOfWeek, format } from 'date-fns'

const WINDOW_DAYS = 90

/**
 * Build contributor leaderboard from raw commit list
 */
export function buildContributorLeaderboard(commits, limit = 10) {
  const counts = new Map()

  for (const commit of commits) {
    const login = commit.author?.login || commit.commit?.author?.email || 'unknown'
    const avatar = commit.author?.avatar_url || null
    const existing = counts.get(login) || { login, avatar, commits: 0 }
    existing.commits++
    counts.set(login, existing)
  }

  const sorted = Array.from(counts.values()).sort((a, b) => b.commits - a.commits)
  const total = sorted.reduce((sum, c) => sum + c.commits, 0)

  return sorted.slice(0, limit).map(c => ({
    ...c,
    pct: total > 0 ? Math.round((c.commits / total) * 100) : 0,
  }))
}

/**
 * Bus factor: fewest contributors whose combined commits exceed 50% of total
 */
export function calcBusFactor(leaderboard) {
  const total = leaderboard.reduce((sum, c) => sum + c.commits, 0)
  if (total === 0) return { factor: 0, pct: 0 }

  let cumulative = 0
  let count = 0

  for (const c of leaderboard) {
    cumulative += c.commits
    count++
    if (cumulative / total >= 0.5) break
  }

  return {
    factor: count,
    pct: Math.round((cumulative / total) * 100),
    description: count === 1
      ? '⚠️ High risk: 1 contributor drives >50% of commits'
      : count <= 2
      ? '⚠️ Moderate risk: 2 contributors drive >50% of commits'
      : `✅ Healthy: ${count} contributors share the load`,
  }
}

/**
 * Active contributors per week (from commit list)
 */
export function contributorsByWeek(commits, weeks = 13) {
  const now = new Date()
  const start = subDays(now, weeks * 7)
  const weekStarts = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })

  const buckets = new Map(weekStarts.map(w => [w.getTime(), new Set()]))

  for (const commit of commits) {
    const date = new Date(commit.commit.author.date)
    if (!isAfter(date, start)) continue
    const week = startOfWeek(date, { weekStartsOn: 1 })
    const key = week.getTime()
    const login = commit.author?.login || commit.commit?.author?.email
    if (buckets.has(key) && login) buckets.get(key).add(login)
  }

  return weekStarts.map(w => ({
    week: w,
    label: format(w, 'MMM d'),
    count: buckets.get(w.getTime())?.size || 0,
  }))
}
