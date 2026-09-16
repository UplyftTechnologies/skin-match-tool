'use client'

import React from 'react'
import Image from 'next/image'
import bgheroimg from "../../assets/images/bg-6.webp"
import RetailerLogo from '@/components/retailer-logo'

function KnowMatch() {
    
    const scrollToQuiz = () => {
        document.getElementById('match-my-skin')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    return (
        <div className="bg-white font-public-sans">
            <div className="relative w-full overflow-hidden
              aspect-[4/5] sm:aspect-[3/4] lg:aspect-auto lg:h-[460px]">
                <Image
                    src={bgheroimg}
                    alt="Skincare products on a sunlit windowsill"
                    fill
                    priority
                    className="object-cover"
                    sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/25 to-transparent" />

                <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-12 xl:px-20">
                    {/* Heading */}
                    <div className="lg:max-w-xl">
                        <h2 className="font-cormorant text-4xl font-semibold
                        leading-[1.1] text-white sm:text-4xl md:text-[42px] lg:text-6xl">
                            Know your match.
                            <br />
                            Choose your shop.
                        </h2>
                        <p className="mt-2 max-w-[230px] text-xs text-white sm:text-sm lg:max-w-sm lg:text-lg">
                            Personalised scores, smarter choices and better prices—all in one place.
                        </p>
                    </div>

                    {/* Product match card + CTA */}
                    <div className="mx-2 p-2 rounded-2xl bg-white/45 shadow-lg
                     backdrop-blur-[1.2px] ring-1 ring-white/60 sm:px-5 sm:py-4
                     lg:mx-0 lg:w-[380px] lg:shrink-0 lg:self-center lg:p-5">
                        <div className="relative px-4
                        py-3 pr-7 ">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-800 sm:text-xs">
                                Your Product Match
                            </p>
                            <p className="text-[10px] text-gray-700 sm:text-[11px]">Compare prices</p>

                            <div className="mt-1 space-y-0.5">
                                <div className="flex items-center justify-between">
                                    <RetailerLogo site="tira" height={42} />
                                    <span className="text-xs font-medium text-gray-700 sm:text-sm">&#8377;799</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <RetailerLogo site="nykaa" height={42} />
                                    <span className="text-xs font-medium text-gray-700 sm:text-sm">&#8377;849</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <RetailerLogo site="purplle" height={42} className="text-[#7B2D8E]" />
                                    <span className="text-xs font-medium text-gray-700 sm:text-sm">&#8377;825</span>
                                </div>
                            </div>

                            {/* Match badge */}
                            <div className="absolute -right-3 -top-3 flex h-12 w-12 flex-col items-center justify-center rounded-full bg-[#3fbf6f] text-white shadow-md ring-4 ring-white sm:h-14 sm:w-14">
                                <span className="text-xs font-extrabold leading-none sm:text-sm">92%</span>
                                <span className="text-[7px] font-semibold uppercase leading-none sm:text-[8px]">Match</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={scrollToQuiz}
                            className=" w-full rounded-full
                             bg-[#FF7E67] py-3 text-xs font-bold uppercase
                             tracking-[0.15em] text-white shadow-md transition-colors
                              duration-200 hover:bg-[#2c4d4a] sm:text-sm"
                        >
                            Take the Quiz
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KnowMatch
