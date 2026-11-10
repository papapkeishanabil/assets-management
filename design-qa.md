# Vendor dashboard cards — 10 November 2026

Deployment update: the approved frontend was released at 13.23 WIB, source
`539932d1`. See `docs/vendor-management/VENDOR_DASHBOARD_PRODUCTION_RELEASE_20261110.md`.
The QA results below describe the local pre-release verification.

**Target:** adopt the existing HARMAS dashboard card style shown in the user's
attached 1919 × 1062 light-theme screenshot. This is an update to the existing
application, not a standalone prototype or a clone of its asset-management content.
User has selected local implementation without exporting private source.

**Source visual truth:** user attachment in this conversation. Reproducible source
component: `src/pages/DashboardPage.jsx`, unchanged. Its card row was captured with
synthetic read-only API fixtures as
`docs/vendor-management/dashboard-cards-evidence/source-cards-light.png` and
`main-dashboard-reference.png`. The reproduced reference retains the source's
asset cards; its empty asset table/test user intentionally differ from the attachment.
It is not a screenshot of production or a stored copy of the uploaded attachment.

**Implementation:** `src/pages/vendor/VendorDashboardPage.jsx`.
Screenshots: `docs/vendor-management/dashboard-cards-evidence/`:

- `dashboard-reference-size.png`: vendor dashboard, light, 1919 × 1062.
- `vendor-cards-light.png`: focused KPI row, 1615 × 206.
- `vendor-cards-dark.png`: focused KPI row, dark.
- `dashboard-mobile.png`, `dashboard-mobile-lower-cards.png`: 390 × 844 viewports.
- `mobile-asset-card.png`: final mobile asset card, including its value and hint.
- `full-view-comparison.png`: source above implementation, each original 1919 × 1062.
- `cards-comparison.png`: source above implementation, both original 1615px width.
- `CAPTURE_DIMENSIONS.json`: CSS/pixel dimensions; deviceScaleFactor 1, no rescaling.

Both paired comparison files were opened and visually inspected. Focused comparison
is necessary because icon sizes, badges, typography and card spacing are too small
to judge from the full-page pair alone. Both reference and target use the same
local browser/font environment; external font requests were blocked during testing.
Configured font families remain the application's Inter and JetBrains Mono.

## Findings and comparison history

1. **P2, mobile scrolling / paint stability — resolved.** Initial lower-viewport
   capture showed the fourth KPI card blank after scrolling:
   `mobile-before-paint-fix.png`. The KPI card's redundant backdrop compositor layer
   was disabled locally on that component, retaining the existing glass tint,
   colored orb, border and hover styling. Captures now allow two paint frames after
   scroll and include an element capture. Rechecked final
   `dashboard-mobile-lower-cards.png` and `mobile-asset-card.png`: the rose and amber
   cards, numbers, labels and hints are visible. No global glass styles were changed.
2. **Reference capture harness — resolved, not a product defect.** The first API
   fixture did not expose Content-Range to the browser, so reference counts remained
   zero. Explicit CORS/exposed count headers corrected the synthetic reference.
   `reference-fixture-before-cors-fix.png` records that attempt. The final reference
   correctly renders 55 / 52 / 4 / 3; no application data/query changes were required.
3. **Post-fix paired review:** no remaining actionable P0/P1/P2 differences within
   the requested card-style scope. The same four semantic accents, 36px icon holders,
   16px Lucide icons, 20px padding, 16px grid gaps, 12px corners, uppercase labels and
   30px values are present. The target row is 206px high versus reference 202px
   because its hint line height is slightly more generous; accepted P3 difference.

## Required fidelity surfaces

| Surface | Result |
|---|---|
| Fonts/typography | Existing app fonts inherited; reference's uppercase 12px labels, mono hints and large values retained. No clipping at desktop/mobile widths. Remote font delivery itself was not tested. |
| Spacing/layout | Four equal columns at desktop; responsive stack at 390px. Icon position, padding and gutters match source. Existing operational/sourcing tabs add a deliberate row above KPIs. No horizontal page overflow. |
| Colors/tokens | Existing blue, green, rose and amber tokens and soft orb tints reused in light/dark. No global theme changes. Location badge says “LENGKAPI DATA”, not an operational emergency. |
| Images/assets | Existing HARMAS logo and Lucide icons reused, no generated or substitute brand assets. Icons represent vendor, GPS, location completeness and assets. Mini bars are a data visualization, not a decorative image. |
| Copy/content | Vendor-specific copy replaces asset-specific reference labels. GPS progress uses actual mapping coverage. Mini bars use current type counts, explicitly identified as composition rather than time trends; no copied +5% claim. |

## Browser verification

Existing local Chromium/Playwright + Supabase Docker workflow was reused. Production
Supabase requests are blocked. 15/15 checks passed, including existing data counts,
tabs/filters, keyboard, light/dark rendering, module guards, Sourcing/Direksi master
restrictions, unavailable location data, and reference capture. No pageerror or
browser business writes. Cleanup restored all 12 table checksums.

`npm run build`: exit 0. Existing >500 kB main bundle warning remains. No migration,
push or deployment. The local screenshot runner closes its test browser and removes
its fixtures; there is no persistent user preview or production login session open.

## Implementation checklist

- [x] Match supplied card style using existing app primitives.
- [x] Preserve vendor-focused data definitions and permissions.
- [x] Verify desktop, mobile scroll states, light/dark and key interactions.
- [x] Compare source and final captures together after the paint fix.
- [x] Save local evidence, build result and checksums.

**Follow-up polish:** the 4px desktop card-height difference is nonblocking. A
deployment and authenticated production UAT require the user's separate approval.

final result: passed
