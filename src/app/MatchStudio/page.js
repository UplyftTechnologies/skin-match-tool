import React from 'react'
import Header from '@/components/header'
import KnowBefore from '@/components/homeComponents/KnowBefore'
import QuizSteps from '@/components/homeComponents/QuizSteps'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'
import Products from '@/components/homeComponents/Products'
import SearchByCategory from '@/components/homeComponents/SearchByCategory'
import SearchByProducts from '@/components/homeComponents/SearchByProducts'
import SearchByBrands from '@/components/homeComponents/SearchByBrands'
import IndianRockstar from '@/components/homeComponents/IndianRockstar.js'
import MeetDocter from "@/components/homeComponents/MeetDocter.js"
import RequireQuizGate from "@/components/require-quiz-gate"
import BrandSlider from '@/components/BrandSlider'
import AnimatedSkinShowcase from '@/components/homeComponents/AnimatedSkinShowcase'
import Animation2 from '@/components/Animation2'
import KnowMatch from '@/components/homeComponents/KnowMatch'

function page() {
  return (
    <div>
      <Header />
      {/* <KnowBefore /> */}
      <KnowMatch />
      <QuizSteps />
      {/* <Animation2  className="concern-animation-home" /> */}
      {/* <AnimatedSkinShowcase /> */}
      <MatchMySkin />
      <RequireQuizGate hidePrompt>
        <Products />
      </RequireQuizGate>
      <BrandSlider />
      <MeetDocter />
      <SearchByCategory />
      <SearchByProducts />
      <SearchByBrands />
      <IndianRockstar />
    </div>
  )
}

export default page
