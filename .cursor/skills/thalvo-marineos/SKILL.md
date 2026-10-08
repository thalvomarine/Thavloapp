---
name: thalvo-marineos
description: >-
  Thalvo MarineOS product rules for the Turkish-coast chart, dealer desk, auth,
  and live site. Use when changing thalvo.org UI, Supabase auth, the public
  chart, dealer or captain flows, or shipping to main.
---

# Thalvo MarineOS

- Stack: React, Vite, Tailwind, Leaflet, Supabase. Cockpit colours are navy `#0A192F`, cyan `#00F0FF`, amber `#F5B942`.
- Units: knots, nautical miles, metres. Coordinates use `formatDm` (`DD°MM.MM'`).
- Public chart tiles: Esri World Dark Gray plus OpenSeaMap. Do not use deprecated CartoDB key endpoints. Do not put live boat or technician pins on the public chart.
- The cockpit does not draw routes and has no north-lock control. The desktop control panel is the only layer menu; the layers button is for narrow screens.
- Coverage copy is Aegean and Mediterranean. Marina names stay as real places.
- An open SOS stays on Görevler until the captain cancels it or it is completed. Cancel and live position use `cancel_own_call` and `refresh_own_call_position` in `20261008143000_cancel_and_live_call.sql`.
- Appearance: `system` keeps this cockpit, `day` is white, `night` is black. Stored in `thalvo-theme`.
- Captain signup stays the boat flow. Dealer signup is a company desk (contact, legal name, home marina, phone) and opens `/app/dealer`, not the vessel passport.
- Supabase email confirmation stays on. After signup the visitor enters the public chart with an unverified-email warning. The cockpit opens after the confirmation link.
- An empty catalogue is an empty state, not a load error.
- THALVO AI answers seamanship, machinery, and weather without inventing wave heights. If the server function fails, the client still answers from `answerFromTraining`.
- Do not commit route-drawing leftovers, `print/`, whitepaper drafts, or local config copies. Do not print Supabase keys. Payments stay simulated and labelled.
- `routeTree.gen.ts` is generated. Do not hand-edit it.
- Live site: push `main`. GitHub deploys thalvo.org. Do not redeploy an old TanStack Start build.
