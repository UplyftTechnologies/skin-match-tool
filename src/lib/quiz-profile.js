import { DEFAULT_PROFILE } from './default-profile.js'
import { concernAreaFor } from './concern-area.js'

const concernLabels = {
    'body acne': 'Body Acne',
    'open pores': 'Open Pores',
    'dark spots': 'Dark Spots/Pigmentation',
    'barrier repair': 'Barrier Repair',
    'uneven skin': 'Uneven Skin Tone',
    wrinkles: 'Wrinkles/Fine lines',
    redness: 'Redness/Irritation',
}

const conditionLabels = {
    pregnancy: 'Pregnant',
    'breast feeding': 'Breastfeeding',
    'excessive dryness': 'Excessive Dryness',
    none: 'None',
}

function normalizedLabel(value) {
    return String(value || '').trim().toLowerCase()
}

function mappedConcerns(answers, includeNone = false) {
    return (Array.isArray(answers?.concerns) ? answers.concerns : [])
        .filter((concern) => includeNone || normalizedLabel(concern) !== 'none')
        .map((concern) => concernLabels[normalizedLabel(concern)] || concern)
}

function mappedConditions(answers) {
    return (Array.isArray(answers?.conditions) ? answers.conditions : [])
        .map((condition) => conditionLabels[normalizedLabel(condition)] || condition)
}

export function quizAnswersToScoringProfile(answers) {
    if (!answers) return { ...DEFAULT_PROFILE }

    const concerns = mappedConcerns(answers)
    const conditions = mappedConditions(answers)

    return {
        concernArea: concernAreaFor(answers),
        age: answers.age || DEFAULT_PROFILE.age,
        selectedGender: normalizedLabel(answers.gender) || DEFAULT_PROFILE.selectedGender,
        selectedSkinType: answers.skinType || DEFAULT_PROFILE.selectedSkinType,
        selectedSensitive: normalizedLabel(answers.sensitive) === 'yes',
        selectedFaceBodyConcerns: concerns,
        selectedLipsEyesConcerns: [],
        selectedSpecialConditions: conditions.length ? conditions : ['None'],
    }
}

export function quizAnswersToResultProfile(answers) {
    return {
        ...quizAnswersToScoringProfile(answers),
        selectedFaceBodyConcerns: mappedConcerns(answers, true),
    }
}

const reverseConcernLabels = {
    ...Object.fromEntries(
        Object.entries(concernLabels).map(([key, label]) => [label, key]),
    ),
    // Pill label is capitalized ("Redness"); the map key must stay lowercase for
    // normalizedLabel() lookups, so override the reverse value here.
    'Redness/Irritation': 'Redness',
}
const reverseConditionLabels = Object.fromEntries(
    Object.entries(conditionLabels).map(([key, label]) => [label, key]),
)
const genderOptionsByKey = {
    female: 'Female',
    male: 'Male',
    other: 'Other',
    'prefer not to say': 'Prefer not to say',
}
const skinTypeOptionsByKey = {
    oily: 'Oily',
    dry: 'Dry',
    normal: 'Normal',
    combination: 'Combination',
}
const conditionOptionsByKey = {
    pregnancy: 'Pregnancy',
    'breast feeding': 'Breast feeding',
    'excessive dryness': 'Excessive dryness',
    none: 'None',
}

// Best-effort inverse of quizAnswersToResultProfile — the DB only stores the
// normalized scoring profile, not the exact quiz-widget answer shape, so a
// exact pill casing is reconstructed. The explicit concern area is preserved;
// older profiles without it can only infer Body from Body Acne.
export function resultProfileToQuizAnswers(profile) {
    if (!profile) return null

    const storedConcern = (profile.selectedFaceBodyConcerns || [])
        .find((label) => normalizedLabel(label) !== 'none')
    const concern = storedConcern ? (reverseConcernLabels[storedConcern] || storedConcern) : ''

    return {
        skinType: skinTypeOptionsByKey[normalizedLabel(profile.selectedSkinType)] || profile.selectedSkinType || '',
        sensitive: profile.selectedSensitive === true ? 'Yes' : profile.selectedSensitive === false ? 'No' : '',
        concernArea: concernAreaFor(profile),
        concerns: concern ? [concern] : [],
        conditions: (profile.selectedSpecialConditions || [])
            .map((label) => conditionOptionsByKey[normalizedLabel(reverseConditionLabels[label] || label)] || label),
        age: profile.age || '',
        gender: genderOptionsByKey[normalizedLabel(profile.selectedGender)] || profile.selectedGender || '',
    }
}
