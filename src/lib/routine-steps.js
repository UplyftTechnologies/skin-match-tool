// Shared by the home page teaser (Routine.js), the full builder
// (build-routine/page.js), and the "Add to Routine" picker on product cards
// — one definition of what a routine step is and which time-of-day it
// belongs to, so all three stay consistent.
//
// Category values match canonicalCategory() (lib/retailer-catalog.js) exactly.
export const STEP_DEFS = {
  cleanser: { label: "Cleanser", categories: ["Cleanser"] },
  serum: { label: "Serum", categories: ["Serum", "Treatment"] },
  moisturiser: { label: "Moisturiser", categories: ["Moisturizer"] },
  sunscreen: { label: "Sunscreen", categories: ["Sunscreen"] },
};

// Sunscreen has no place in a PM routine; serum is treated as PM-focused here.
export const STEPS_BY_TIME = {
  am: ["cleanser", "moisturiser", "sunscreen"],
  pm: ["cleanser", "serum", "moisturiser"],
};

export function stepsForTime(time) {
  return STEPS_BY_TIME[time].map((id) => ({ id, ...STEP_DEFS[id] }));
}

// Every AM/PM · step slot, flattened — what the "Add to Routine" picker
// offers when placing one already-known product into a slot.
export function allSlots() {
  return Object.entries(STEPS_BY_TIME).flatMap(([time, ids]) =>
    ids.map((id) => ({ time, id, ...STEP_DEFS[id] })),
  );
}
