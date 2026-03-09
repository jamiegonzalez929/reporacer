/**
 * Commit-related metric calculations
 */

import { startOfWeek, eachWeekOfInterval, format, subDays, isAfter, isBefore } from 'date-fns'

/**
 * Group commits by week (returns array of { week: Date, count: number })
 */
export function commitsByWeek(commits, weeks = 13) {
  const now = new Date()
  const start = subDays(now, weeks * 7)

  const weekStarts = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })
  const buckets = new Map(weekStarts.map(w => [w.getTime(), 0]))

  for (const commit of commits) {
    const date = new Date(commit.commit.author.date)
    if (isBefore(date, start)) continue
    const week = startOfWeek(date, { weekStartsOn: 1 })
    const key = week.getTime()
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1)
  }

  return Array.from(buckets.entries()).map(([ts, count]) => ({
    week: new Date(ts),
    label: format(new Date(ts), 'MMM d'),
    count,
  }))
}

/**
 * Commit heatmap: day-of-week × hour-of-day matrix
 * Returns a 7x24 grid of counts
 */
export function commitHeatmap(commits) {
  // [dayOfWeek][hour] = count; 0 = Sunday
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const commit of commits) {
    const date = new Date(commit.commit.author.date)
    grid[date.getDay()][date.getHours()]++
  }
  return grid
}

/**
 * Count unique contributors in a commit list
 */
export function uniqueContributors(commits) {
  const authors = new Set()
  for (const commit of commits) {
    const login = commit.author?.login || commit.commit?.author?.email
    if (login) authors.add(login)
  }
  return authors.size
}

/**
 * Commits per active day (days that had at least one commit)
 */
export function commitDensity(commits) {
  const days = new Set()
  for (const commit of commits) {
    const d = new Date(commit.commit.author.date)
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }
  return {
    activeDays: days.size,
    commitsPerActiveDay: days.size > 0 ? (commits.length / days.size).toFixed(1) : 0,
  }
}

/**
 * Top N active hours from commit history
 */
export function peakHours(commits, top = 3) {
  const hours = new Array(24).fill(0)
  for (const commit of commits) {
    hours[new Date(commit.commit.author.date).getHours()]++
  }
  return hours
    .map((count, hour) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top)
}
