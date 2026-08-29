'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRetailerCatalog } from '@/hooks/use-retailer-catalog'
import { useQuizAnswers } from '@/hooks/use-quiz-answers'
import { quizAnswersToScoringProfile } from '@/lib/quiz-profile'
import { getSavedSkinProfile } from '@/lib/profile-storage'
import ProductPlayground from '@/components/homeComponents/ProductPlayground'

const PLAYGROUND_BAND_COUNT = 12

// Mirrors ProductDetailsPlayground, but sourced from the retailer catalogue
// (14k+ live listings) instead of the 409-product Roopsee catalogue, since a
// retailer product page has no Roopsee product to hand the Roopsee-only
// version. Scoped to the current product's category so the comparison stays
// relevant instead of pulling in every category in the catalogue.
export default function RetailerProductPlayground({ productId, category }) {
  const quizAnswers = useQuizAnswers()

  // Same fallback as AllProducts: sessionStorage quiz answers are per-tab, so
  // a saved profile in localStorage keeps this working in a fresh tab too.
  const [savedProfile, setSavedProfile] = useState(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSavedProfile(getSavedSkinProfile()?.profile || null)
    }, 0)
    return () => clearTimeout(timer)
  }, [quizAnswers])

  const scoringProfile = useMemo(() => {
    if (quizAnswers) return quizAnswersToScoringProfile(quizAnswers)
    return savedProfile?.selectedSkinType ? savedProfile : null
  }, [quizAnswers, savedProfile])

  const { products: catalogProducts, loading, error } = useRetailerCatalog({
    search: '',
    filters: { brand: [], category: category ? [category] : [], site: [], price: [] },
    sort: 'score_desc',
    page: 1,
    profile: scoringProfile,
    bands: PLAYGROUND_BAND_COUNT,
  })

  // Needs a scoring profile to have anything worth comparing, same gate the
  // Roopsee-catalogue version uses.
  if (loading || error || !scoringProfile) return null

  const products = catalogProducts.map((product) => ({
    ...product,
    score: product.scoring?.score,
  }))

  return (
    <ProductPlayground
      products={products}
      quizAnswers={quizAnswers}
      initialProductId={String(productId)}
    />
  )
}
