import React from 'react'
import KnowBefore from '@/components/homeComponents/KnowBefore'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'
import Products from '@/components/homeComponents/Products'
import SearchByCategory from '@/components/homeComponents/SearchByCategory'
import SearchByProducts from '@/components/homeComponents/SearchByProducts'
import SearchByBrands from '@/components/homeComponents/SearchByBrands'
import IndianRockstar from '@/components/homeComponents/IndianRockstar.js'

function page() {
  return (
    <div>
      <KnowBefore />
      <MatchMySkin />
      <Products />
      <SearchByCategory />
      <SearchByProducts />
      <SearchByBrands />
      <IndianRockstar />
    </div>
  )
}

export default page