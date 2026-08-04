import React from 'react'
import KnowBefore from '@/components/homeComponents/KnowBefore'
import MatchMySkin from '@/components/homeComponents/MatchMySkin'
import Products from '@/components/homeComponents/Products'
import SearchByCategory from '@/components/homeComponents/SearchByCategory'
// import SearchByBrands from '@/components/homeComponents/SearchByBrands'

function page() {
  return (
    <div>
      <KnowBefore />
      <MatchMySkin />
      <Products />
      <SearchByCategory />
      {/* <SearchByBrands /> */}
    </div>
  )
}

export default page