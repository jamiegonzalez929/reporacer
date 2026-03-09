/**
 * Chart.js chart builders
 */
import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

Chart.register(
  BarController, BarElement,
  LineController, LineElement, PointElement,
  RadarController, RadialLinearScale,
  LinearScale, CategoryScale,
  Filler, Tooltip, Legend
)

const ACCENT = '#6378ff'
const ACCENT2 = '#38d9a9'
const GREEN = '#51cf66'
const ORANGE = '#ff922b'
const DANGER = '#ff6b6b'
const TEXT_SECONDARY = '#8892a4'
const GRID = 'rgba(255,255,255,0.05)'

Chart.defaults.color = TEXT_SECONDARY
Chart.defaults.borderColor = GRID
Chart.defaults.font.family = "'Inter', system-ui, sans-serif"

const registry = new Map()

function destroy(id) {
  if (registry.has(id)) {
    registry.get(id).destroy()
    registry.delete(id)
  }
}

function register(id, chart) {
  destroy(id)
  registry.set(id, chart)
}

/**
 * Commit activity bar chart
 */
export function renderCommitChart(canvasId, weeks) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        label: 'Commits',
        data: weeks.map(w => w.count),
        backgroundColor: weeks.map(w => `rgba(99, 120, 255, ${0.3 + (w.count / Math.max(...weeks.map(x => x.count), 1)) * 0.7})`),
        borderColor: ACCENT,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: baseOptions('commits'),
  })
  register(canvasId, chart)
  return chart
}

/**
 * PR throughput grouped bar chart
 */
export function renderPRChart(canvasId, weeks) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [
        {
          label: 'Opened',
          data: weeks.map(w => w.opened),
          backgroundColor: 'rgba(99, 120, 255, 0.5)',
          borderColor: ACCENT,
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Merged',
          data: weeks.map(w => w.merged),
          backgroundColor: 'rgba(56, 217, 169, 0.5)',
          borderColor: ACCENT2,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: { ...baseOptions('count'), plugins: { ...baseOptions().plugins, legend: { display: true, labels: { color: TEXT_SECONDARY, boxWidth: 12 } } } },
  })
  register(canvasId, chart)
  return chart
}

/**
 * Issue resolution line chart
 */
export function renderIssueChart(canvasId, weeks) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [
        {
          label: 'Opened',
          data: weeks.map(w => w.opened),
          borderColor: ORANGE,
          backgroundColor: 'rgba(255, 146, 43, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 2,
        },
        {
          label: 'Closed',
          data: weeks.map(w => w.closed),
          borderColor: GREEN,
          backgroundColor: 'rgba(81, 207, 102, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          pointRadius: 2,
        },
      ],
    },
    options: { ...baseOptions('count'), plugins: { ...baseOptions().plugins, legend: { display: true, labels: { color: TEXT_SECONDARY, boxWidth: 12 } } } },
  })
  register(canvasId, chart)
  return chart
}

/**
 * Contributor activity area chart
 */
export function renderContributorChart(canvasId, weeks) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        label: 'Active contributors',
        data: weeks.map(w => w.count),
        borderColor: ACCENT2,
        backgroundColor: 'rgba(56, 217, 169, 0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 2,
      }],
    },
    options: baseOptions('contributors'),
  })
  register(canvasId, chart)
  return chart
}

/**
 * Velocity radar chart
 */
export function renderRadarChart(canvasId, dimensions) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const labels = Object.keys(dimensions)
  const values = Object.values(dimensions)

  const chart = new Chart(canvas, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Score',
        data: values,
        borderColor: ACCENT,
        backgroundColor: 'rgba(99, 120, 255, 0.15)',
        borderWidth: 2,
        pointBackgroundColor: ACCENT,
        pointRadius: 3,
      }],
    },
    options: {
      animation: { duration: 800, easing: 'easeInOutQuart' },
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            display: false,
            stepSize: 25,
          },
          grid: { color: GRID },
          angleLines: { color: GRID },
          pointLabels: {
            color: TEXT_SECONDARY,
            font: { size: 11, weight: '500' },
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw}/100`,
          },
        },
      },
    },
  })
  register(canvasId, chart)
  return chart
}

/**
 * Shared base chart options
 */
function baseOptions(yLabel = 'count') {
  return {
    animation: { duration: 600, easing: 'easeInOutQuart' },
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: GRID },
        ticks: { maxTicksLimit: 5, font: { size: 11 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(21, 24, 32, 0.95)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 12, weight: '600' },
        bodyFont: { size: 12 },
      },
    },
  }
}

/**
 * Destroy all registered charts (call before re-render)
 */
export function destroyAll() {
  for (const [id] of registry) destroy(id)
}
