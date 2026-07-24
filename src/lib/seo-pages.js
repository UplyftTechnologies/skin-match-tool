const baseProfile = {
  age: "Adult",
  selectedGender: "female",
  selectedSkinType: "Normal",
  selectedSensitive: false,
  selectedFaceBodyConcerns: [],
  selectedLipsEyesConcerns: [],
  selectedSpecialConditions: ["None"],
};

export const SKIN_GUIDES = [
  {
    slug: "oily-skin-acne",
    title: "Skincare Products for Oily, Acne-Prone Skin",
    description: "Compare cleansers, serums, moisturisers and sunscreens scored for oily, acne-prone skin, with a simple routine and safety guidance.",
    eyebrow: "Oily skin and acne guide",
    answer: "For oily, acne-prone skin, start with a gentle cleanser, a lightweight moisturiser and daily sunscreen. Add one acne-focused treatment at a time, and avoid aggressive cleansing that leaves skin tight or irritated.",
    profile: {
      ...baseProfile,
      selectedSkinType: "Oily",
      selectedFaceBodyConcerns: ["Acne"],
    },
    faqs: [
      ["Does oily skin still need moisturiser?", "Yes. A lightweight moisturiser can support the skin barrier without requiring a heavy texture. Choose according to comfort and product instructions."],
      ["Should every acne product be used together?", "No. Introduce one treatment at a time so you can judge tolerance and avoid unnecessary dryness or irritation."],
      ["When should acne be reviewed by a dermatologist?", "Seek professional advice for painful, cystic, scarring or persistent acne, or when over-the-counter care causes significant irritation."],
    ],
  },
  {
    slug: "dry-sensitive-skin",
    title: "Skincare Products for Dry, Sensitive Skin",
    description: "Explore skincare matches for dry, sensitive skin with gentle cleansing, moisturising and barrier-support guidance.",
    eyebrow: "Dry and sensitive skin guide",
    answer: "Dry, sensitive skin usually benefits from a short routine: gentle cleansing, a comfortable barrier-supporting moisturiser and daily sunscreen. Introduce strong actives slowly and stop products that cause persistent burning or redness.",
    profile: {
      ...baseProfile,
      selectedSkinType: "Dry",
      selectedSensitive: true,
      selectedFaceBodyConcerns: ["Dryness"],
      selectedSpecialConditions: ["Excessive Dryness"],
    },
    faqs: [
      ["How often should dry, sensitive skin be cleansed?", "Use a gentle cleanser as needed and avoid repeated washing with hot water. Your skin should not feel stripped after cleansing."],
      ["Can sensitive skin use serums?", "It can, but product choice and frequency matter. Introduce one serum slowly and follow its instructions instead of layering several actives."],
      ["What indicates that a product should be stopped?", "Persistent burning, swelling, worsening redness or a rash are reasons to stop and seek professional advice when needed."],
    ],
  },
  {
    slug: "pigmentation",
    title: "Skincare Products for Pigmentation and Dark Spots",
    description: "Compare skincare products scored for dark spots and uneven pigmentation, including sunscreen, serum and moisturiser options.",
    eyebrow: "Pigmentation and dark spots guide",
    answer: "A pigmentation routine should begin with consistent broad-spectrum sunscreen because ongoing UV exposure can deepen visible dark spots. Treatment products should be introduced gradually and used consistently rather than combined all at once.",
    profile: {
      ...baseProfile,
      selectedSkinType: "Combination",
      selectedFaceBodyConcerns: ["Dark Spots/Pigmentation"],
    },
    faqs: [
      ["Why is sunscreen important for dark spots?", "UV exposure can make pigmentation appear darker and reduce the visible benefit of a treatment routine."],
      ["How quickly do dark spots improve?", "Visible change is gradual and varies by cause, product and consistency. Sudden or changing pigmentation should be professionally assessed."],
      ["Is every pigmentation product suitable during pregnancy?", "No. Product ingredients and pregnancy guidance differ, so use pregnancy-specific safety advice from a qualified clinician."],
    ],
  },
  {
    slug: "teen-acne",
    title: "Simple Skincare Products for Teen Acne",
    description: "Find a straightforward cleanser, moisturiser and sunscreen routine for teen acne using age-aware product matching.",
    eyebrow: "Teen acne guide",
    answer: "Teen acne care should stay simple: cleanse gently, moisturise, use sunscreen and add only one suitable acne treatment at a time. Harsh scrubs and frequently changing products can make irritation harder to understand.",
    profile: {
      ...baseProfile,
      age: "Teen",
      selectedSkinType: "Oily",
      selectedFaceBodyConcerns: ["Acne"],
    },
    faqs: [
      ["What is a simple teen skincare routine?", "A gentle cleanser, moisturiser and sunscreen form a practical base. Add acne treatment only when it is age-appropriate and well tolerated."],
      ["Should teenagers use strong anti-ageing actives?", "Strong actives are not automatically appropriate for younger skin. Follow age guidance and obtain professional advice for prescription treatments."],
      ["When does teen acne need medical help?", "Painful, deep, scarring or persistent acne should be assessed by a dermatologist rather than managed only through product changes."],
    ],
  },
  {
    slug: "dull-skin",
    title: "Skincare Products for Dull-Looking Skin",
    description: "Compare cleansers, serums, moisturisers and sunscreens matched for dull-looking skin and a brighter, hydrated routine.",
    eyebrow: "Dull-looking skin guide",
    answer: "For dull-looking skin, focus first on comfortable hydration and daily sunscreen. A suitable serum or exfoliating product can be added gradually, but using more active products does not always produce faster visible results.",
    profile: {
      ...baseProfile,
      selectedSkinType: "Normal",
      selectedFaceBodyConcerns: ["Dullness"],
    },
    faqs: [
      ["Can dehydration make skin look dull?", "Yes. When skin lacks comfortable hydration, its surface can appear less smooth and reflective."],
      ["Is exfoliation always necessary for dull skin?", "No. Some people benefit from careful exfoliation, while others improve by simplifying an irritating routine and supporting hydration."],
      ["Why include sunscreen in a brightening routine?", "Daily sunscreen helps limit UV-related tanning and uneven tone while supporting the rest of the routine."],
    ],
  },
  {
    slug: "barrier-repair",
    title: "Skincare Products for Skin Barrier Support",
    description: "Explore gentle cleansers, moisturisers and sunscreens matched for a barrier-support routine and irritated-feeling skin.",
    eyebrow: "Skin barrier support guide",
    answer: "A barrier-support routine should be minimal and comfortable: use gentle cleansing, moisturise consistently and protect skin from UV exposure. Pause unnecessary strong actives while skin feels persistently irritated.",
    profile: {
      ...baseProfile,
      selectedSkinType: "Dry",
      selectedSensitive: true,
      selectedFaceBodyConcerns: ["Barrier Repair"],
    },
    faqs: [
      ["What does a simple barrier-support routine include?", "Use a gentle cleanser, a moisturiser that feels comfortable and daily sunscreen. Avoid adding several new treatments at once."],
      ["Should exfoliating products be paused?", "If skin is burning, peeling or unusually irritated, reducing strong exfoliation can make the routine easier to tolerate."],
      ["When is irritation more than a product issue?", "Persistent pain, swelling, cracking, oozing or a spreading rash needs assessment from a qualified healthcare professional."],
    ],
  },
];

export function getSkinGuide(slug) {
  return SKIN_GUIDES.find((guide) => guide.slug === slug);
}
