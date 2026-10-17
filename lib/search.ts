import Fuse from 'fuse.js'

export function createSearch<T>(items: T[], keys: string[] = ['title', 'summary', 'category']) {
  const fuse = new Fuse(items, { keys, threshold: 0.35, ignoreLocation: true })
  return (q: string): T[] => {
    const query = q.trim()
    return query ? fuse.search(query).map((r) => r.item) : items
  }
}
