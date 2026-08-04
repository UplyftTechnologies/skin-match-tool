'use client'
import Image from 'next/image'
import BrandSlider from '../BrandSlider'

export default function KnowBefore() {
  return (
    <div className="bg-[#FAF9F6] py-6 px-5 lg:py-12">
      <div className="max-w-6xl lg:max-w-7xl mx-auto text-center">
        <h2 className="font-cormorant text-[34px] md:text-5xl text-black leading-tight">
          Know <span className="italic">Before</span>
          <br />
          You Buy
        </h2>

        <p className="font-lato text-[11px] md:text-base tracking- text-gray-700    mt-4 uppercase">
          Find products that suits you across 500+ brands
        </p>

        <BrandSlider />
        <button className="font-lato text-xs md:text-sm tracking-widest uppercase text-[#ff7e67] border border-[#ff7e67] 
        rounded-[2px] px-8 py-2 mt-6 hover:bg-[#e08a7d] hover:text-white transition-colors duration-300">
          Match My Skin
        </button>

      </div>
    </div>
  )
}
