/**
 * Issue metric calculations
 */

import { subDays, differenceInHours, isAfter, eachWeekOfInterval, startOfWeek, format } from 'date-fns'

const WINDOW_DAYS = 90

/**
 * Core issue metrics
 */
export function analyzeIssues(issues) {
  const cutoff = subDays(new Date(), WINDOW_DAYS)

  const opened = issues.filter(i => isAfter(new Date(i.created_at), cutoff))
  const closed = issues.filter(i => i.closed_at && isAfter(new Date(i.closed_at), cutoff))
  const stillOpen = issues.filter(i => i.state === 'open')

  // Avg close time in hours
  const closeTimes = closed.map(i =>
    differenceInHours(new Date(i.closed_at), new Date(i.created_at))
  ).filter(h => h >= 0)

  const avgCloseTimeHours = closeTimes.length > 0
    ? Math.round(closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length)
    : null

  const medianCloseTime = closeTimes.length > 0
    ? [...closeTimes].sort((a, b) => a - b)[Math.floor(closeTimes.length / 2)]
    : null

  // Resolution rate
  const totalInWindow = opened.length
  const resolutionRate = totalInWindow > 0
    ? Math.round((closed.length / totalInWindow) * 100)
    : null

  return {
    opened: opened.length,
    closed: closed.length,
    open: stillOpen.length,
    avgCloseTimeHours,
    medianCloseTime,
    resolutionRate,
  }
}

/**
 * Issues opened and closed per week for charting
 */
export function issuesByWeek(issues, weeks = 13) {
  const now = new Date()
  const start = subDays(now, weeks * 7)
  const weekStarts = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })

  const opened = new Map(weekStarts.map(w => [w.getTime(), 0]))
  const closed = new Map(weekStarts.map(w => [w.getTime(), 0]))

  for (const issue of issues) {
    const createdAt = new Date(issue.created_at)
    if (isAfter(createdAt, start)) {
      const week = startOfWeek(createdAt, { weekStartsOn: 1 })
      const key = week.getTime()
      if (opened.has(key)) opened.set(key, opened.get(key) + 1)
    }
    if (issue.closed_at) {
      const closedAt = new Date(issue.closed_at)
      if (isAfter(closedAt, start)) {
        const week = startOfWeek(closedAt, { weekStartsOn: 1 })
        const key = week.getTime()
        if (closed.has(key)) closed.set(key, closed.get(key) + 1)
      }
    }
  }

  return weekStarts.map(w => ({
    week: w,
    label: format(w, 'MMM d'),
    opened: opened.get(w.getTime()) || 0,
    closed: closed.get(w.getTime()) || 0,
  }))
}

/**
 * Format hours into human-readable close time
 */
export function formatCloseTime(hours) {
  if (hours === null || hours === undefined) return 'N/A'
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.round(days / 30)}mo`
}
