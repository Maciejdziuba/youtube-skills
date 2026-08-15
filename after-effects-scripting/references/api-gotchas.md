# After Effects scripting — traps that fail silently or misleadingly

Everything here was hit in real builds against After Effects 2026 on macOS.
Each one cost a broken render or a wasted cycle. Check here before guessing a
match name.

## Match names you will get wrong

| Thing | Wrong | Correct |
|---|---|---|
| Camera zoom | `ADBE Zoomval` | walk `ADBE Camera Options Group`, match `name === "Zoom"` |
| Camera point of interest | `ADBE Point of Interest` | `ADBE Anchor Point` (inside `ADBE Transform Group`) |
| Transform effect | `ADBE Transform` | `ADBE Geometry2` |
| Text animator position | `ADBE Text Position` | **rejected** — animate the layer position instead |
| Noise effect params | `Amount of Noise` | match by name prefix `"Amount"` — see `AE.noise()` |

Effect parameter match names are **not** in UI order. 4-Color Gradient's
"Positions & Colors" is `-0011` while Point 1 is `-0001`. Address effect params
by their **English name** (`e.property("Point 1")`), never by index or a guessed
suffix. To discover names, add the effect to a throwaway comp and dump
`name` / `matchName` for every child.

## Properties that do not exist where you expect

**`transform.rotation` on a 3D layer is undefined.** 3D layers have
`xRotation` / `yRotation` / `zRotation`. Use `AE.setRot()`.

**Spatial properties take exactly ONE `KeyframeEase`.** Position, Point of
Interest and Anchor Point reject a per-dimension array; Scale and Color want one
per dimension. `AE.easeKey()` tries N and falls back to 1.

**Time Remap goes hidden if you remove every key.** Add the new keys first, then
delete the stale ones, or every later `setValueAtTime` throws "property or a
parent property is hidden".

## Behaviours that silently corrupt a build

**New layers are inserted next to the selection, not at index 1.** Creation order
is meaningless. Always finish with an explicit `AE.order([...])`.

**3D layers at identical Z sort unpredictably.** The symptom is maddening: your
artwork renders correctly at one time and is invisible at another, with no
keyframe explaining it. Give each layer its own fractional Z.

**`layer.parent = x` preserves world position** and rewrites the child's position
values to compensate — so a child you just placed at `[0,0]` jumps to
`[-960,-540]`. Use `setParentWithJump()` (wrapped as `AE.parent()`) when you want
the child to keep the numbers you set.

**Parenting does not inherit opacity.** Fading a container leaves its child text
fully visible. Link the child's opacity with an expression.

**`addProperty()` invalidates earlier property references.** Capturing
`var r = rect(...)` then adding a fill to the same group makes `r` throw "Object
of type ... is invalid". Re-fetch by walking the group (`AE.fx()` does this for
effects).

**Cross-layer expressions bake in a "layer missing" error permanently** if the
referenced layer does not exist yet. Assign them in a deferred pass at the end of
the build.

**`sourceRectAtTime` returns the value at the time you ask for.** If the layer's
position is keyframed, reading `.value` gives you the pose at time 0, not the
settled one — which produces ghost duplicates offset from the original. Link with
an expression instead.

## Rendering

**`comp.saveFrameToPng` composites transparency over WHITE.** A precomp with
alpha renders as if on a white card. Always render the top-level comp for
judging.

**It returns before the bytes are on disk.** Reading immediately gives truncated
files. Wait until file sizes are stable for a few polls — `ae-run.sh` does this.
Diagnosing a "caching" problem that was really this race cost four cycles.

**Set `comp.resolutionFactor = [1,1]` for proofs** and back to `[8,8]` while
building.

**`app.purge(PurgeTarget.ALL_CACHES)`** before a proof render.

## Errors and dialogs

**Concatenating an `Error` into a string throws its own error** — "Object of type
Error found where a Number, Array, or Property is needed" — masking the real
failure. Always `e.toString()`.

**An uncaught error pops a modal dialog that blocks all further `DoScript`
calls.** The bridge appears dead. Run builds through `eval(fileContents)` inside
try/catch rather than `$.evalFile` so errors stay catchable.

**`app.onError`** can intercept errors AE would otherwise show, but it does not
catch everything — the try/catch wrapper is the reliable route.

## Colour and project settings

**Do not set `app.project.bitsPerChannel = 32`.** In AE 2026 it switches the
project into a linearized colour pipeline and every frame renders dramatically
darker. Use 16 — it removes gradient banding with no gamma surprise.

**Colour properties are 4-component `[r,g,b,a]`** in 0–1 floats. Shape fills
accept 3 or 4.

## Filesystem

**External volumes may be invisible to the shell** while AE reads them fine
(macOS TCC blocks removable volumes: `ls` → "Operation not permitted"). To
identify footage, render thumbnails through AE rather than using ffmpeg. Finder
via osascript can list the directory.

## Things that do work and are worth knowing

- **Path expressions**: `content("GRP").content("PATH").path.pointOnPath(t)` is
  arc-length parameterised, so an object can ride a Trim Paths reveal exactly with
  zero keyframe syncing.
- **Separated position dimensions**: `position.dimensionsSeparated = true` gives
  independent X/Y properties — the correct rig for a bounce (sharp on Y contacts,
  smooth on X) and it removes spatial-bezier corner rounding.
- **Shape path keyframes morph cleanly** between two paths with the same vertex
  count and matching vertex order. Build both from the same angular sequence.
- **Masks on a solid + a gradient effect** gives a gradient-filled shape with a
  feathered edge — the practical way to get gradient fills, since setting a shape
  Gradient Fill's colour ramp from script is not reliable.
- **A light sweep without a track matte**: duplicate the layer, set it to Add,
  and reveal it with a feathered mask whose *path* is keyframed across. (A
  Transform effect moves the already-masked result, not the mask — wrong.)
