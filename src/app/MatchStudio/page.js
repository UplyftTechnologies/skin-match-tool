import React from 'react'
import KnowBefore from '@/components/homeComponents/KnowBefore'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'
import Products from '@/components/homeComponents/Products'
import SearchByCategory from '@/components/homeComponents/SearchByCategory'
import SearchByProducts from '@/components/homeComponents/SearchByProducts'
import SearchByBrands from '@/components/homeComponents/SearchByBrands'
import IndianRockstar from '@/components/homeComponents/IndianRockstar.js'
import MeetDocter from "@/components/homeComponents/MeetDocter.js"

function page() {
  return (
    <div>
      <KnowBefore />
      <MatchMySkin />
      <Products />
      <MeetDocter />
      <SearchByCategory />
      <SearchByProducts />
      <SearchByBrands />
      <IndianRockstar />
    </div>
  )
}

export default page