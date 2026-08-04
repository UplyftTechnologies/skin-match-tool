'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import Image from 'next/image'
import 'swiper/css'
import brandimg1 from "@/assets/brand-images/brand0.webp";
import brandimg2 from "@/assets/brand-images/brand01.webp";
import brandimg3 from "@/assets/brand-images/brand02.webp";
import brandimg4 from "@/assets/brand-images/brand03.webp";
import brandimg5 from "@/assets/brand-images/brand1.webp";
import brandimg6 from "@/assets/brand-images/brand2.webp";
import brandimg7 from "@/assets/brand-images/brand3.webp";
import brandimg8 from "@/assets/brand-images/brand4.webp";
import brandimg9 from "@/assets/brand-images/brand5.webp";

const brands = [
  brandimg1,
  brandimg2,
  brandimg3,
  brandimg4,
  brandimg5,
  brandimg6,
  brandimg7,
  brandimg8,
  brandimg9,
];

export default function BrandSlider() {
  return (
    <div className="mt-2">
      <Swiper
        modules={[Autoplay]}
        slidesPerView={3}
        spaceBetween={30}
        loop={true}
        autoplay={{
          delay: 0,
          disableOnInteraction: false,
        }}
        speed={4000}
        allowTouchMove={false}
        breakpoints={{
          640: { slidesPerView: 3 },
          768: { slidesPerView: 4 },
          1024: { slidesPerView: 8 },
        }}
      >
        {brands.map((brand, i) => (
          <SwiperSlide key={i} className="flex items-center justify-center">
            <Image
              src={brand}
              alt={`Brand ${i + 1}`}
              className="h-8 md:h-10 w-auto object-contain  opacity-80 hover:grayscale-0 hover:opacity-100 transition duration-300"
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  )
}