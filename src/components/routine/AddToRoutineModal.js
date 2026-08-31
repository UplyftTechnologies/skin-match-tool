'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import Image from 'next/image'
import { IoClose } from 'react-icons/io5'
import { FiCheck, FiMoon, FiSun } from 'react-icons/fi'
import { allSlots } from '@/lib/routine-steps'
import { getSavedRoutine, saveRoutine } from '@/lib/routine-storage'
import { trackingService } from '@/lib/tracking/trackingClient'
import { EVENTS } from '@/lib/tracking/events'

const TIME_META = {
    am: { label: 'AM', Icon: FiSun, badge: 'bg-amber-50 text-amber-700' },
    pm: { label: 'PM', Icon: FiMoon, badge: 'bg-indigo-50 text-indigo-700' },
}

// Lets a shopper file the product they were just looking at straight into an
// AM/PM routine slot, without leaving the home page — /build-routine reads
// the same localStorage routine, so a pick made here shows up there too.
//
// Only slots this product's own category actually belongs to are offered —
// a serum has no business being offered a spot as a cleanser.
export default function AddToRoutineModal({ open, onClose, product }) {
    const [addedSlotKey, setAddedSlotKey] = useState('')

    // `open` only ever flips true from a client-side click after mount, so
    // by the time this renders anything `document` is guaranteed to exist —
    // no need for a mounted-state effect just to guard the portal target.
    if (!open || !product || typeof document === 'undefined') return null

    const productCategory = product.category || product.product_type || ''
    const matchingSlots = allSlots().filter((slot) => slot.categories.includes(productCategory))

    function handlePick(slot) {
        const saved = getSavedRoutine()
        const routine = saved?.routine || { am: {}, pm: {} }
        const nextRoutine = {
            ...routine,
            [slot.time]: { ...routine[slot.time], [slot.id]: product },
        }
        saveRoutine(nextRoutine)

        trackingService.trackEvent(EVENTS.CLICKED_SAVE_MY_MATCH, {
            source: 'add_to_routine_modal',
            productId: product.product_uid,
            productName: product.product_name,
            routineTime: slot.time,
            routineStep: slot.id,
        })

        setAddedSlotKey(`${slot.time}-${slot.id}`)
        window.setTimeout(() => {
            setAddedSlotKey('')
            onClose()
        }, 900)
    }

    // Portaled to document.body: this modal is rendered inside a Swiper
    // slide, and Swiper puts a CSS transform on .swiper-wrapper — which
    // creates a new containing block for any descendant `position: fixed`
    // element, so the "full-screen" overlay was actually being confined to
    // the swiper track instead of the real viewport.
    return createPortal(
        <div
            className="fixed inset-0 z-[var(--z-overlay)] flex items-end justify-center bg-black/40 sm:items-center sm:px-4"
            onClick={(event) => {
                // Rendered inside the product card's own onClick={handleVisit}
                // wrapper — without this, a backdrop click bubbles up and
                // navigates away right after closing the modal.
                event.stopPropagation()
                onClose()
            }}
        >
            <div
                className="max-h-[85vh] w-full overflow-hidden rounded-t-2xl bg-white sm:max-w-sm sm:rounded-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5 sm:px-5 sm:py-4">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                        {product.image ? (
                            <Image src={product.image} alt="" fill sizes="40px" className="object-contain" />
                        ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-lato text-sm font-semibold text-gray-900">Add to Routine</h3>
                        <p className="truncate text-xs text-gray-400">{product.product_name}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 text-gray-400 hover:text-gray-700">
                        <IoClose size={20} />
                    </button>
                </div>

                {matchingSlots.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                        <p className="text-sm text-gray-600">
                            This isn&apos;t a Cleanser, Serum, Moisturiser or Sunscreen, so it doesn&apos;t
                            fit a fixed routine slot.
                        </p>
                        <Link
                            href="/build-routine"
                            className="mt-4 inline-block
                             rounded-full bg-[#D17A6D] px-5 py-2.5 text-xs 
                             font-semibold text-white hover:bg-[#D17A9D]"
                        >
                            Add it as an extra step
                        </Link>
                    </div>
                ) : (
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
                        {matchingSlots.map((slot) => {
                            const slotKey = `${slot.time}-${slot.id}`
                            const justAdded = addedSlotKey === slotKey
                            const { label: timeLabel, Icon: TimeIcon, badge } = TIME_META[slot.time]
                            return (
                                <button
                                    key={slotKey}
                                    type="button"
                                    onClick={() => handlePick(slot)}
                                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                                        justAdded
                                            ? 'border-emerald-200 bg-emerald-50'
                                            : 'border-gray-100 hover:border-[#f3c9d2] hover:bg-[#fdeef1]'
                                    }`}
                                >
                                    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${justAdded ? 'bg-emerald-100 text-emerald-700' : badge}`}>
                                        <TimeIcon aria-hidden="true" className="h-3 w-3" />
                                        {timeLabel}
                                    </span>
                                    <span className="flex-1 text-sm font-semibold text-gray-900">{slot.label}</span>
                                    {justAdded ? (
                                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                                            <FiCheck aria-hidden="true" /> Added
                                        </span>
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>,
        document.body,
    )
}
