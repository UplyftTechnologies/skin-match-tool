'use client'

import { useEffect, useState } from 'react'
import { getSavedRoutine } from '@/lib/routine-storage'

function routineHasProduct(routine, productUid) {
    if (!routine || !productUid) return false
    return Object.values(routine).some((steps) =>
        Object.values(steps || {}).some((product) => product?.product_uid === productUid),
    )
}

// Whether this product already occupies an AM or PM routine slot — lets the
// "Add to routine" button on a product card show a filled cart instead of an
// empty one, the same way the wishlist heart fills in. Mirrors
// use-routine-count.js's deferred-read + custom-event shape so it stays in
// sync with AddToRoutineModal's picks without a page reload.
export function useIsInRoutine(productUid) {
    const [inRoutine, setInRoutine] = useState(false)

    useEffect(() => {
        const update = () => setInRoutine(routineHasProduct(getSavedRoutine()?.routine, productUid))
        const timer = setTimeout(update, 0)
        window.addEventListener('roopsee-routine-updated', update)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('roopsee-routine-updated', update)
        }
    }, [productUid])

    return inRoutine
}
