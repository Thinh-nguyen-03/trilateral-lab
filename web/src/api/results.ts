import { apiFetch } from './client'
import type { RawResults, ResultRow } from '../types/api'

const STRATEGY_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  random: 'Random',
  max_separation: 'Max-Sep',
  centroid: 'Centroid',
  info_gain: 'Info-Gain*',
}

const MODE_LABELS: Record<string, string> = {
  EXACT: 'Exact',
  ROUND_10_MILES: 'Round 10mi',
  ROUND_25_MILES: 'Round 25mi',
  ROUND_100_MILES: 'Round 100mi',
  NOISY_GAUSSIAN_5: 'Gaussian σ=5',
  NOISY_GAUSSIAN_25: 'Gaussian σ=25',
}

export const STRATEGY_ORDER = ['fixed', 'random', 'max_separation', 'centroid', 'info_gain']
export const MODE_ORDER = [
  'EXACT',
  'ROUND_10_MILES',
  'ROUND_25_MILES',
  'ROUND_100_MILES',
  'NOISY_GAUSSIAN_5',
  'NOISY_GAUSSIAN_25',
]

export async function fetchResults(): Promise<ResultRow[]> {
  const raw = await apiFetch<RawResults>('/api/results')
  const rows: ResultRow[] = []
  for (const [key, stats] of Object.entries(raw)) {
    const [strategy, mode] = key.split('|')
    if (strategy in STRATEGY_LABELS && mode in MODE_LABELS) {
      rows.push({
        strategy,
        mode,
        strategy_label: STRATEGY_LABELS[strategy],
        mode_label: MODE_LABELS[mode],
        ...stats,
      })
    }
  }
  return rows
}

export function pivotOn(
  rows: ResultRow[],
  metric: keyof ResultRow,
  strategyOrder: string[],
  modeOrder: string[],
): number[][] {
  return strategyOrder.map((s) =>
    modeOrder.map((m) => {
      const row = rows.find((r) => r.strategy === s && r.mode === m)
      return typeof row?.[metric] === 'number' ? (row[metric] as number) : 0
    }),
  )
}
