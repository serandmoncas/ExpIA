import Fuse from 'fuse.js'

export function createSearch<T extends { title: string; summary: string; category: string[] }>(nodes: T[]) {
  const fuse = new Fuse(nodes, { keys: ['title', 'summary', 'category'], threshold: 0.35, ignoreLocation: true })
  return (q: string): T[] => {
    const query = q.trim()
    return query ? fuse.search(query).map((r) => r.item) : nodes
  }
}
