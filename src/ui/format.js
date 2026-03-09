/**
 * Formatting utilities
 */

export function formatNumber(n) {
  if (n == null) return '?'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n)
}

export function daysColor(days) {
  if (days <= 14) return 'green'
  if (days <= 60) return 'yellow'
  if (days <= 180) return 'orange'
  return 'red'
}

export function pctColor(pct, lowerIsBetter = false) {
  if (lowerIsBetter) {
    if (pct <= 30) return 'green'
    if (pct <= 50) return 'yellow'
    if (pct <= 70) return 'orange'
    return 'red'
  }
  if (pct >= 70) return 'green'
  if (pct >= 40) return 'yellow'
  return 'red'
}
