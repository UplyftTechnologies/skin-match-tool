export function clampScore(score) {
  const value = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 0
  return Math.max(0, Math.min(100, value))
}

export function getScoreBand(score) {
  const value = clampScore(score)
  if (value > 89) {
    return { key: 'great-high', label: 'GREAT', ring: '#1fae74', fill: '#12996a', glow: 'rgba(18,153,106,0.35)' }
  }
  if (value >= 86) {
    return { key: 'great', label: 'GREAT', ring: '#7bc96f', fill: '#6cbf5f', glow: 'rgba(108,191,95,0.35)' }
  }
  if (value >= 80) {
    return { key: 'good', label: 'GOOD', ring: '#e8b53a', fill: '#d9a52c', glow: 'rgba(217,165,44,0.35)' }
  }
  if (value >= 60) {
    return { key: 'caution', label: 'Caution', ring: '#f0cf6b', fill: '#e6c157', glow: 'rgba(230,193,87,0.35)' }
  }
  return { key: 'low', label: 'LOW', ring: '#e0645f', fill: '#d1524d', glow: 'rgba(209,82,77,0.35)' }
}
