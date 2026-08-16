---
name: after-effects-scripting
description: >-
  Drive a running After Effects instance directly from the shell to build, edit and render motion graphics — no MCP, plugin or panel required. Use whenever the user wants Claude to work inside After Effects: building animations, title sequences, logo stings, UI/product motion, data visualisations, or fixing an existing comp. Covers the osascript/ExtendScript bridge, a verified helper library, the render-proof iteration loop, After Effects API traps that cause silent failures, and the numeric craft settings (easing, shadows, glows, motion blur) that separate premium motion from amateur output. Triggers on After Effects, AE, ExtendScript, .aep, motion graphics, animation, comp, keyframes.
---

# After Effects, driven from the shell

After Effects exposes an AppleScript command, `DoScript`, that runs ExtendScript
inside the live application. That is the whole bridge. Nothing is installed, no
MCP server, no CEP panel.

```bash
osascript -e 'tell application "Adobe After Effects 2026" to DoScript "$.evalFile(\"/tmp/ae/build.jsx\")"'
```

## Before anything else

1. After Effects must be **open**, with a project.
2. `Preferences → Scripting & Expressions → Allow Scripts to Write Files and Access Network` must be **on**. Nothing works without it.
3. macOS may need Automation permission for your terminal (System Settings → Privacy & Security → Automation).
4. Confirm the bridge before building anything:

```bash
osascript -e 'tell application "Adobe After Effects 2026" to DoScript "var f=new File(\"/tmp/ae/ping.txt\"); f.open(\"w\"); f.write(\"alive \"+app.project.numItems); f.close();"'
```

Adjust the app name to the installed version. `DoScript` returning `1` instead of
`0` means AE is busy or blocked by a modal dialog — see *When it looks hung*.

## The loop — this is the skill

Never judge a change you have not looked at. The entire value of this workflow is
that you can see your own output and fix it, instead of guessing from a
description. One cycle:

1. Write `build.jsx` — idempotent: it wipes and rebuilds the comp every run.
2. Run it. Read `err.txt` and `prog.txt`.
3. Render proof frames, stitch a contact sheet, **open the image and look at it**.
4. Fix what you actually see. Repeat.

`scripts/ae-run.sh` does steps 2–3 in one command:

```bash
~/.claude/skills/after-effects-scripting/scripts/ae-run.sh /tmp/ae "MY COMP"
```

It prints `BUILD: OK` or the error with a line number, waits for AE to finish
flushing PNGs to disk, and prints the path of a timestamped contact sheet. Read
that image with your file-reading tool. Do not skip this step — every serious
mistake in a build is invisible in the code and obvious in the frame.

## Use the helper library

`scripts/aelib.jsx` wraps every match name and API trap listed below. Load it
first and you skip most of the discovery pain:

```javascript
$.evalFile("/Users/<you>/.claude/skills/after-effects-scripting/scripts/aelib.jsx");
```

`scripts/templates/build-template.jsx` is a working skeleton with the correct
order of operations. Copy it and fill in the middle.

Key calls: `AE.init(comp, logPath)`, `AE.park()` / `AE.unpark()`, `AE.wipe()`,
`AE.shape/grp/rect/ell/fill/stroke/trim`, `AE.blur/grad4/noise/fx`,
`AE.cOut/cWeight/cThru/easeKey/impact/hang/tint`, `AE.text/place/resolve`,
`AE.rig/parent/setRot/depth`, `AE.camera/poi`, `AE.order`, `AE.proofs`,
`AE.cleanup`.

## Five rules that save the most time

**Park the viewer before building.** If the comp you are scripting is open in a
viewer, AE re-renders it after every single change and a 100-layer build takes
minutes. It looks exactly like a hang. `AE.park()` opens a throwaway 64×64 comp
and drops the target to 1/8 resolution; `AE.unpark()` restores it. This one
change turned a five-minute stall into ten seconds.

**Set the layer order explicitly at the end.** AE inserts new layers next to the
current *selection*, not at the top. Creation order tells you nothing. Finish
every build with `AE.order([...names top to bottom...])`.

**Give every 3D layer its own Z.** Layers at identical Z sort unpredictably — a
background card will swallow your artwork at some times and not others. Fractions
apart is enough; `AE.depth(layers, 0, 0.1)`.

**Clean up orphaned items.** Every `addSolid` and `addNull` creates a project item
that survives deleting the layer. After thirty rebuilds a project accumulates
dozens of duplicates. Call `AE.cleanup()` at the end of every build.

**Wrap the build in try/catch and log progress.** An uncaught error pops a modal
dialog in AE, and that dialog blocks every subsequent `DoScript` call — which
reads as the bridge dying. `ae-run.sh` uses `eval()` on the file contents rather
than `$.evalFile` precisely so errors are catchable.

## When it looks hung

`DoScript` returns `1` and nothing happens. In order of likelihood:

1. **Viewer re-render** — you did not park the viewer. Wait, then park.
2. **Modal error dialog** — an earlier script threw. Dismiss it:
   `osascript -e 'tell application "Adobe After Effects 2026" to activate' -e 'delay 1' -e 'tell application "System Events" to keystroke return'`
3. **AE genuinely busy** — poll the ping until it returns `0`.

Check whether AE is computing or waiting: `top -l 2 -pid $(pgrep -x "After Effects") -stats pid,cpu,state`.

## Reading results back

ExtendScript has no `JSON`. Write results to a text file with a hand-rolled
serialiser and read it from the shell. `AE.log()` appends to a progress file — put
a marker after each section so a failure tells you where it stopped.

Two traps: concatenating an `Error` object into a string throws its own error and
masks the real one (`e.toString()` always). And `addProperty()` invalidates
property references you captured earlier — re-fetch with `AE.fx()` instead of
caching.

## Where to go next

- `references/api-gotchas.md` — the full list of match names, invalid property
  names, and API behaviours that fail silently or misleadingly. Read this before
  guessing any match name.
- `references/motion-quality.md` — the numbers that make output look expensive:
  easing influence values, layered shadow and bloom stacks, motion blur, bit
  depth, timing and stagger conventions. Read this before animating anything a
  human will judge on quality.
