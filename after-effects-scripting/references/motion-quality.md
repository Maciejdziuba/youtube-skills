# Making it look expensive — the numbers

Researched and then verified in production builds. These are the settings that
separate premium motion from output that reads as a default preset. Apply them by
default; deviate deliberately, not by omission.

## Easing — the single clearest tell

AE's `KeyframeEase(speed, influence)`: influence is handle **length**. High
influence flattens the curve near that key, so the property moves slowly there.

**Never put the same influence on both sides of every keyframe.** Symmetric 50/50
easing everywhere is the most recognisable amateur signature — everything floats
in and floats out with no attack.

| Feel | Curve | AE influence |
|---|---|---|
| Premium ease-out | `cubic-bezier(0.16, 1, 0.3, 1)` | key1 **out 12**, key2 **in 84** |
| Weighted in/out (hero moves) | — | key1 out 38, key2 in 78 |
| Pass-through (multi-point path) | — | first out 20, middles 54/54, last in 88 |
| Floor impact | — | **0.5 / 0.5** — zero cushioning |
| Apex / hang | — | 90 / 90 |
| Exit | `cubic-bezier(0.4, 0, 1, 1)` | accelerate away, do not float to a stop |

Exits run **0.6–0.8×** the entrance duration.

`AE.cOut()`, `AE.cWeight()`, `AE.cThru()`, `AE.impact()`, `AE.hang()` implement
these.

## Timing (30 fps — double for 60)

| Action | Frames | ms |
|---|---:|---:|
| Opacity fade | 5–8 | 150–270 |
| Small entrance | 8–12 | 250–400 |
| Object / product entrance | 12–18 | 400–600 |
| Exit | 6–10 | 200–330 |
| Scene transition | 15–24 | 500–800 |
| Hero camera move | 24–45 | 800–1500 |

**Stagger** repeated elements 2–4 frames (0.066–0.13 s). Keep stagger at 10–20%
of each element's own duration. Cap a full cascade at ~24 frames so it reads as
one event, not a queue.

**Overlap**: a child element (text inside a card) starts **2 frames** after its
container. As one element settles the next is already beginning.

**Overshoot: 1.5–3% only.** 8% reads as cheap. Damped settle 100 → 102 → 99.5 →
100 over 3/2/2 frames.

## Shadows — never one blurred ellipse

Real shadows are a tight contact component plus a broad ambient one. Stack three
at 1× / 2× / 4× blur, halving opacity each step:

| Layer | Blur | Opacity | Offset |
|---|---:|---:|---:|
| Contact | 9 | 21% | 0–3 |
| Occlusion | 22 | 11% | 3–12 |
| Ambient | 64 | 5% | 10–30 |

- Blur radius ≈ **2–3× the offset**.
- Squash vertically to **30–40%** height for a surface shadow.
- Colour: cool dark violet or neutral, **never pure black**.
- Drive opacity and blur off the object's height so the shadow opens up as it
  rises — that is what sells contact.

## Glows and bloom — never one Glow effect

AE's `ADBE Glo2` on light or pastel artwork blows it to flat white; every channel
sails past the threshold. Instead stack blurred copies of the artwork in Add mode:

| Layer | Blur | Opacity |
|---|---:|---:|
| Core | 4 | 42% |
| Mid | 22 | 17% |
| Wide | 92 | 6% |

Roughly halve opacity per doubled radius. Equal opacities produce a visible halo
ring. Keep the source crisp and blur only the duplicates. Bloom should touch
5–20% of the frame, not wash the silhouette.

**Glass and translucent panes use Screen, not Add.** Additive panes stack and
flood the frame, destroying a dark background. Glass transmits light; it does not
emit it.

## Motion blur

Comp settings: shutter angle **180°** natural, **90–120°** for crisp UI,
**200–300°** for fast sweeps. Samples **32**, adaptive limit **128**, shutter
phase **−90**.

Motion blur should be proportional to velocity — if an element moves a few pixels
per frame, turn it off. Excessive blur makes clean motion look soft, not
expensive.

## Colour and finish

- **16 bpc**, never 32 (see api-gotchas).
- Add **1.5–2% mono noise** on an adjustment layer as a finishing grain — it also
  hides residual banding.
- A subtle vignette: full-frame dark solid, inverted rounded mask, feather ~300.
- Keep backgrounds **near-black, never pure black**, with a coloured glow
  somewhere in frame.

## Camera and macro movement

- **One deliberate idea per section** — push, track, orbit or parallax. Not all
  four at once.
- Push-in **2–6% over 1–1.5 s**. Lateral drift **20–80 px over 1–2 s**.
- Long lens (**70–120 mm**) for restrained product perspective; `AE.camera(name, 85)`
  accepts millimetres.
- Rotation **0.5–2°**; reserve 3–5° for a deliberate reveal.
- Camera duration **1.5–2.5×** object duration — the camera is always the slower
  element.
- **No perpetual aimless drift.** Settle, then one purposeful slow push. A
  continuous sine on everything reads as a screensaver.

## Form and depth

- A flat gradient shape reads as a sticker. Add **form shading** inside its
  matte: a dark cool ellipse (Multiply, ~30%, large blur) at the lower right, and
  a white specular ellipse (~36%) at the upper left.
- Something should always be **slightly** out of focus — but soft-focus on
  everything is emptiness, not restraint. Keep at least one crisp element per
  frame for the eye to hold.
- Assign blur by distance from a focal plane so depth is legible.

## Composition discipline

- Never more than two things demanding attention at once.
- A lone thin bright line floating in soft light reads as a stray path, not as
  design. Either give it a form to belong to, or remove it.
- Leave real moments of near-stillness. They make the moves that follow land.
