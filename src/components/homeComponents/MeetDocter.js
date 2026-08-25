"use client"

import { useState } from "react"
import Image from "next/image"
import Doc1 from "@/assets/images/Manali.jpeg"
import Doc2 from "../../assets/images/Monika.jpeg"

const monikaPoints = [
    "Dr. Monika Kodwani is a clinical cosmetologist and aesthetic practitioner specializing in skin and hair treatments. She holds a BAMS degree and PGDCC from IIAM, with additional certifications in aesthetic skin therapies.",
    "Her expertise includes PRP, chemical peels, laser treatments, microneedling, acne, pigmentation, anti-aging, and hair fall treatments.",
    "Her approach is personalized, safe, and results-driven, focused on natural-looking results and long-term skin health.",
]

const manaliPoints = [
    "Dr. Manali Thakre is a Qualified dermatologist and cosmetologist with 10 years of experience in skin, hair and nail care.",
    "Specializes in skin analysis, pigmentation, acne and acne scar management.",
    "Offers advanced treatments like chemical peels, hydrafacial, laser procedures and hair fall therapies.",
    "Known for her approachable, attentive and patient-focused care.",
]

function DoctorFlipCard({ image, name, points }) {
    const [flipped, setFlipped] = useState(false)

    return (
        <div
            className="w-[180px] h-[220px] md:w-[240px] md:h-[340px] cursor-pointer"
            style={{ perspective: "1200px" }}
            onClick={() => setFlipped((prev) => !prev)}
        >
            <div
                className="relative w-full h-full transition-transform duration-700"
                style={{
                    transformStyle: "preserve-3d",
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                }}
            >
                {/* Front: photo */}
                <div
                    className="absolute inset-0 flex flex-col items-center"
                    style={{ backfaceVisibility: "hidden" }}
                >
                    <Image
                        src={image}
                        alt={name}
                        className="object-cover w-[150px] h-[165px] md:w-[220px] md:h-[280px] rounded-sm"
                    />
                    <p className="font-lato text-xs md:text-base mt-2 md:mt-3 text-center">{name}</p>
                </div>

                {/* Back: bio */}
                <div
                    className="absolute inset-0 bg-white border border-gray-200 rounded-sm p-2 md:p-4 overflow-y-auto"
                    style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                    }}
                >
                    <p className="font-lato text-[11px] md:text-sm font-semibold mb-1 md:mb-2">{name}</p>
                    <ul className="space-y-1.5 md:space-y-2 text-[9px] md:text-xs text-gray-700 list-disc pl-3 md:pl-4 text-left">
                        {points.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}

export function MeetDoctor() {
    return (
        <>
            <div className="bg-[#FAF9F6] px-3 py-8 md:py-12">
                <h2
                    style={{ letterSpacing: "0.1em" }}
                    className="font-lato text-lg uppercase md:text-3xl text-center mb-8 md:mb-12"
                >
                    Meet Our Doctors
                </h2>

                {/* Desktop / tablet layout */}
                <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-10 lg:gap-16 max-w-6xl mx-auto">
                    <ul className="space-y-4 text-sm text-gray-700 list-disc pl-4">
                        {monikaPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>

                    <div className="flex items-start gap-6">
                        <div className="flex flex-col items-center">
                            <Image
                                src={Doc2}
                                alt="Dr. Monika Kodwani"
                                className="object-cover w-[220px] h-[280px] lg:w-[260px] lg:h-[320px] rounded-sm"
                            />
                            <p className="font-lato text-base mt-3">Dr. Monika Kodwani</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Image
                                src={Doc1}
                                alt="Dr. Manali Thakre"
                                className="object-cover w-[220px] h-[280px] lg:w-[260px] lg:h-[320px] rounded-sm"
                            />
                            <p className="font-lato text-base mt-3">Dr. Manali Thakre</p>
                        </div>
                    </div>

                    <ul className="space-y-4 text-sm text-gray-700 list-disc pl-4">
                        {manaliPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>

                {/* Mobile layout: tap the photo to flip and reveal bio */}
                <div className="md:hidden flex flex-row items-start justify-center gap-3 max-w-md mx-auto">
                    <DoctorFlipCard image={Doc2} name="Dr. Monika Kodwani" points={monikaPoints} />
                    <DoctorFlipCard image={Doc1} name="Dr. Manali Thakre" points={manaliPoints} />
                </div>
            </div>
        </>
    )
};

export default MeetDoctor;
