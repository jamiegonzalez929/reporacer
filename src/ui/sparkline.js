/**
 * Draw a simple sparkline using Canvas2D
 */
export function renderSparkline(canvas, data, color = '#58a6ff') {
  if (!canvas || !data || data.length === 0) return

  const dpr = window.devicePixelRatio || 1
  const w = canvas.offsetWidth || 300
  const h = canvas.offsetHeight || 48

  canvas.width = w * dpr
  canvas.height = h * dpr

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min || 1

  const pad = 4
  const width = w - pad * 2
  const height = h - pad * 2

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * width,
    y: pad + height - ((v - min) / range) * height,
  }))

  // Fill area
  const grad = ctx.createLinearGradient(0, pad, 0, pad + height)
  grad.addColorStop(0, color + '40')
  grad.addColorStop(1, color + '00')

  ctx.beginPath()
  ctx.moveTo(points[0].x, pad + height)
  points.forEach(p => ctx.lineTo(p.x, p.y))
  ctx.lineTo(points[points.length - 1].x, pad + height)
  ctx.closePath()
  ctx.fillStyle = grad
  ctx.fill()

  // Line
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    ctx.bezierCurveTo(cpx, prev.y, cpx, curr.y, curr.x, curr.y)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
}
