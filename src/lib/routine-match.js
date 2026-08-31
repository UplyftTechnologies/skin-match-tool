import { getScoreBand } from '@/lib/score-band'

// Wording for the Build My Routine page, kept separate from score-band.js's
// GOOD/GREAT/Caution/LOW labels (those drive the ring badges elsewhere) —
// same numeric thresholds, different copy to match this page's design.
export function matchLabel(score) {
  const band = getScoreBand(score)
  if (band.key === 'caution') return 'Check match'
  if (band.key === 'low') return 'Poor match'
  return 'Great match'
}

export function matchClasses(score) {
  const band = getScoreBand(score)
  if (band.key === 'caution') return 'bg-amber-50 text-amber-700'
  if (band.key === 'low') return 'bg-rose-50 text-rose-700'
  return 'bg-emerald-50 text-emerald-700'
}
