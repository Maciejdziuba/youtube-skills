/*  build-template.jsx — working skeleton with the correct order of operations.
 *  Copy to <workdir>/build.jsx, edit the middle, run with ae-run.sh.
 *  This file is idempotent: it wipes and rebuilds the comp on every run.
 */
(function () {
app.beginUndoGroup("Build");

// ---- load helpers -----------------------------------------------------------
$.evalFile("/Users/USERNAME/.claude/skills/after-effects-scripting/scripts/aelib.jsx");

var WORK = AE.work("/tmp/ae");    // ae-run.sh injects the real workdir
var CW = 1920, CH = 1080, FPS = 30, DUR = 10;
var COMPNAME = "MY COMP";

// ---- comp -------------------------------------------------------------------
var C = AE.getOrMakeComp(COMPNAME, CW, CH, FPS, DUR);
AE.init(C, WORK + "/prog.txt");
AE.logReset();
AE.bitDepth(16);                 // 16, never 32
AE.park();                       // MUST happen before building, or this crawls
AE.wipe();
AE.motionBlur(180, 32);
C.workAreaStart = 0; C.workAreaDuration = DUR;
AE.log("comp ready");

// ---- palette ----------------------------------------------------------------
var INK   = [0.06, 0.06, 0.09];
var WHITE = [1, 1, 1];
var ACC   = [0.45, 0.35, 0.98];

// =============================================================================
// BUILD — replace everything between these markers
// =============================================================================
var bg = C.layers.addSolid(INK, "BG", CW, CH, 1);

var card = AE.shape("CARD", true);
var g = AE.grp(card, "G");
AE.rect(g, 900, 520, 28, [0, 0]);
AE.fill(g, WHITE, 96);
card.transform.position.setValue([CW / 2, CH / 2, 0]);

var sc = card.transform.scale;
sc.setValueAtTime(0.4,  [95.5, 95.5, 100]);
sc.setValueAtTime(0.8,  [100.8, 100.8, 100]);   // 1-3% overshoot, no more
sc.setValueAtTime(1.0,  [100, 100, 100]);
AE.cOut(sc); AE.easeKey(sc, 2, 80, 32);

var op = card.transform.opacity;
op.setValueAtTime(0.4, 0); op.setValueAtTime(0.7, 100); AE.cOut(op);
card.motionBlur = true;

var title = AE.text("Hello", "AvenirNext-Medium", 72, INK);
title.name = "TITLE";
title.threeDLayer = true;
AE.place(title, CW / 2, CH / 2, "c", -1);       // -1: sits in front of the card
AE.resolve(title, 1.0, 1.9, 46);                // resolves out of blur

AE.log("build ok");
// =============================================================================

// ---- stacking order: AE does NOT add layers at the top ----------------------
AE.order(["TITLE", "CARD", "BG"]);

// ---- distinct depths so 3D sorting is deterministic -------------------------
// AE.depth([front, mid, back], 0, 0.1);

// ---- proofs -----------------------------------------------------------------
AE.proofs([0.30, 0.70, 1.10, 1.60, 2.20, 3.00], WORK + "/shots");

// ---- leave the project clean ------------------------------------------------
AE.cleanup();
AE.unpark();
AE.log("done");

app.endUndoGroup();
})();
