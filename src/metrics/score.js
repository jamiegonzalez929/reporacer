/**
 * Composite Velocity Score (0–100) and radar chart dimensions
 */

/**
 * Score individual dimensions (0–100) and compute composite
 *
 * Dimensions:
 *   - Commit cadence    (commits/week over 90d)
 *   - PR throughput     (PRs merged / opened ratio + volume)
 *   - Issue health      (resolution rate + close time)
 *   - Release frequency (how often releases ship)
 *   - Team breadth      (bus factor / contributor diversity)
 *   - Consistency       (how uniform the weekly commit distribution is)
 */
export function calcVelocityScore({ commits, prs, issues, releases, leaderboard, commitWeeks }) {
  // --- 1. Commit Cadence (0–100) ---
  // 10+ commits/week = 100, scaled down from there
  const avgCommitsPerWeek = commitWeeks.length > 0
    ? commitWeeks.reduce((s, w) => s + w.count, 0) / commitWeeks.length
    : 0
  const commitScore = Math.min(100, Math.round((avgCommitsPerWeek / 10) * 100))

  // --- 2. PR Throughput (0–100) ---
  // Combines merge rate (%) and volume
  let prScore = 0
  if (prs.opened > 0) {
    const mergeRateScore = prs.mergeRate ?? 0
    const volumeScore = Math.min(100, (prs.opened / 10) * 100)
    prScore = Math.round((mergeRateScore * 0.6) + (volumeScore * 0.4))
  } else if (commits.length > 50) {
    // Trunk-based dev — no PRs but high commit volume
    prScore = 60
  }

  // --- 3. Issue Health (0–100) ---
  let issueScore = 50 // neutral if no data
  if (issues.opened > 0) {
    const resScore = issues.resolutionRate ?? 50
    // Close time: < 3 days = 100, 30+ days = 0
    const closeHours = issues.avgCloseTimeHours ?? (30 * 24)
    const timeScore = Math.max(0, 100 - Math.round((closeHours / (30 * 24)) * 100))
    issueScore = Math.round((resScore * 0.5) + (timeScore * 0.5))
  }

  // --- 4. Release Frequency (0–100) ---
  let releaseScore = 0
  if (releases.avgDaysBetween != null) {
    // 7 days between = 100, 30 days = 50, 90 days = 20, no releases = 0
    releaseScore = Math.min(100, Math.round(100 / (1 + releases.avgDaysBetween / 7)))
  } else if (releases.total === 0) {
    // No releases might be fine (e.g. libraries published differently)
    releaseScore = 30
  }

  // --- 5. Team Breadth (0–100) ---
  // Bus factor: higher = better
  const busFactorNum = leaderboard.busFactor?.factor ?? 1
  // 1 contributor = 10 pts, 3 = 40, 5+ = 80, 10+ = 100
  const breadthScore = Math.min(100, Math.round(busFactorNum * 10))

  // --- 6. Consistency (0–100) ---
  // CV of weekly commits (lower variance = more consistent = higher score)
  let consistencyScore = 50
  if (commitWeeks.length > 3) {
    const counts = commitWeeks.map(w => w.count)
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    if (mean > 0) {
      const variance = counts.reduce((s, c) => s + (c - mean) ** 2, 0) / counts.length
      const cv = Math.sqrt(variance) / mean // coefficient of variation
      // CV < 0.5 = very consistent (100), CV > 2 = erratic (10)
      consistencyScore = Math.max(10, Math.min(100, Math.round(100 - cv * 45)))
    }
  }

  // Weighted composite
  const weights = {
    commits: 0.25,
    prs: 0.20,
    issues: 0.15,
    releases: 0.15,
    breadth: 0.10,
    consistency: 0.15,
  }

  const composite = Math.round(
    commitScore * weights.commits +
    prScore * weights.prs +
    issueScore * weights.issues +
    releaseScore * weights.releases +
    breadthScore * weights.breadth +
    consistencyScore * weights.consistency
  )

  return {
    score: composite,
    grade: scoreGrade(composite),
    dimensions: {
      'Commit Cadence': commitScore,
      'PR Throughput': prScore,
      'Issue Health': issueScore,
      'Release Freq': releaseScore,
      'Team Breadth': breadthScore,
      Consistency: consistencyScore,
    },
    description: scoreDescription(composite),
  }
}

function scoreGrade(score) {
  if (score >= 80) return { label: 'A — High Velocity', cls: 'grade-a' }
  if (score >= 60) return { label: 'B — Good Velocity', cls: 'grade-b' }
  if (score >= 40) return { label: 'C — Moderate', cls: 'grade-c' }
  return { label: 'D — Low Activity', cls: 'grade-d' }
}

function scoreDescription(score) {
  if (score >= 80) return 'This repo ships fast and consistently. High PR throughput, regular releases, and strong contributor diversity.'
  if (score >= 60) return 'Solid engineering pace with room for improvement. Consider tightening issue resolution time or increasing release cadence.'
  if (score >= 40) return 'Moderate activity. Commit cadence or PR throughput may be inconsistent. Check if the project is in maintenance mode.'
  return 'Low velocity detected. The repo may be in early stage, maintenance-only, or inactive. Review issue backlog and contributor activity.'
}

/**
 * Format large numbers compactly
 */
export function fmtNumber(n) {
  if (n == null) return 'N/A'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return n.toString()
}
