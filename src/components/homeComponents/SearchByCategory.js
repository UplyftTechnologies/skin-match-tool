'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import Face from '@/assets/images/face.webp'
import Body from '@/assets/images/body.webp'
import lips from '@/assets/images/lips.webp'
import eyes from '@/assets/images/eyes.webp'


const categories = [
    {
        id: 1,
        name: 'Face',
        image: Face,
        filters: ['Cleansers', 'Masks', 'Moisturizers', 'Serums', 'Shop Toners & Mists', 'Sun Care', 'Specialised Skincare'],
    },
    { id: 2, name: 'Body', image: Body, filters: ['Body Care'] },
    { id: 3, name: 'Lips', image: lips, filters: ['Lip Care'] },
    { id: 4, name: 'Eyes', image: eyes, filters: ['Eye Care'] }
]

function categoryHref(filters) {
    const params = new URLSearchParams()
    filters.forEach((category) => params.append('category', category))
    return `/AllProducts?${params}`
}

export default function SearchByCategory() {
    return (
        <div className="bg-[#dbe6e2] py-6 px-4">
            <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
                Search by Category
            </h2>

            <div className="max-w-6xl lg:max-w-3xl mx-auto mt-5 lg:mt-6">
                <Swiper
                    modules={[FreeMode]}
                    slidesPerView={2.2}
                    spaceBetween={16}
                    freeMode={true}
                    breakpoints={{
                        640: { slidesPerView: 2, spaceBetween: 15 },
                        1024: { slidesPerView: 4, spaceBetween: 24 },
                    }}
                >
                    {categories.map((cat) => (
                        <SwiperSlide key={cat.id} className="!w-auto">
                            <Link
                                href={categoryHref(cat.filters)}
                                className="flex flex-col items-center gap-3"
                                aria-label={`View ${cat.name} products`}
                            >
                                <div className="relative w-[120px] h-[120px] md:w-32 md:h-32 rounded-lg overflow-hidden border-2 border-white shadow-sm">
                                    <Image
                                        src={cat.image}
                                        alt={cat.name}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <span className="text-sm md:text-base tracking-wide text-gray-800">
                                    {cat.name}
                                </span>
                            </Link>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </div>
    )
}
