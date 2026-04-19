import { useRef, useEffect, useState } from 'react'
import type { CompareSlice } from '../../store/compareStore'
import styles from './CompareVerdictPanel.module.css'

const A_COLOR = '#00bcd4'
const B_COLOR = '#ffab00'

function weeksToLocalize(slice: CompareSlice): number | null {
  const hit = slice.history.find((s) => s.localized)
  return hit ? hit.week : null
}
function avgDistance(slice: CompareSlice) {
  if (!slice.history.length) return 0
  return Math.round(slice.history.reduce((s, r) => s + r.observed_distance, 0) / slice.history.length)
}

const LOG_MIN = Math.log10(0.5)
const LOG_MAX = Math.log10(2000)
function toLogY(r: number, h: number) {
  const v = Math.max(r, 0.5)
  return h - ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * h
}

function Sparkline({ left, right, width, height }: {
  left: CompareSlice; right: CompareSlice; width: number; height: number
}) {
  const makePath = (slice: CompareSlice) => {
    const radii = slice.history.map((s) => s.uncertainty_radius)
    if (radii.length < 2) return null
    const n = radii.length
    const pts = radii.map((r, i) => {
      const x = (i / (n - 1)) * width
      const y = toLogY(r, height)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    const hitIdx = slice.history.findIndex((s) => s.localized)
    const hitX = hitIdx >= 0 ? ((hitIdx / (n - 1)) * width) : null
    const hitY = hitIdx >= 0 ? toLogY(radii[hitIdx], height) : null
    return { d: pts.join(' '), hitX, hitY }
  }

  const a = makePath(left)
  const b = makePath(right)
  const threshY = toLogY(5, height)

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      {/* grid lines */}
      {[1000, 100, 10, 5].map((v) => {
        const y = toLogY(v, height)
        const isThresh = v === 5
        return (
          <line key={v} x1={0} y1={y} x2={width} y2={y}
            stroke={isThresh ? 'rgba(255,61,61,0.5)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={isThresh ? 1 : 0.5}
            strokeDasharray={isThresh ? '4,3' : undefined}
          />
        )
      })}
      {/* labels */}
      {[1000, 100, 10].map((v) => (
        <text key={v} x={2} y={toLogY(v, height) - 2}
          fontSize="7" fill="rgba(255,255,255,0.3)" fontFamily="monospace">{v}mi</text>
      ))}
      <text x={2} y={threshY - 2} fontSize="7" fill="rgba(255,61,61,0.6)" fontFamily="monospace">5mi</text>

      {/* curves */}
      {a && <path d={a.d} fill="none" stroke={A_COLOR} strokeWidth="2" strokeLinejoin="round" />}
      {b && <path d={b.d} fill="none" stroke={B_COLOR} strokeWidth="2" strokeLinejoin="round" />}

      {/* localization dots */}
      {a?.hitX != null && a.hitY != null && (
        <circle cx={a.hitX} cy={a.hitY} r={4} fill={A_COLOR} stroke="#080808" strokeWidth={1.5} />
      )}
      {b?.hitX != null && b.hitY != null && (
        <circle cx={b.hitX} cy={b.hitY} r={4} fill={B_COLOR} stroke="#080808" strokeWidth={1.5} />
      )}
    </svg>
  )
}

interface Props { left: CompareSlice; right: CompareSlice }

export function CompareVerdictPanel({ left, right }: Props) {
  const aWeeks = weeksToLocalize(left)
  const bWeeks = weeksToLocalize(right)
  const aw = aWeeks ?? 52
  const bw = bWeeks ?? 52
  const delta = Math.abs(aw - bw)
  const winner = aWeeks === null && bWeeks === null ? null
    : aWeeks === null ? 'B'
    : bWeeks === null ? 'A'
    : aw < bw ? 'A' : bw < aw ? 'B' : null

  const sparkRef = useRef<HTMLDivElement>(null)
  const [sparkSize, setSparkSize] = useState({ w: 180, h: 200 })
  useEffect(() => {
    if (!sparkRef.current) return
    const ro = new ResizeObserver(([e]) => {
      setSparkSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(sparkRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div className={styles.col}>
      {/* Winner */}
      <div className={styles.winner}>
        {winner === null ? (
          <span className={styles.tied}>TIED</span>
        ) : (
          <>
            <span className={styles.winnerLabel}>
              {winner === 'A'
                ? <><span style={{ color: A_COLOR }}>A</span> WINS</>
                : <><span style={{ color: B_COLOR }}>B</span> WINS</>
              }
            </span>
            <span className={styles.delta}>by {delta} wk{delta !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* Sparkline */}
      <div className={styles.spark} ref={sparkRef}>
        <Sparkline left={left} right={right} width={sparkSize.w} height={sparkSize.h} />
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <StatRow label="WEEKS"
          a={aWeeks !== null ? String(aWeeks) : 'DNF'} colorA={aWeeks !== null ? A_COLOR : 'var(--text-muted)'}
          b={bWeeks !== null ? String(bWeeks) : 'DNF'} colorB={bWeeks !== null ? B_COLOR : 'var(--text-muted)'}
        />
        <StatRow label="AVG DIST"
          a={`${avgDistance(left)}mi`} colorA={A_COLOR}
          b={`${avgDistance(right)}mi`} colorB={B_COLOR}
        />
        <StatRow label="MEASUREMENTS"
          a={String(left.history.length)} colorA={A_COLOR}
          b={String(right.history.length)} colorB={B_COLOR}
        />
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span style={{ color: A_COLOR }}>— A</span>
        <span style={{ color: B_COLOR }}>— B</span>
      </div>
    </div>
  )
}

function StatRow({ label, a, colorA, b, colorB }: {
  label: string; a: string; colorA: string; b: string; colorB: string
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <div className={styles.statVals}>
        <span className={styles.statVal} style={{ color: colorA }}>{a}</span>
        <span className={styles.statVs}>vs</span>
        <span className={styles.statVal} style={{ color: colorB }}>{b}</span>
      </div>
    </div>
  )
}
