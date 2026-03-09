/**
 * Release / deployment cadence metrics
 */

import { differenceInDays, formatDistanceToNow, format } from 'date-fns'

/**
 * Analyze release cadence
 */
export function analyzeReleases(releases) {
  if (!releases || releases.length === 0) {
    return {
      total: 0,
      avgDaysBetween: null,
      releasesPerMonth: null,
      lastReleaseAgo: null,
      items: [],
    }
  }

  const sorted = [...releases].sort((a, b) =>
    new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)
  )

  const last6Months = sorted.filter(r => {
    const d = new Date(r.published_at || r.created_at)
    return d > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
  })

  // Gap between releases
  const gaps = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = new Date(sorted[i].published_at || sorted[i].created_at)
    const b = new Date(sorted[i + 1].published_at || sorted[i + 1].created_at)
    gaps.push(differenceInDays(a, b))
  }

  const avgDaysBetween = gaps.length > 0
    ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    : null

  const lastRelease = sorted[0]
  const lastReleaseDate = lastRelease
    ? new Date(lastRelease.published_at || lastRelease.created_at)
    : null
  const lastReleaseAgo = lastReleaseDate
    ? formatDistanceToNow(lastReleaseDate, { addSuffix: true })
    : null

  const items = sorted.slice(0, 10).map((r, i) => ({
    name: r.tag_name || r.name || `v${i}`,
    date: new Date(r.published_at || r.created_at),
    dateFormatted: format(new Date(r.published_at || r.created_at), 'MMM d, yyyy'),
    gap: gaps[i] != null ? `${gaps[i]}d gap` : null,
    prerelease: r.prerelease,
    url: r.html_url,
  }))

  return {
    total: releases.length,
    last6Months: last6Months.length,
    avgDaysBetween,
    releasesPerMonth: avgDaysBetween ? (30 / avgDaysBetween).toFixed(1) : null,
    lastReleaseAgo,
    items,
  }
}
