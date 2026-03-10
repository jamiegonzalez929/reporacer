/**
 * Dashboard DOM renderer - Enhanced for multi-repo comparison
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

/**
 * Render velocity score cards for comparison view
 */
export function renderVelocityCards(data, repoKeys) {
  const container = document.getElementById('velocityCards')
  
  const sorted = repoKeys
    .filter(k => data[k] && !data[k].error)
    .sort((a, b) => (data[b].velocity?.score || 0) - (data[a].velocity?.score || 0))
  
  container.innerHTML = sorted.map((key, index) => {
    const d = data[key]
    const v = d.velocity
    const grade = v.grade?.cls || 'c'
    const rank = index + 1
    
    const dimensions = v.dimensions || {}
    const dimHTML = Object.entries(dimensions).slice(0, 4).map(([name, value]) => `
      <div class="velocity-dimension">
        <span>${name}</span>
        <div class="velocity-dimension-bar">
          <div class="velocity-dimension-fill" style="width: ${value}%"></div>
        </div>
        <span>${value}</span>
      </div>
    `).join('')
    
    return `
      <div class="velocity-card">
        <div class="velocity-card-header">
          <div class="velocity-card-repo">
            <img class="velocity-card-avatar" src="${d.repo.owner.avatar_url}" alt="${d.repo.owner.login}" />
            <span class="velocity-card-name">${key}</span>
          </div>
          <span class="velocity-card-rank">#${rank}</span>
        </div>
        <div class="velocity-card-score">
          <span class="velocity-card-number">${v.score}</span>
          <span class="velocity-card-grade ${grade}">${v.grade?.label || 'N/A'}</span>
        </div>
        <div class="velocity-card-label">Velocity Score</div>
        <div class="velocity-card-dimensions">
          ${dimHTML}
        </div>
      </div>
    `
  }).join('')
}

/**
 * Render comparison table for multiple repos
 */
export function renderComparison(data, repoKeys) {
  const section = document.getElementById('comparisonSection')
  const table = document.getElementById('comparisonTable')
  
  if (repoKeys.length < 2) {
    section.classList.add('hidden')
    return
  }
  
  section.classList.remove('hidden')
  
  const metrics = [
    { key: 'score', label: 'Velocity Score', get: (d) => d.velocity?.score || '—', positive: true },
    { key: 'commits', label: 'Commits (90d)', get: (d) => fmtNumber(d.commits?.total || 0) },
    { key: 'avgPerWeek', label: 'Avg/Week', get: (d) => d.commits?.avgPerWeek || '—' },
    { key: 'contributors', label: 'Contributors', get: (d) => d.commits?.uniqueContributors || '—' },
    { key: 'prsMerged', label: 'PRs Merged', get: (d) => fmtNumber(d.prs?.merged || 0) },
    { key: 'mergeRate', label: 'Merge Rate', get: (d) => d.prs?.mergeRate ? `${d.prs.mergeRate}%` : '—' },
    { key: 'mergeTime', label: 'Avg Merge Time', get: (d) => formatMergeTime(d.prs?.avgMergeTimeHours) },
    { key: 'issuesClosed', label: 'Issues Closed', get: (d) => fmtNumber(d.issues?.closed || 0) },
    { key: 'releaseCadence', label: 'Release Cadence', get: (d) => d.releases?.avgDaysBetween ? `${d.releases.avgDaysBetween}d` : 'N/A' },
    { key: 'busFactor', label: 'Bus Factor', get: (d) => d.leaderboard?.busFactor?.description || '—' },
  ]
  
  table.innerHTML = `
    <thead>
      <tr>
        <th>Metric</th>
        ${repoKeys.map(k => `
          <th>
            <div class="repo-cell">
              <img src="${data[k].repo.owner.avatar_url}" alt="${k}" />
              <span>${k}</span>
            </div>
          </th>
        `).join('')}
      </tr>
    </thead>
    <tbody>
      ${metrics.map(m => {
        const values = repoKeys.map(k => {
          const val = m.get(data[k])
          // Determine tone based on value
          let tone = 'metric-neutral'
          if (m.positive) {
            const num = parseInt(val) || 0
            if (num >= 80) tone = 'metric-positive'
            else if (num < 50) tone = 'metric-warning'
          }
          return { val, tone }
        })
        
        return `
          <tr>
            <td>${m.label}</td>
            ${values.map(v => `<td class="metric-cell ${v.tone}">${v.val}</td>`).join('')}
          </tr>
        `
      }).join('')}
    </tbody>
  `
}

/**
 * Render insights based on velocity data
 */
export function renderInsights(data, repoKeys) {
  const container = document.getElementById('insightsGrid')
  const section = document.getElementById('insightsSection')
  
  if (!container) return
  
  const insights = []
  
  for (const key of repoKeys) {
    const d = data[key]
    if (d.error || !d.velocity) continue
    
    const v = d.velocity
    const repoName = key.split('/')[1]
    
    // High velocity insight
    if (v.score >= 80) {
      insights.push({
        type: 'positive',
        icon: '🚀',
        title: `${repoName} is performing well`,
        text: `With a velocity score of ${v.score}, this repo demonstrates strong engineering practices across commits, PRs, and releases.`
      })
    }
    
    // Contributor diversity
    if (d.commits?.uniqueContributors >= 10) {
      insights.push({
        type: 'positive',
        icon: '👥',
        title: 'Strong contributor community',
        text: `${d.commits.uniqueContributors} active contributors in the last 90 days indicates a healthy, distributed codebase.`
      })
    } else if (d.commits?.uniqueContributors < 3) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Limited contributor diversity',
        text: `Only ${d.commits?.uniqueContributors || 0} active contributors. Consider strategies to onboard more maintainers.`
      })
    }
    
    // PR merge rate
    if (d.prs?.mergeRate >= 75) {
      insights.push({
        type: 'positive',
        icon: '✅',
        title: 'High PR merge rate',
        text: `${d.prs.mergeRate}% of PRs get merged, indicating efficient code review processes.`
      })
    }
    
    // Release cadence
    if (d.releases?.avgDaysBetween && d.releases.avgDaysBetween <= 14) {
      insights.push({
        type: 'positive',
        icon: '📦',
        title: 'Rapid release cycle',
        text: `Releases every ${d.releases.avgDaysBetween} days on average. This suggests strong CI/CD and deployment practices.`
      })
    }
    
    // Bus factor
    const busFactor = d.leaderboard?.busFactor?.value || 0
    if (busFactor <= 2) {
      insights.push({
        type: 'warning',
        icon: '🚌',
        title: 'Low bus factor',
        text: `Only ${busFactor} people understand the core code. Consider documenting critical systems and mentoring new contributors.`
      })
    }
  }
  
  // Comparison insights
  if (repoKeys.length > 1) {
    const scores = repoKeys.map(k => ({ key: k, score: data[k].velocity?.score || 0 }))
    scores.sort((a, b) => b.score - a.score)
    
    if (scores.length >= 2) {
      const winner = scores[0].key.split('/')[1]
      const loser = scores[scores.length - 1].key.split('/')[1]
      const diff = scores[0].score - scores[scores.length - 1].score
      
      insights.push({
        type: 'info',
        icon: '🏆',
        title: `${winner} leads the race`,
        text: `${winner} scores ${diff} points higher than ${loser} in overall velocity metrics.`
      })
    }
  }
  
  if (insights.length === 0) {
    insights.push({
      type: 'info',
      icon: '💡',
      title: 'Keep analyzing',
      text: 'Add more repositories to discover patterns and insights about engineering velocity.'
    })
  }
  
  section.classList.remove('hidden')
  container.innerHTML = insights.map(insight => `
    <div class="insight-card ${insight.type}">
      <div class="insight-icon">${insight.icon}</div>
      <div class="insight-title">${insight.title}</div>
      <div class="insight-text">${insight.text}</div>
    </div>
  `).join('')
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
