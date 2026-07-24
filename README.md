# Roopsee Match Studio

A lightweight Next.js application that scores the live Roopsee catalog against a skincare profile and builds premium, value-fit, and weekly routines.

The complete application now runs in JavaScript. It does not require Python, Flask, pandas, or a separate API service.

## Run locally

Requirements:

- Node.js 20.9 or newer
- npm

Install and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create and run a production build:

```bash
npm run build
npm start
```

## Data

The application reads:

```text
data/products.csv
```

The CSV contains both live product information and the authoritative score columns. All 384 current catalog products have score data, so the application does not need to parse Excel workbooks at runtime.

The Excel files in `data/` remain source/reference files. Replace `products.csv` and restart the app when publishing an updated catalog.

## API

### `POST /api/recommend`

Returns ranked products, summary counts, component scores, explanations, and a routine.

```json
{
  "age": "Teen",
  "selectedGender": "male",
  "selectedSkinType": "Oily",
  "selectedSensitive": false,
  "selectedFaceBodyConcerns": ["Acne"],
  "selectedLipsEyesConcerns": [],
  "selectedSpecialConditions": ["None"]
}
```

### `POST /api/routine`

Accepts the same profile and returns only the routine response.

### `GET /api/coverage`

Supported modes:

- `all_pnc`: 2,016 profiles
- `skin_concern_type`: 112 profiles
- `with_special_conditions`: 1,008 profiles
- `representative`: up to 72 quick-check profiles

Example:

```text
/api/coverage?mode=representative&count=20&top_n=3&row_limit=10
```

### Other routes

- `GET /api/health`
- `GET /api/options`
- `GET /api/representative-profiles?count=72`

## Project structure

```text
src/
  app/
    api/                 Next.js API routes
    globals.css          Responsive application styles
    layout.js
    page.js
  components/
    match-studio.js      Quiz, product grid, routines, and details
  lib/
    constants.js         Quiz and score-column definitions
    data.js              Lightweight CSV parser and catalog loader
    engine.js            Scoring, ranking, routines, and coverage
    profiles.js          Profile rules and coverage generators
data/
  products.csv           Runtime catalog and scores
```

## Verification

```bash
npm run lint
npm run build
```

During migration, JavaScript results were compared with the former Python engine across:

- five varied customer profiles and their first 25 ranked products;
- the complete 72-profile representative coverage set;
- summary thresholds, routine selections, gender adjustments, scores, and usage timing.

The comparison completed with zero mismatches.

## Deploy

The repository is configured as a standard Next.js project for Vercel:

1. Import the repository into Vercel.
2. Keep the detected framework as Next.js.
3. Deploy without additional environment variables.

The Next.js server and API routes are deployed together.
