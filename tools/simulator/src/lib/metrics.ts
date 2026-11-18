// Măsurarea timpilor: medie, mediană, percentila 95 și maximul unei serii.

export interface Stats {
  avg: number
  p50: number
  p95: number
  max: number
}

export function stats(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b)
  const avg = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length)
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0
  return { avg: +avg.toFixed(2), p50: +pct(50).toFixed(2), p95: +pct(95).toFixed(2), max: +(sorted.at(-1) ?? 0).toFixed(2) }
}

/** Rulează funcția și întoarce rezultatul împreună cu durata în milisecunde. */
export const timed = async <R>(fn: () => Promise<R> | R): Promise<[R, number]> => {
  const t = performance.now()
  const r = await fn()
  return [r, performance.now() - t]
}
