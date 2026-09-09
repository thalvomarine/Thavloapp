# MarineOS Design Tokens

The canonical tokens live in `src/styles.css` under `:root` and
`@theme inline`. The following names are the semantic vocabulary the
codebase should use — do NOT introduce ad-hoc hex/oklch values in
components.

## Colors (semantic)

| Token           | CSS var / Tailwind                | Usage                                   |
| --------------- | --------------------------------- | --------------------------------------- |
| marine-black    | `--deep` / `bg-deep`              | Cockpit background, hero surfaces       |
| cockpit-black   | `oklch(0.13 0.02 250)`            | Sticky headers, capsule nav             |
| storm-gray      | `text-white/60` on dark           | Secondary body copy on cockpit          |
| graphite        | `border-white/10 bg-white/[0.03]` | Standard glass panel border/fill        |
| ocean-blue      | `--aqua` / `text-sky-*`           | Info state, active mission, links       |
| trust-green     | `text-emerald-*`                  | Success, reliable trust, delivered      |
| warning-amber   | `--amber` / `text-amber-*`        | Pending, low stock, medium risk         |
| sos-red         | `text-rose-*`                     | SOS, high risk leak, disputes           |
| muted-white     | `text-white/45..80`               | Micro/caption/body scale on cockpit     |

The SOS gradient (`SosDock`) is the ONLY saturated CTA on the cockpit.
Do not reuse the same gradient elsewhere.

## Spacing scale

Use only these values (px): **4, 8, 12, 16, 24, 32, 48, 64, 96**.
In Tailwind: `1, 2, 3, 4, 6, 8, 12, 16, 24`.

## Radius scale

| Token   | Value                       |
| ------- | --------------------------- |
| sm      | `--radius-sm`               |
| md      | `--radius-md`               |
| lg      | `--radius-lg` (default)     |
| xl      | `--radius-xl`               |
| cockpit | `rounded-2xl` (glass panels)|

## Typography scale

Family: `Inter` (body), `Montserrat` (Wordmark only).

| Token   | Tailwind                                     |
| ------- | -------------------------------------------- |
| display | `text-3xl font-semibold tracking-tight`      |
| heading | `text-xl font-semibold`                      |
| title   | `text-sm font-semibold`                      |
| body    | `text-[13px] text-white/80`                  |
| caption | `text-[11px] text-white/55`                  |
| micro   | `text-[10px] uppercase tracking-[0.22em]`    |

## Motion

| Token    | Duration |
| -------- | -------- |
| fast     | 150 ms   |
| standard | 220 ms   |
| slow     | 320 ms   |

Reserve the animated ping (`animate-ping`) for live status dots and the
SOS dock only.
