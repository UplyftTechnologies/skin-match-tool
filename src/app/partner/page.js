import React from 'react'
import Link from 'next/link'
import { FiSearch, FiShoppingCart, FiBarChart2 } from 'react-icons/fi'
import PartnerInquiryForm from '@/components/partner/PartnerInquiryForm'
import Header from '@/components/header'

const partnerFeatures = [
    {
        icon: FiSearch,
        bg: '#8ECFC9',
        title: 'Trust-Led Discovery',
        description: "No banner ads. Your product shows up inside real guidance and routines, helping people decide what to buy.",
    },
    {
        icon: FiShoppingCart,
        bg: '#FF7E67',
        title: 'Purchase-Ready Placement',
        description: "Our price comparison tool sits at the exact moment someone's ready to check out. Your listing meets shoppers when intent is highest.",
    },
    {
        icon: FiBarChart2,
        bg: '#8ECFC9',
        title: 'Shared Insights',
        description: "Partners get visibility into how their products perform with our audience — what's converting, what's being compared against, and where drop-off happens.",
    },
]

const partnerWays = [
    {
        number: '01',
        title: 'Price Comparison Listing',
        description: 'Get your products featured across our comparison tool, with API integration.',
    },
    {
        number: '02',
        title: 'Guidance & Content Features',
        description: 'Show up in roopsee instagram and marketing content that our audience actively seeks out, placed as guidance, not an ad.',
    },
    {
        number: '03',
        title: 'Insights Partnership',
        description: 'Ongoing data share on audience behavior, search trends, and how your catalog performs in comparisons so your team can act on real demand signals.',
    },
]

function page() {
    return (
        <div className="container-">
            <Header />

            <div className="px-4 py-3 md:px-8 lg:max-w-[1100px] lg:mx-auto">
            <div className="w-[90%] sm:w-[80%] lg:w-[65%] mx-auto py-3 md:py-6">
                <h2 style={{ lineHeight: '1.1' }} className="font-lato text-[23px] sm:text-[28px] md:text-[34px] lg:text-[40px] font-[600] text-center">Skip the ad fatigue. Reach
                    shoppers who trust what they're <span className="text-[#8ECFC9]">Buying</span>
                </h2>
            </div>
            <div className="py-2 mt-3">
                <p className="font-poppins font-[400] text-[#434343] text-[14px] sm:text-[15px] md:text-[16px] text-center max-w-[680px] mx-auto">
                    Roopsee helps people cut through skincare noise with honest, Doctor backed guidance,
                    and find the best price on what actually works for their skin.
                    Partner with us to reach shoppers at the exact moment they're deciding what to buy.
                </p>
            </div>

            <div className="py-2 mt-3 md:mt-4 flex justify-center gap-2 md:gap-4 items-center">
                <a href="#partner-inquiry-form" className="bg-[#FF7E67] text-black font-poppins font-medium
              text-[14px]  md:text-[16px] px-3 md:px-6 py-[10px] md:py-3 rounded-[18px] hover:bg-[#7bbab5] transition-colors duration-300">
                    Start a Partnership
                </a>

                <Link href="/" className="bg-transparent border border-[1px] border-[#000] text-black font-poppins font-medium
               text-[14px]  md:text-[16px] px-3 md:px-6 py-[10px] md:py-3 rounded-[18px] hover:bg-[#7bbab5] transition-colors duration-300">
                    See How It Works
                </Link>

            </div>

            <div className="text-center py-2 mt-3 md:mt-8">
                <p className="font-poppins text-[#5FA9A8] text-[11px] sm:text-[12px] font-semibold italic tracking-[1px] uppercase mb-3">
                    Why Roopsee
                </p>

                <h2 className="font-lato text-[#171717] text-[20px] sm:text-[22px] md:text-[26px] lg:text-[30px] font-bold leading-tight mb-2">
                    Built on trust, not just traffic
                </h2>

                <p className="font-poppins text-[#555] text-[13px] sm:text-[14px] md:text-[16px] font-normal leading-[1.5] max-w-[650px] mx-auto px-4">
                    We're a guidance platform first every partnership sits
                    inside content people already rely on to make decisions.
                </p>
            </div>

            <div className="py-2 mt-3 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {partnerFeatures.map(({ icon: Icon, bg, title, description }) => (
                    <div
                        key={title}
                        className="bg-white rounded-[16px] p-5 md:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
                    >
                        <div
                            className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-4"
                            style={{ backgroundColor: bg }}
                        >
                            <Icon size={20} className="text-black" />
                        </div>

                        <h3 className="font-lato text-[16px] md:text-[17px] font-bold text-[#171717] mb-2">
                            {title}
                        </h3>

                        <p className="font-poppins text-[#555] text-[13px] md:text-[14px] font-normal leading-[1.5]">
                            {description}
                        </p>
                    </div>
                ))}
            </div>

            <div className="text-center py-2 mt-6 md:mt-10">
                <p className="font-poppins text-[#5FA9A8] text-[11px] sm:text-[12px] font-semibold italic tracking-[1px] uppercase mb-3">
                    Partnerships
                </p>

                <h2 className="font-lato text-[#171717] text-[20px] sm:text-[22px] md:text-[26px] lg:text-[30px] font-bold leading-tight mb-2">
                    A few ways to work together
                </h2>
            </div>

            <div className="py-2 mt-3 md:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {partnerWays.map(({ number, title, description }) => (
                    <div
                        key={number}
                        className="bg-white rounded-[16px] p-5 md:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.06)] flex gap-4"
                    >
                        <div className="w-9 h-9 shrink-0 rounded-[10px] bg-black flex items-center justify-center">
                            <span className="font-poppins text-white text-[12px] font-bold">
                                {number}
                            </span>
                        </div>

                        <div>
                            <h3 className="font-lato text-[15px] md:text-[16px] font-bold text-[#171717] mb-1">
                                {title}
                            </h3>

                            <p className="font-poppins text-[#555] text-[13px] md:text-[14px] font-normal leading-[1.5]">
                                {description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            <div id="partner-inquiry-form" className="md:mt-8 lg:max-w-[720px] lg:mx-auto scroll-mt-24">
                <PartnerInquiryForm />
            </div>
            </div>
        </div>
    )
}

export default page