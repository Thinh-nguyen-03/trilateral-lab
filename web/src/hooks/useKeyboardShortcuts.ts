import { useEffect } from 'react'

interface ShortcutHandlers {
  start: () => void
  step: () => void
  startAutoPlay: () => void
  stopAutoPlay: () => void
  reset: () => void
  status: string
}

export function useKeyboardShortcuts({
  start,
  step,
  startAutoPlay,
  stopAutoPlay,
  reset,
  status,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (status === 'idle') {
            start()
          } else if (status === 'playing') {
            stopAutoPlay()
          } else if (status === 'running') {
            startAutoPlay()
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (status === 'running') step()
          break
        case 'r':
        case 'R':
          if (status !== 'idle') reset()
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [status, start, step, startAutoPlay, stopAutoPlay, reset])
}
