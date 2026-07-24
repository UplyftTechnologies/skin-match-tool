import { QUIZ_OPTIONS } from "./constants";
import { cleanText, normLabel } from "./data";

export const COVERAGE_MODES = {
  all_pnc: {
    label: "All PnC Combinations",
    description: "Skin type, sensitivity, one concern, special-condition state and age.",
    formula: "4 × 2 × 14 × 9 × 2 = 2,016",
  },
  skin_concern_type: {
    label: "Skin Concern Type",
    description: "Skin type, sensitivity and one concern.",
    formula: "4 × 2 × 14 = 112",
  },
  with_special_conditions: {
    label: "With Special Conditions",
    description: "Skin type, sensitivity, one concern and special-condition state.",
    formula: "4 × 2 × 14 × 9 = 1,008",
  },
  representative: {
    label: "Quick Representative Sample",
    description: "A small sample for smoke testing.",
    formula: "72 sampled profiles",
  },
};

const realSpecials = ["Excessive Dryness", "Pregnant", "Breastfeeding"];
const sensitivityStates = [
  { selectedSensitive: false, sensitivityState: "No" },
  { selectedSensitive: true, sensitivityState: "Yes" },
];

function choiceSets(items) {
  const sets = [];
  function collect(start, size, current) {
    if (current.length === size) {
      sets.push([...current]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index]);
      collect(index + 1, size, current);
      current.pop();
    }
  }
  for (let size = 1; size <= items.length; size += 1) {
    collect(0, size, []);
  }
  return sets;
}

function specialStates() {
  return [
    { specialConditionState: "No special selected (3C0)", selectedSpecialConditions: [] },
    ...choiceSets(realSpecials).map((conditions) => ({
      specialConditionState: conditions.join(", "),
      selectedSpecialConditions: conditions,
    })),
    { specialConditionState: "None", selectedSpecialConditions: ["None"] },
  ];
}

function baseProfiles({ includeAge, includeSpecials }) {
  const ages = includeAge ? QUIZ_OPTIONS.ages : ["Not selected"];
  const specials = includeSpecials
    ? specialStates()
    : [{ specialConditionState: "Not considered", selectedSpecialConditions: [] }];
  const profiles = [];

  for (const selectedSkinType of QUIZ_OPTIONS.skinTypes) {
    for (const sensitivity of sensitivityStates) {
      for (const age of ages) {
        for (const concern of QUIZ_OPTIONS.faceBodyConcerns) {
          for (const special of specials) {
            profiles.push({
              age,
              selectedGender: "",
              selectedSkinType,
              ...sensitivity,
              selectedFaceBodyConcerns: [concern],
              selectedLipsEyesConcerns: [],
              ...special,
              concernGroup: "Face & Body",
            });
          }
        }
      }
    }
  }
  return profiles;
}

export function profilesForMode(mode, count = 72) {
  if (mode === "skin_concern_type") return baseProfiles({ includeAge: false, includeSpecials: false });
  if (mode === "with_special_conditions") return baseProfiles({ includeAge: false, includeSpecials: true });
  if (mode === "representative") return representativeProfiles(count);
  return baseProfiles({ includeAge: true, includeSpecials: true });
}

export function representativeProfiles(limit = 72) {
  const profiles = [];
  for (let skinIndex = 0; skinIndex < QUIZ_OPTIONS.skinTypes.length; skinIndex += 1) {
    for (let sensitiveIndex = 0; sensitiveIndex < sensitivityStates.length; sensitiveIndex += 1) {
      for (let concernIndex = 0; concernIndex < QUIZ_OPTIONS.faceBodyConcerns.length; concernIndex += 1) {
        const gender = concernIndex % 2 === 0 ? "male" : "female";
        const options = gender === "male"
          ? [["None"], ["Excessive Dryness"]]
          : [["None"], ["Excessive Dryness"], ["Pregnant"], ["Breastfeeding"], ["Pregnant", "Breastfeeding"]];
        const profileIndex = skinIndex + sensitiveIndex + concernIndex;
        profiles.push({
          age: QUIZ_OPTIONS.ages[profileIndex % QUIZ_OPTIONS.ages.length],
          selectedGender: gender,
          selectedSkinType: QUIZ_OPTIONS.skinTypes[skinIndex],
          ...sensitivityStates[sensitiveIndex],
          selectedFaceBodyConcerns: [QUIZ_OPTIONS.faceBodyConcerns[concernIndex]],
          selectedLipsEyesConcerns: [],
          selectedSpecialConditions: options[profileIndex % options.length],
        });
        if (profiles.length >= limit) return profiles;
      }
    }
  }
  return profiles.slice(0, limit);
}

export function sanitizeProfile(input = {}) {
  const profile = { ...input };
  const rawSkin = cleanText(profile.selectedSkinType || "Normal");
  const skinKey = normLabel(rawSkin);
  const inferredSensitive = skinKey.includes("sensitive");
  const baseKey = normLabel(skinKey.replace("sensitive", ""));
  const baseSkin = {
    oily: "Oily",
    dry: "Dry",
    normal: "Normal",
    combination: "Combination",
  }[baseKey] || "Normal";

  let selectedSensitive = profile.selectedSensitive;
  if (typeof selectedSensitive !== "boolean") {
    const value = normLabel(selectedSensitive ?? profile.isSensitive);
    if (["yes", "true", "1", "y", "sensitive"].includes(value)) selectedSensitive = true;
    else if (["no", "false", "0", "n", "not sensitive", "none"].includes(value)) selectedSensitive = false;
    else selectedSensitive = inferredSensitive;
  }

  const adjustments = [];
  let specials = (profile.selectedSpecialConditions || ["None"])
    .map(cleanText)
    .filter(Boolean);
  if (normLabel(profile.selectedGender) === "male") {
    specials = specials.filter((item) => {
      if (["pregnant", "breastfeeding"].includes(normLabel(item))) {
        adjustments.push(`Ignored ${item} because selectedGender is male.`);
        return false;
      }
      return true;
    });
  }
  if (specials.length > 1) specials = specials.filter((item) => normLabel(item) !== "none");

  return [
    {
      ...profile,
      selectedSkinType: baseSkin,
      selectedSensitive,
      selectedSpecialConditions: specials.length ? specials : ["None"],
    },
    adjustments,
  ];
}
