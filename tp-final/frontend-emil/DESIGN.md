---
name: Natura Estética Integral
description: A mechanical split-flap departure board for booking beauty treatments.
colors:
  tablero: "#141009"
  tablero-hondo: "#0b0806"
  solapa: "#e7ddc8"
  solapa-alta: "#efe6d4"
  solapa-tinta: "#171209"
  solapa-luz: "#f6f0e1"
  costura: "#b1a688"
  marfil: "#f4efe3"
  marfil-tenue: "#bcb298"
  marfil-debil: "#9a8f72"
  senal: "#f0a62e"
  senal-viva: "#ffc24d"
typography:
  display:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(2rem, 8.6vw, 7rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(1.9rem, 5vw, 3.4rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(1.4rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Saira, sans-serif"
    fontSize: "1.06rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.26em"
  mono:
    fontFamily: "Martian Mono, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
    fontFeature: "\"tnum\" 1, \"zero\" 1"
rounded:
  none: "0"
  flap: "0.06em"
  pill: "999px"
spacing:
  gutter-sm: "1.5rem"
  gutter-md: "2.5rem"
  gutter-lg: "4rem"
  section-y: "5rem"
  section-y-lg: "8rem"
  container: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.senal}"
    textColor: "{colors.tablero}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "1.25rem 2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.senal-viva}"
    textColor: "{colors.tablero}"
  chip-directo:
    backgroundColor: "{colors.senal}"
    textColor: "{colors.senal}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.625rem"
  chip-valoracion:
    textColor: "{colors.marfil-tenue}"
    rounded: "{rounded.none}"
    padding: "0.25rem 0.625rem"
  flap-cell:
    backgroundColor: "{colors.solapa}"
    textColor: "{colors.solapa-tinta}"
    typography: "{typography.display}"
    rounded: "{rounded.flap}"
---

# Design System: Natura Estética Integral

## Overview

**Creative North Star: "The Departure Board"**

This is a mechanical split-flap panel — a Solari board lifted out of a train station and hung in a beauty studio. The entire surface is a warm board-black room; treatments, prices and availability arrive the way a schedule updates: ivory flaps spin, shuffle characters, and settle into place one cell at a time. The world is physical and legible before it is decorative. Nothing floats, nothing glows for its own sake; a tile is a tile, cast on black with a real shadow and split by a visible seam so the eye reads it as a mechanism, not a card.

The palette is warm and narrow: a deep warm-black ground, warm-ivory flap faces with dark ink, ivory text in three tints, and a single saturated amber that does all the signalling. Type is one condensed-grotesque family in two widths (Saira Condensed for the painted caps, Saira for running text) plus a measuring monospace (Martian Mono) reserved for data — prices, durations, times, always tabular. Geometry is hard: zero radius on every chip, button and container; the only curves are the hairline corner of a flap cell and the live dot.

The anti-references are deliberate and absolute. This rejects the beauty-industry default (blurred photo, thin serif, cream calm, "your moment of relaxation", a contact form) and it rejects the sibling frontend's world (olive green, Archivo, a 1px spine). The motion is the identity: the flip is functional — it reveals the hook on load, spells names into view, settles status — and never loops as ornament.

**Key Characteristics:**
- Warm board-black room; warm-ivory mechanical flaps seated with a real shadow.
- One amber signal carrying status, the single action, and the live pulse.
- Status read by structure (filled vs. outlined + notch), never by color alone.
- Hard zero-radius geometry; data always tabular monospace.
- The split-flap flip as a functional, reserved signature — never decorative.

## Colors

A warm, narrow palette: everything is tinted toward amber-black and ivory, with exactly one saturated voice.

### Primary
- **Signal Amber** (`#f0a62e`): The single saturated voice. It carries status (the DIRECTO chip, the amber ESTADO column), the primary action (the solid CTA block), the live pulse dot, the selection highlight, and the focus ring. It never appears as a casual decorative accent.
- **Amber Lit** (`#ffc24d`): The amber turned up — the hover state of the primary action only.

### Neutral — the room
- **Board Black** (`#141009`): The warm board-black ground; the page and body background, the room every flap hangs in.
- **Deep Well** (`#0b0806`): The darker pit behind the flaps; the background of the recessed sections (Como, Cierre) and the scrollbar track.

### Neutral — the flap
- **Flap Ivory** (`#e7ddc8`): The face of a flap tile; warm ivory, like a real Solari leaf.
- **Flap Ivory High** (`#efe6d4`): The top half of a flap, one step lighter so the fold reads.
- **Flap Ink** (`#171209`): The dark ink of characters printed on the ivory flap.
- **Flap Light-Edge** (`#f6f0e1`): The sliver of light under the seam and the inset top highlight.
- **Seam** (`#b1a688`): The horizontal fold line crossing every flap cell.

### Neutral — ivory text on the board
- **Ivory** (`#f4efe3`): Primary text on the dark board; headlines, the price column, brand mark.
- **Ivory Soft** (`#bcb298`): Secondary text — paragraphs, secondary data (duration, seña), the VALORACIÓN chip.
- **Ivory Faint** (`#9a8f72`): Low-hierarchy metadata, column headers, dividers; held to ≥4.5:1 on the board.

### Named Rules
**The One Signal Rule.** Amber (`#f0a62e`) is the only saturated color, and it means one thing: *live / actionable*. Status, the single CTA, and the pulse dot are all it may touch. If a new surface uses amber to decorate, it has broken the system.

**The Never-Gray Rule.** Secondary and faint text are tints of the ivory (`#bcb298`, `#9a8f72`), never neutral gray. The whole room is warm; a cold gray would read as a foreign tile.

## Typography

**Display Font:** Saira Condensed (with sans-serif fallback) — weights 600/700/800
**Body Font:** Saira (with sans-serif fallback) — weights 400/500/600
**Label/Mono Font:** Martian Mono (with monospace fallback) — weights 400/500/600, tabular

**Character:** One condensed-grotesque family in two widths gives the system a single mechanical voice — the condensed cut is the paint on the flaps and the headlines; the normal width is the quiet running text. The monospace is the instrument panel: it only ever carries measurable data, always with tabular figures so columns of numbers line up like a real schedule.

### Hierarchy
- **Display** (Saira Condensed 700, `clamp(2rem, 8.6vw, 7rem)`, line-height 1, uppercase): The split-flap hook only — the hero ("SE TOMA SOLO · AL INSTANTE") and the closing ("RESERVÁ AHORA"). Rendered character-by-character as flap cells.
- **Headline** (Saira Condensed 700, `clamp(1.9rem, 5vw, 3.4rem)`, line-height 0.98, tracking -0.02em, uppercase): Section titles.
- **Title** (Saira Condensed 600, `clamp(1.4rem, 3vw, 2rem)`, tracking -0.015em, uppercase): Step headings; treatment names run slightly smaller (1.35–1.5rem).
- **Body** (Saira 400, 1.02–1.18rem, line-height 1.6): Running paragraphs, held to ~30–40ch measures.
- **Label** (Saira Condensed 600, 0.8–0.95rem, uppercase, wide tracking 0.18em–0.34em): The brand masthead and inline nav links.
- **Mono / Data** (Martian Mono 400–500, 0.64–0.9rem, `font-variant-numeric: tabular-nums`, `"tnum" 1, "zero" 1`): Prices, durations, times, column headers, status chips, all small uppercase meta labels.

### Named Rules
**The Tabular Data Rule.** Any measurable value — price, seña, duration, time — is Martian Mono with tabular figures (`.mono`). A number set in the condensed display face is a bug: data belongs to the instrument panel.

**The Painted-Caps Rule.** The display face is always uppercase. The condensed cut exists to be the paint on the flaps; it never sets a sentence in mixed case.

## Layout

Mobile-first, designed and tested at 390px. A single centered column caps at **1240px** (`max-w-[1240px]`) with a responsive gutter that steps `1.5rem` → `2.5rem` (sm, 640px) → `4rem` (lg, 1024px). Vertical rhythm between sections runs `5rem` → `7–8rem` at sm and up.

The composition is asymmetric and loaded: content weights to the left (masthead, hook, CTA), leaving charged board-black emptiness to the right rather than filling a uniform grid. Two-column section layouts use an intentionally uneven split (`minmax(0,26rem)_1fr`, `minmax(0,24rem)_1fr`) with a sticky heading column on desktop.

The treatments board is the one true grid: a five-column schedule `[1fr 7rem 9rem 8rem 10rem]` (Treatment · Duration · Price · Seña · Status) above the `md` (768px) breakpoint, collapsing to a single stacked column with inline labels on mobile. Breakpoints are Tailwind defaults: sm 640px, md 768px, lg 1024px.

## Elevation & Depth

Depth is physical, not ambient. The board is flat black; the only thing that lifts is a flap tile, which casts a real drop shadow onto the board so it reads as a leaf resting on a panel — not a UI card with a soft glow. Recessed sections (Como, Cierre) sit on the deeper well color (`#0b0806`) and are separated by hairline ivory-faint rules rather than shadows. There is no hover-elevation vocabulary; surfaces do not rise on interaction.

### Shadow Vocabulary
- **Flap seating** (`box-shadow: 0 2px 7px rgba(0,0,0,0.5), inset 0 1px 0 var(--color-solapa-luz)`): The only shadow in the system. An offset-and-blur drop shadow seating the ivory flap on black, plus a 1px inset top light-edge. It belongs to the flap cell and nothing else.

### Named Rules
**The No-Float Rule.** Only a flap tile casts a shadow, and only to sit on the board. Chips, buttons, and containers are flat and seated; a drop shadow anywhere but a flap is foreign to the world.

## Shapes

Hard geometry. Chips, the CTA, containers, and the schedule rows are all zero-radius (`rounded-none`); squareness is the mechanical default. The only radii in the system are functional: the `0.06em` corner of a flap cell (a real tile has a rounded lip) and full-pill circles (`999px`) for the live dot, the step markers, and the scrollbar thumb. Separation between rows and sections is done with 1px ivory-faint rules at low opacity (18–30%), echoing the flap seam. Every flap cell carries the horizontal costura seam across its middle — the line that makes it read as mechanical rather than as a flipping card.

## Components

### Buttons
- **Shape:** Zero radius (`rounded-none`) — a solid rectangular block.
- **Primary (Acción):** The single solid amber block (`bg-senal`), dark ink (`text-tablero`, because amber does not reach contrast with light text), uppercase Saira Condensed bold, tracking 0.04em, with a drawn single-stroke arrow. Sizes: `1.25rem 2.25rem` (grande) or `1rem 1.75rem`.
- **Hover / Active:** Hover shifts to Amber Lit (`#ffc24d`) and nudges the arrow right; `:active` drops to `scale(0.97)` so it feels pressed. Transition is transform + background only, 150ms on `--ease-salida`.
- **Secondary:** A text link in condensed caps, underlined with a 2px amber decoration at a wide offset; on hover the text turns amber. There is no second button fill — the primary action never competes.

### Chips (ESTADO — status by structure)
- **DIRECTO:** Low-amber wash (`bg-senal/15`), amber text (`text-senal`), uppercase mono, zero radius. The "reservable now" state.
- **VALORACIÓN:** No fill; a hairline border (`border-marfil-débil/45`), ivory-soft text, plus a left **notch** (the `.muesca` 1px tick). The "needs a prior consult" state, read by its outline and notch, not by color.
- **Behavior:** Each chip flips in on scroll (`.flip-in`, `rotateX(-90deg)→0`, 420ms on `--ease-solapa`) as a single unit, the board settling into view.

### Cards / Containers
There are no cards. Content sits directly on the board or the deeper well, separated by hairline rules. Where grouping is needed, it is a schedule row, not a boxed card.

### Signature Component — The Split-Flap (SplitFlap)
The identity. Each character is a flap cell: two fixed halves and two rotating leaves — the top of the old character falls (`rotateX 0→-90deg`), the bottom of the new enters (`90→0deg`), ~140ms per step on `--ease-solapa` (`cubic-bezier(0.32,0.72,0,1)`), cells staggered 45ms apart. A cell shuffles 3–9 random characters before settling. At rest it is a single ivory face with the seam (`.flap__rest`). SSR, no-JS, and `prefers-reduced-motion` all render the final characters with no spin. Used only to reveal the hero hook on load and the closing line on scroll.

### Live Dot (PuntoVivo)
A `0.5rem` amber circle with an expanding ring pulse (`latido`, 2.4s). Marks "live / 24h". Stops animating under reduced-motion.

## Do's and Don'ts

### Do:
- **Do** keep amber (`#f0a62e`) as the only saturated color, reserved for status, the one CTA, and the live dot (The One Signal Rule).
- **Do** set every measurable value (price, seña, duration, time) in Martian Mono with tabular figures.
- **Do** express status by structure — a filled chip vs. an outlined chip with a notch — so it survives without color.
- **Do** keep geometry hard: zero radius on chips, buttons, and containers; separate with hairline ivory-faint rules.
- **Do** carry the costura seam across every flap cell, and seat flaps with the one allowed shadow.
- **Do** reserve the flip for functional reveals (hook on load, status settling, names into view) and honor `prefers-reduced-motion` by showing the final state.

### Don't:
- **Don't** use amber as a decorative accent, or give the system a second button fill that competes with the primary action.
- **Don't** introduce neutral gray; secondary text is a tint of the ivory.
- **Don't** add rounded cards, decorative gradients, drop shadows outside the flap, or stock photography.
- **Don't** set data or numbers in the condensed display face, and don't set the display face in mixed case.
- **Don't** loop the flip as ambient ornament, or reach for the beauty-default (blurred photo, thin serif, cream, soft-focus calm) or the sibling frontend's olive-green world.
