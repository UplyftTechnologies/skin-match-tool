import { DEFAULT_PROFILE } from '@/lib/default-profile'

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
