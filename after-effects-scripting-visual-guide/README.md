# 🎬 What the After Effects Skill Actually Does — In Pictures

> **One sentence:** it gives Claude **hands** (scripts that control After Effects) and **eyes** (rendered frames it can look at) — so it can build motion graphics and *check its own work*.

---

## 🧠 First principles: the core problem

Claude can write animation code, but After Effects is a **visual** program. Code that *looks* correct often *renders* wrong. The skill closes that gap:

```mermaid
flowchart LR
    A["🤖 Claude<br/>writes code"] -->|"❌ without this skill"| B["🙈 Guessing<br/>hopes it looks right"]
    A -->|"✅ with this skill"| C["👀 Seeing<br/>renders a picture,<br/>looks at it, fixes it"]
    style A fill:#4a5568,color:#fff
    style B fill:#9b2c2c,color:#fff
    style C fill:#276749,color:#fff
```

---

## 🌉 The bridge: how Claude talks to After Effects

No plugin. No extension. Just one built-in macOS command connecting the terminal to the running app:

```mermaid
sequenceDiagram
    participant C as 🤖 Claude (terminal)
    participant O as 🌉 osascript (macOS)
    participant AE as 🎬 After Effects (open app)
    C->>O: "run my build script"
    O->>AE: DoScript build.jsx
    AE->>AE: builds layers, keyframes, effects
    AE-->>C: 📄 log file ("OK" or the exact error)
    AE-->>C: 🖼️ PNG frames of the animation
    C->>C: 👀 looks at the frames, spots mistakes
    C->>O: "run it again, fixed"
```

---

## 🔁 The loop: the skill IS this cycle

Every improvement comes from repeating one simple cycle — like an editor scrubbing the timeline after every change:

```mermaid
flowchart TD
    W["✍️ 1. Write the build script"] --> R["▶️ 2. Run it inside AE"]
    R --> P["🖼️ 3. Render proof frames<br/>+ stitch into one contact sheet"]
    P --> L["👀 4. LOOK at the image"]
    L --> F{"Does it look right?"}
    F -->|"No"| X["🔧 Fix what you SAW,<br/>not what you guessed"] --> W
    F -->|"Yes"| D["✅ Done — render final"]
    style L fill:#b7791f,color:#fff
    style D fill:#276749,color:#fff
```

---

## 📦 What's in the box

```mermaid
pie showData title Lines of knowledge, by ingredient
    "aelib.jsx — helper library (the hands)" : 45
    "api-gotchas.md — trap list (scar tissue)" : 20
    "motion-quality.md — the pretty numbers" : 18
    "ae-run.sh + contact sheet (the eyes)" : 12
    "build template (the starting point)" : 5
```

| Piece | In plain words |
|---|---|
| 🛠️ `aelib.jsx` | Shortcuts for everything: shapes, easing, cameras, cleanup |
| ⚠️ `api-gotchas.md` | Every way AE silently fails, so it's only discovered once |
| ✨ `motion-quality.md` | The exact numbers that make motion look **expensive** |
| 👁️ `ae-run.sh` | One command: build → render → one big image to look at |

---

## ⏱️ Why it helps: time spent per animation

```mermaid
pie showData title Minutes to a polished result (typical)
    "Without skill — blind guessing & re-explaining" : 60
    "With skill — self-checking loop" : 15
```

Fewer round-trips with the human, because Claude catches its own mistakes **before** showing you anything:

```mermaid
flowchart LR
    subgraph BEFORE["😩 Without the skill"]
        H1["You describe"] --> G["Claude guesses"] --> S1["You check & explain<br/>what's wrong"] --> G
    end
    subgraph AFTER["😎 With the skill"]
        H2["You describe"] --> B2["Claude builds,<br/>looks, fixes ×N"] --> S2["You review<br/>once"]
    end
    style BEFORE fill:#2d2d2d,color:#fff
    style AFTER fill:#1a3d2e,color:#fff
```

---

## 🏆 The five hard-won rules (learned the painful way)

```mermaid
mindmap
  root(("🎬 5 rules"))
    ("🅿️ Park the viewer")
      ["otherwise: fake 5-minute hangs"]
    ("📚 Set layer order last")
      ["AE stacks new layers unpredictably"]
    ("🎚️ Give each 3D layer its own Z")
      ["same depth = artwork randomly vanishes"]
    ("🧹 Clean up orphaned items")
      ["30 rebuilds = dozens of ghosts"]
    ("🪤 try/catch everything")
      ["one error dialog freezes the bridge"]
```

---

*Companion to [`after-effects-scripting`](../after-effects-scripting) — the actual skill this explains.*
