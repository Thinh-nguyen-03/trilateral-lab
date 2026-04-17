import { apiFetch } from './client'
import type { StartSessionResponse, StepResponse } from '../types/api'

export async function startSession(
  strategy: string,
  measurement_mode: string,
  box_location?: { lat: number; lon: number } | null,
): Promise<StartSessionResponse> {
  return apiFetch<StartSessionResponse>('/api/session/start', {
    method: 'POST',
    body: JSON.stringify({ strategy, measurement_mode, box_location: box_location ?? undefined }),
  })
}

export async function stepSession(sessionId: string): Promise<StepResponse> {
  return apiFetch<StepResponse>(`/api/session/${sessionId}/step`, { method: 'POST' })
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`/api/session/${sessionId}`, { method: 'DELETE' })
}
