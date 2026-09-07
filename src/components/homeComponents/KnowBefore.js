'use client'

import { BsPatchCheckFill } from 'react-icons/bs'
import BrandSlider from '../BrandSlider'
import Animation2 from '../Animation2'





export default function KnowBefore() {
  return (
    <div>
      <section className="bg-[#FAF9F6] px-4 py-4 sm:px-6 sm:py-6 md:py-6">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="font-cormorant text-[26px] leading-[1.3]
           tracking-[0.14em] text-black sm:text-[36px] md:text-[42px]">
            Know <em className="italic">your skin</em> match
          </h2>  
          <Animation2 className="concern-animation-home" />

        </div>
      </section>
      
    </div>
  )
}