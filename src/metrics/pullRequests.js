/**
 * Pull Request metric calculations
 */

import { subDays, differenceInHours, isAfter, eachWeekOfInterval, startOfWeek, format } from 'date-fns'

const WINDOW_DAYS = 90

/**
 * Filter PRs to the analysis window
 */
function inWindow(pr, days = WINDOW_DAYS) {
  const cutoff = subDays(new Date(), days)
  const relevant = new Date(pr.updated_at || pr.created_at)
  return isAfter(relevant, cutoff)
}

/**
 * Core PR metrics for the window
 */
export function analyzePRs(prs) {
  const cutoff = subDays(new Date(), WINDOW_DAYS)
  const windowPRs = prs.filter(pr => inWindow(pr))

  const merged = windowPRs.filter(pr => pr.merged_at)
  const closed = windowPRs.filter(pr => pr.state === 'closed')
  const open = windowPRs.filter(pr => pr.state === 'open')

  // Merge time in hours
  const mergeTimes = merged.map(pr =>
    differenceInHours(new Date(pr.merged_at), new Date(pr.created_at))
  )
  const avgMergeTimeHours = mergeTimes.length > 0
    ? Math.round(mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length)
    : null

  const medianMergeTimeHours = mergeTimes.length > 0
    ? mergeTimes.sort((a, b) => a - b)[Math.floor(mergeTimes.length / 2)]
    : null

  // Merge rate
  const mergeRate = closed.length > 0
    ? Math.round((merged.length / closed.length) * 100)
    : null

  // PRs opened in window (by created_at)
  const opened = prs.filter(pr => isAfter(new Date(pr.created_at), cutoff))

  return {
    opened: opened.length,
    merged: merged.length,
    open: open.length,
    closed: closed.length,
    avgMergeTimeHours,
    medianMergeTimeHours,
    mergeRate,
  }
}

/**
 * PRs opened and merged per week for charting
 */
export function prsByWeek(prs, weeks = 13) {
  const now = new Date()
  const start = subDays(now, weeks * 7)
  const weekStarts = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 })

  const opened = new Map(weekStarts.map(w => [w.getTime(), 0]))
  const merged = new Map(weekStarts.map(w => [w.getTime(), 0]))

  for (const pr of prs) {
    const createdAt = new Date(pr.created_at)
    if (isAfter(createdAt, start)) {
      const week = startOfWeek(createdAt, { weekStartsOn: 1 })
      const key = week.getTime()
      if (opened.has(key)) opened.set(key, opened.get(key) + 1)
    }
    if (pr.merged_at) {
      const mergedAt = new Date(pr.merged_at)
      if (isAfter(mergedAt, start)) {
        const week = startOfWeek(mergedAt, { weekStartsOn: 1 })
        const key = week.getTime()
        if (merged.has(key)) merged.set(key, merged.get(key) + 1)
      }
    }
  }

  return weekStarts.map(w => ({
    week: w,
    label: format(w, 'MMM d'),
    opened: opened.get(w.getTime()) || 0,
    merged: merged.get(w.getTime()) || 0,
  }))
}

/**
 * Format merge time in human readable
 */
export function formatMergeTime(hours) {
  if (hours === null || hours === undefined) return 'N/A'
  if (hours < 1) return '< 1 hour'
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}
