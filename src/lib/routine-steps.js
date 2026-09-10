// Shared by the home page teaser (Routine.js), the full builder
// (build-routine/page.js), and the "Add to Routine" picker on product cards
// — one definition of what a routine step is and which time-of-day it
// belongs to, so all three stay consistent.
//
// Category values match canonicalCategory() (lib/retailer-catalog.js) exactly.
// Routine is capped at 4 essentials (Cleanser, Serum, Moisturiser, Sunscreen)
// plus up to 2 optional add-ons (Toner, Mask) — kept short on purpose.
export const STEP_DEFS = {
  cleanser: { label: "Cleanser", categories: ["Cleanser"] },
  toner: { label: "Toner", categories: ["Toner"], optional: true },
  serum: { label: "Serum", categories: ["Serum", "Treatment"] },
  mask: { label: "Mask", categories: ["Mask"], optional: true },
  moisturiser: { label: "Moisturiser", categories: ["Moisturizer"] },
  sunscreen: { label: "Sunscreen", categories: ["Sunscreen"] },
};

const OPTIONAL_STEPS = ["toner", "mask"];

// Optional slots share the same IDs across AM and PM; saved picks remain separate.
export const STEPS_BY_TIME = {
  am: ["cleanser", "serum", "moisturiser", "sunscreen", ...OPTIONAL_STEPS],
  pm: ["cleanser", "serum", "moisturiser", ...OPTIONAL_STEPS],
};

export function stepsForTime(time) {
  return STEPS_BY_TIME[time].map((id) => ({
    id,
    ...STEP_DEFS[id],
    optional: Boolean(STEP_DEFS[id].optional),
  }));
}

// Every AM/PM · step slot, flattened — what the "Add to Routine" picker
// offers when placing one already-known product into a slot.
export function allSlots() {
  return Object.entries(STEPS_BY_TIME).flatMap(([time, ids]) =>
    ids.map((id) => ({ time, id, ...STEP_DEFS[id] })),
  );
}
