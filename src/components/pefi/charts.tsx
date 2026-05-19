'use client'

// PEFI chart primitives — ported from the Claude Design prototype.
// Lightweight SVG, terminal-quiet, hairline grids, tabular numerals.

import { useMemo, useState, useRef, useLayoutEffect } from 'react'

function useWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(600)
  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => {
      setW(Math.max(80, el.getBoundingClientRect().width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// ─── Sparkline ──────────────────────────────────────────────────────────────
export function Sparkline({
  data, color = 'var(--pf-accent)', height = 28, width = 80, fill = true, stroke = 1.4,
}: {
  data: number[]; color?: string; height?: number; width?: number; fill?: boolean; stroke?: number
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return [x, y] as const
  })
  const path = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  const area = `${path} L${width},${height} L0,${height} Z`
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={area} fill={color} opacity=".12" />}
      <path d={path} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Area / line chart ────────────────────────────────────────────────────────
export interface Series { label: string; color: string; data: number[] }

export function AreaChart({
  series, labels, height = 240, style = 'area', showGrid = true, showAxis = true,
  yFormat = (v: number) => String(v),
  padTop = 16, padBottom = 26, padLeft = 56, padRight = 16,
}: {
  series: Series[]; labels: string[]; height?: number
  style?: 'area' | 'line'; showGrid?: boolean; showAxis?: boolean
  yFormat?: (v: number) => string
  padTop?: number; padBottom?: number; padLeft?: number; padRight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref)
  const h = height
  const allVals = series.flatMap((s) => s.data)
  const minRaw = allVals.length ? Math.min(...allVals) : 0
  const maxRaw = allVals.length ? Math.max(...allVals) : 1
  const pad = (maxRaw - minRaw) * 0.08 || maxRaw * 0.05 || 1
  const min = minRaw - pad
  const max = maxRaw + pad
  const range = max - min || 1

  const innerW = Math.max(10, w - padLeft - padRight)
  const innerH = h - padTop - padBottom
  const n = labels.length
  const x = (i: number) => padLeft + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2)
  const y = (v: number) => padTop + innerH - ((v - min) / range) * innerH

  const ticks = useMemo(() => {
    const out: number[] = []
    for (let i = 0; i <= 4; i++) out.push(min + (range * i) / 4)
    return out
  }, [min, range])

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const onMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left - padLeft
    let idx = Math.round((px / innerW) * (n - 1))
    idx = Math.max(0, Math.min(n - 1, idx))
    setHoverIdx(idx)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: h }}>
      <svg width="100%" height={h} onMouseMove={onMove} onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={`pf-g-${i}-${s.label}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {showGrid && ticks.map((t, i) => (
          <line key={i} x1={padLeft} x2={w - padRight} y1={y(t)} y2={y(t)} stroke="var(--pf-hairline)" strokeWidth="1" />
        ))}
        {showAxis && ticks.map((t, i) => (
          <text key={i} x={padLeft - 8} y={y(t) + 3} fontSize="10.5" textAnchor="end" fill="var(--pf-muted)" fontFamily="var(--font-mono)">
            {yFormat(t)}
          </text>
        ))}
        {series.map((s, si) => {
          const pts = s.data.map((v, i) => [x(i), y(v)] as const)
          const path = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
          const area = `${path} L${x(n - 1)},${y(min)} L${x(0)},${y(min)} Z`
          return (
            <g key={si}>
              {style === 'area' && <path d={area} fill={`url(#pf-g-${si}-${s.label})`} />}
              <path d={path} fill="none" stroke={s.color} strokeWidth={style === 'area' ? 1.6 : 1.8}
                strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        })}
        {showAxis && labels.map((l, i) => {
          if (n > 12 && i % Math.ceil(n / 8) !== 0 && i !== n - 1) return null
          return (
            <text key={i} x={x(i)} y={h - 8} fontSize="10.5" textAnchor="middle" fill="var(--pf-muted)" fontFamily="var(--font-mono)">
              {l}
            </text>
          )
        })}
        {hoverIdx != null && (
          <g>
            <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padTop} y2={h - padBottom}
              stroke="var(--pf-text-2)" strokeOpacity=".25" strokeWidth="1" strokeDasharray="3 3" />
            {series.map((s, si) => (
              <circle key={si} cx={x(hoverIdx)} cy={y(s.data[hoverIdx])} r="3.5" fill="var(--pf-card)" stroke={s.color} strokeWidth="1.6" />
            ))}
          </g>
        )}
      </svg>
      {hoverIdx != null && (
        <div style={{
          position: 'absolute', left: Math.min(w - 180, Math.max(8, x(hoverIdx) - 90)), top: 4,
          background: 'var(--pf-card-2)', border: '1px solid var(--pf-border)', borderRadius: 8,
          padding: '6px 10px', fontSize: 11.5, pointerEvents: 'none', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ color: 'var(--pf-muted)', fontSize: 10.5, marginBottom: 2 }}>{labels[hoverIdx]}</div>
          {series.map((s, si) => (
            <div key={si} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: 'var(--pf-text)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 2, background: s.color, borderRadius: 2 }} />
                {s.label}
              </span>
              <span>{yFormat(s.data[hoverIdx])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Grouped bar chart ────────────────────────────────────────────────────────
export function BarChart<T extends Record<string, number | string>>({
  data, keys, colors, labels, height = 220, yFormat = (v: number) => String(v),
}: {
  data: T[]; keys: string[]; colors: string[]; labels: string[]
  height?: number; yFormat?: (v: number) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const w = useWidth(ref)
  const h = height
  const padTop = 14, padBottom = 26, padLeft = 56, padRight = 8
  const innerW = Math.max(10, w - padLeft - padRight)
  const innerH = h - padTop - padBottom

  const maxV = Math.max(1, ...data.flatMap((d) => keys.map((k) => Number(d[k]) || 0)))
  const n = Math.max(1, data.length)
  const groupW = innerW / n
  const barW = (groupW * 0.55) / keys.length
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => maxV * p)
  const yPos = (v: number) => padTop + innerH - (v / maxV) * innerH

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: h }}>
      <svg width="100%" height={h}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padLeft} x2={w - padRight} y1={yPos(t)} y2={yPos(t)} stroke="var(--pf-hairline)" />
            <text x={padLeft - 8} y={yPos(t) + 3} fontSize="10.5" textAnchor="end" fill="var(--pf-muted)" fontFamily="var(--font-mono)">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i}>
            {keys.map((k, ki) => {
              const v = Number(d[k]) || 0
              const bx = padLeft + i * groupW + groupW * 0.225 + ki * barW + barW * 0.1
              const by = yPos(v)
              const bh = innerH - (by - padTop)
              return <rect key={k} x={bx} y={by} width={barW * 0.8} height={Math.max(0, bh)} rx="2" fill={colors[ki]} opacity="0.92" />
            })}
            <text x={padLeft + i * groupW + groupW / 2} y={h - 8} fontSize="10.5" textAnchor="middle" fill="var(--pf-muted)" fontFamily="var(--font-mono)">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ─── Donut ────────────────────────────────────────────────────────────────────
export function Donut({
  data, size = 160, thickness = 18, centerLabel, centerValue,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number; thickness?: number; centerLabel?: string; centerValue?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--pf-card-2)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac = d.value / total
          const dash = frac * circ
          const offset = -acc * circ
          acc += frac
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dasharray .5s ease, stroke-dashoffset .5s ease' }} />
          )
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {centerLabel && (
            <div style={{ fontSize: 10.5, color: 'var(--pf-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {centerLabel}
            </div>
          )}
          {centerValue && <div className="num" style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{centerValue}</div>}
        </div>
      )}
    </div>
  )
}
