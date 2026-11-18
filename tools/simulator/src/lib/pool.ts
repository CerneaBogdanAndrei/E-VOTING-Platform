// Rulează sarcinile cu cel mult `size` în paralel (alegătorii „simultani”).

export async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>, onTick?: (done: number) => void) {
  let next = 0
  let done = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        await fn(items[i], i)
        onTick?.(++done)
      }
    }),
  )
}
