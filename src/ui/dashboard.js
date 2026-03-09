/**
 * Dashboard DOM renderer
 */

import { fmtNumber } from '../metrics/score.js'
import { formatMergeTime } from '../metrics/pullRequests.js'
import { formatCloseTime } from '../metrics/issues.js'
import {
  renderCommitChart,
  renderPRChart,
  renderIssueChart,
  renderContributorChart,
  renderRadarChart,
  destroyAll,
} from './charts.js'

/**
 * Render the full dashboard given the aggregated data object
 */
export function renderDashboard(data) {
  destroyAll()
  renderRepoHeader(data.repo)
  renderVelocityScore(data.velocity)
  renderKPIs(data)
  renderCharts(data)
  renderContributors(data.leaderboard)
  renderPRHealth(data.prs)
  renderReleases(data.releases)
  renderHeatmap(data.heatmap)
}

// ----- Repo Header -----
function renderRepoHeader(repo) {
  document.getElementById('repoAvatar').src = repo.owner.avatar_url
  document.getElementById('repoAvatar').alt = repo.owner.login
  document.getElementById('repoName').textContent = repo.full_name
  document.getElementById('repoDescription').textContent = repo.description || 'No description'
  document.getElementById('repoLink').href = repo.html_url
  document.getElementById('statStars').textContent = fmtNumber(repo.stargazers_count)
  document.getElementById('statForks').textContent = fmtNumber(repo.forks_count)
  document.getElementById('statWatchers').textContent = fmtNumber(repo.watchers_count)

  const tagsEl = document.getElementById('repoTags')
  tagsEl.innerHTML = ''
  const tags = [repo.language, repo.license?.spdx_id].filter(Boolean)
  for (const tag of tags) {
    const span = document.createElement('span')
    span.className = 'repo-tag'
    span.textContent = tag
    tagsEl.appendChild(span)
  }
}

// ----- Velocity Score -----
function renderVelocityScore({ score, grade, dimensions, description }) {
  document.getElementById('velocityScore').textContent = score
  const gradeEl = document.getElementById('velocityGrade')
  gradeEl.textContent = grade.label
  gradeEl.className = `velocity-grade ${grade.cls}`
  document.getElementById('velocityDescription').textContent = description
  renderRadarChart('velocityRadar', dimensions)
}

// ----- KPI Cards -----
function renderKPIs(data) {
  const { commits, prs, issues, releases, repo } = data

  const kpis = [
    {
      icon: '📦',
      value: fmtNumber(commits.total),
      label: 'Commits (90d)',
      tone: commits.total > 100 ? 'positive' : commits.total > 20 ? 'neutral' : 'warning',
    },
    {
      icon: '⚡',
      value: commits.avgPerWeek,
      label: 'Avg Commits / Week',
      tone: commits.avgPerWeek >= 10 ? 'positive' : commits.avgPerWeek >= 3 ? 'neutral' : 'warning',
    },
    {
      icon: '🗓',
      value: commits.activeDays,
      label: 'Active Days (90d)',
      tone: commits.activeDays > 60 ? 'positive' : commits.activeDays > 20 ? 'neutral' : 'warning',
    },
    {
      icon: '👥',
      value: commits.uniqueContributors,
      label: 'Active Contributors',
      tone: commits.uniqueContributors >= 5 ? 'positive' : commits.uniqueContributors >= 2 ? 'neutral' : 'warning',
    },
    {
      icon: '🔀',
      value: fmtNumber(prs.merged),
      label: 'PRs Merged (90d)',
      tone: prs.merged > 20 ? 'positive' : prs.merged > 5 ? 'neutral' : 'warning',
    },
    {
      icon: '⏱',
      value: formatMergeTime(prs.avgMergeTimeHours),
      label: 'Avg PR Merge Time',
      tone: (prs.avgMergeTimeHours ?? 999) < 24 ? 'positive' : (prs.avgMergeTimeHours ?? 999) < 72 ? 'neutral' : 'warning',
    },
    {
      icon: '✅',
      value: prs.mergeRate != null ? `${prs.mergeRate}%` : 'N/A',
      label: 'PR Merge Rate',
      tone: (prs.mergeRate ?? 0) >= 75 ? 'positive' : (prs.mergeRate ?? 0) >= 50 ? 'neutral' : 'warning',
    },
    {
      icon: '🐛',
      value: fmtNumber(issues.open),
      label: 'Open Issues',
      tone: (issues.open ?? 0) < 50 ? 'positive' : (issues.open ?? 0) < 200 ? 'neutral' : 'warning',
    },
    {
      icon: '🔒',
      value: fmtNumber(issues.closed),
      label: 'Issues Closed (90d)',
      tone: issues.closed > 20 ? 'positive' : issues.closed > 5 ? 'neutral' : 'warning',
    },
    {
      icon: '🕐',
      value: formatCloseTime(issues.avgCloseTimeHours),
      label: 'Avg Issue Close Time',
      tone: (issues.avgCloseTimeHours ?? 999) < 72 ? 'positive' : (issues.avgCloseTimeHours ?? 999) < 240 ? 'neutral' : 'warning',
    },
    {
      icon: '🚀',
      value: releases.total > 0 ? fmtNumber(releases.total) : 'None',
      label: 'Total Releases',
      tone: releases.total > 5 ? 'positive' : releases.total > 0 ? 'neutral' : 'warning',
    },
    {
      icon: '📅',
      value: releases.avgDaysBetween != null ? `${releases.avgDaysBetween}d` : 'N/A',
      label: 'Avg Days Between Releases',
      tone: (releases.avgDaysBetween ?? 999) <= 14 ? 'positive' : (releases.avgDaysBetween ?? 999) <= 30 ? 'neutral' : 'warning',
    },
  ]

  const grid = document.getElementById('kpiGrid')
  grid.innerHTML = kpis.map(kpi => `
    <div class="kpi-card ${kpi.tone}">
      <span class="kpi-icon">${kpi.icon}</span>
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-label">${kpi.label}</div>
    </div>
  `).join('')
}

// ----- Charts -----
function renderCharts({ commitWeeks, prWeeks, issueWeeks, contributorWeeks }) {
  renderCommitChart('commitChart', commitWeeks)
  renderPRChart('prChart', prWeeks)
  renderIssueChart('issueChart', issueWeeks)
  renderContributorChart('contributorChart', contributorWeeks)
}

// ----- Contributors -----
function renderContributors({ top, busFactor }) {
  const listEl = document.getElementById('contributorList')
  const maxCommits = top[0]?.commits || 1

  listEl.innerHTML = top.map(c => `
    <div class="contributor-row">
      ${c.avatar
        ? `<img class="contributor-avatar" src="${c.avatar}" alt="${c.login}" loading="lazy" />`
        : `<div class="contributor-avatar" style="background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:14px">👤</div>`
      }
      <div class="contributor-info">
        <div class="contributor-name">${c.login}</div>
        <div class="contributor-bar-wrap">
          <div class="contributor-bar" style="width: ${Math.round((c.commits / maxCommits) * 100)}%"></div>
        </div>
      </div>
      <div class="contributor-commits">${fmtNumber(c.commits)}</div>
      <div class="contributor-pct">${c.pct}%</div>
    </div>
  `).join('')

  document.getElementById('busFactor').innerHTML = `
    <div class="bus-factor-label">Bus Factor</div>
    <div class="bus-factor-value">${busFactor.description || '—'}</div>
  `
}

// ----- PR Health -----
function renderPRHealth(prs) {
  const rows = [
    { label: 'Open PRs', value: fmtNumber(prs.open) },
    { label: 'PRs Opened (90d)', value: fmtNumber(prs.opened) },
    { label: 'PRs Merged (90d)', value: fmtNumber(prs.merged) },
    { label: 'Merge Rate', value: prs.mergeRate != null ? `${prs.mergeRate}%` : 'N/A' },
    { label: 'Avg Merge Time', value: formatMergeTime(prs.avgMergeTimeHours) },
    { label: 'Median Merge Time', value: formatMergeTime(prs.medianMergeTimeHours) },
  ]

  document.getElementById('prHealth').innerHTML = rows.map(r => `
    <div class="health-row">
      <span class="health-label">${r.label}</span>
      <span class="health-value">${r.value}</span>
    </div>
  `).join('')
}

// ----- Releases -----
function renderReleases(releases) {
  const el = document.getElementById('releaseTimeline')

  if (!releases || releases.total === 0) {
    el.innerHTML = '<div class="release-empty">No releases found. The project may publish via npm, PyPI, or other channels.</div>'
    return
  }

  el.innerHTML = `
    <div class="releases-list">
      ${releases.items.map(r => `
        <div class="release-item">
          <div class="release-dot"></div>
          <div class="release-info">
            <div class="release-name">
              <a href="${r.url}" target="_blank" rel="noopener">${r.name}</a>
              ${r.prerelease ? '<span class="repo-tag" style="margin-left:8px">pre-release</span>' : ''}
            </div>
            <div class="release-date">${r.dateFormatted}</div>
          </div>
          ${r.gap ? `<div class="release-gap">${r.gap}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="release-summary">
      <div class="release-summary-item">
        <div class="release-summary-value">${releases.total}</div>
        <div class="release-summary-label">Total Releases</div>
      </div>
      <div class="release-summary-item">
        <div class="release-summary-value">${releases.last6Months}</div>
        <div class="release-summary-label">Last 6 months</div>
      </div>
      ${releases.avgDaysBetween != null ? `
        <div class="release-summary-item">
          <div class="release-summary-value">${releases.avgDaysBetween}d</div>
          <div class="release-summary-label">Avg gap</div>
        </div>
      ` : ''}
      ${releases.lastReleaseAgo ? `
        <div class="release-summary-item">
          <div class="release-summary-value" style="font-size:0.85rem">${releases.lastReleaseAgo}</div>
          <div class="release-summary-label">Last release</div>
        </div>
      ` : ''}
    </div>
  `
}

// ----- Commit Heatmap -----
export function renderHeatmap(grid) {
  const el = document.getElementById('commitHeatmap')
  if (!grid || !el) return

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const maxVal = Math.max(...grid.flat(), 1)

  function cellColor(count) {
    if (count === 0) return 'var(--bg-elevated)'
    const intensity = count / maxVal
    // Purple → Teal gradient
    const r = Math.round(99 + (56 - 99) * intensity)
    const g = Math.round(120 + (217 - 120) * intensity)
    const b = Math.round(255 + (169 - 255) * intensity)
    return `rgba(${r},${g},${b},${0.2 + intensity * 0.8})`
  }

  const hoursHTML = Array.from({ length: 24 }, (_, h) =>
    `<div class="heatmap-hour-label">${h === 0 ? '12am' : h === 12 ? '12pm' : h > 12 ? `${h - 12}p` : `${h}a`}</div>`
  ).join('')

  const rowsHTML = days.map((day, d) => `
    <div class="heatmap-day-label">${day}</div>
    ${Array.from({ length: 24 }, (_, h) => {
      const count = grid[d][h]
      return `<div class="heatmap-cell" style="background:${cellColor(count)}" title="${count} commits at ${day} ${h}:00"></div>`
    }).join('')}
  `).join('')

  el.innerHTML = `
    <div class="heatmap-grid">
      <div></div>
      <div class="heatmap-header">${hoursHTML}</div>
      ${rowsHTML}
    </div>
    <div class="heatmap-legend">
      <span>Less</span>
      <div class="heatmap-legend-cells">
        ${[0, 0.2, 0.4, 0.7, 1].map(i => {
          const c = Math.round(i * maxVal)
          return `<div class="heatmap-legend-cell" style="background:${cellColor(c)}"></div>`
        }).join('')}
      </div>
      <span>More</span>
    </div>
  `
}
