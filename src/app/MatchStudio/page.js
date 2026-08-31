import React from 'react'
import Header from '@/components/header'
import KnowBefore from '@/components/homeComponents/KnowBefore'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'
import Products from '@/components/homeComponents/Products'
import SearchByCategory from '@/components/homeComponents/SearchByCategory'
import SearchByProducts from '@/components/homeComponents/SearchByProducts'
import SearchByBrands from '@/components/homeComponents/SearchByBrands'
import IndianRockstar from '@/components/homeComponents/IndianRockstar.js'
import MeetDocter from "@/components/homeComponents/MeetDocter.js"
import RequireQuizGate from "@/components/require-quiz-gate"

function page() {
  return (
    <div>
      <Header />
      <KnowBefore />
      <MatchMySkin />
      <RequireQuizGate
        title="Take the quiz above to see products"
        description="Answer a few quick questions so every product here is scored for your skin."
        hideCta
      >
        <Products />
      </RequireQuizGate>
      <MeetDocter />
      <SearchByCategory />
      <SearchByProducts />
      <SearchByBrands />
      <IndianRockstar />
    </div>
  )
}

export default page