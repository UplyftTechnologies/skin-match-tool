'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/free-mode'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'
import Face from '@/assets/images/face.webp'
import Body from '@/assets/images/body.webp'
import lips from '@/assets/images/lips.webp'
import eyes from '@/assets/images/eyes.webp'


const categories = [
    {
        id: 1,
        name: 'Face',
        image: Face,
        filters: ['Face'],
    },
    { id: 2, name: 'Body', image: Body, filters: ['Body'] },
    { id: 3, name: 'Lips', image: lips, filters: ['Lips'] },
    { id: 4, name: 'Eyes', image: eyes, filters: ['Eyes'] }
]

function categoryHref(filters) {
    const params = new URLSearchParams()
    filters.forEach((category) => params.append('category', category))
    return `/AllProducts?${params}`
}

export default function SearchByCategory() {
    const router = useRouter()

    const handleCategoryClick = (category) => {
        trackingService.trackEvent(EVENTS.CLICKED_SEARCH_BY_CATEGORY, {
            category: category.name,
            filters: category.filters,
            section: 'search_by_category',
        })

        router.push(categoryHref(category.filters))
    }

    return (
        <div className="bg-[#dbe6e2] py-6 px-4">
            <h2 style={{ letterSpacing: '0.1em' }} className="font-lato text-lg uppercase md:text-3xl text-center tracking- mb-1">
                Search by Category
            </h2>

            <div className="max-w-6xl mx-auto mt-5 lg:mt-8">
                <Swiper
                    modules={[FreeMode]}
                    slidesPerView="auto"
                    spaceBetween={16}
                    freeMode={{ enabled: true, momentumBounce: false }}
                    touchStartPreventDefault={false}
                    className="touch-pan-y"
                    breakpoints={{
                        480: { spaceBetween: 18 },
                        768: { spaceBetween: 20 },
                        1024: { spaceBetween: 28 },
                    }}
                >
                    {categories.map((cat) => (
                        <SwiperSlide key={cat.id} className="!w-auto">
                            <button
                                type="button"
                                onClick={() => handleCategoryClick(cat)}
                                className="flex flex-col items-center gap-3 cursor-pointer"
                                aria-label={`View ${cat.name} products`}
                            >
                                <div className="relative w-[150px] h-[150px] sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform duration-200 hover:scale-[1.03]">
                                    <Image
                                        src={cat.image}
                                        alt={cat.name}
                                        fill
                                        sizes="(max-width: 639px) 150px, (max-width: 1023px) 176px, 208px"
                                        className="object-cover"
                                    />
                                </div>
                                <span className="text-sm md:text-base tracking-wide text-gray-800">
                                    {cat.name}
                                </span>
                            </button>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </div>
    )
}
