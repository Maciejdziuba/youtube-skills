/*  aelib.jsx — helper library for driving After Effects from the shell.
 *
 *  Load it at the top of your build script:
 *      $.evalFile("/path/to/skills/after-effects-scripting/scripts/aelib.jsx");
 *      AE.init(comp, "/tmp/ae/prog.txt");
 *
 *  Everything here has been verified against After Effects 2026 on macOS.
 *  Anything unverified is marked. Do not guess match names — add to this file
 *  instead, so the next run does not rediscover the same trap.
 */

var AE = (function () {
  var C = null;          // active CompItem
  var LOGPATH = null;

  // ---------------------------------------------------------------- logging
  /* File.open("w") returns false instead of throwing when the parent folder
     does not exist — a silent no-op that looks like "the script did nothing".
     Always ensure the folder first. */
  function ensureFolder(path) {
    var f = new Folder(path);
    if (f.exists) return f;
    var parts = path.split("/"), acc = "";
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === "") { acc = ""; continue; }
      acc += "/" + parts[i];
      var d = new Folder(acc);
      if (!d.exists) d.create();
    }
    return new Folder(path);
  }
  function parentFolder(filePath) {
    var i = String(filePath).lastIndexOf("/");
    return i > 0 ? String(filePath).substring(0, i) : "/";
  }
  function log(s) {
    if (!LOGPATH) return;
    var f = new File(LOGPATH);
    f.open("a"); f.write(String(s) + "\r\n"); f.close();
  }
  function logReset(s) {
    if (!LOGPATH) return;
    var f = new File(LOGPATH);
    f.open("w"); f.write(String(s || "START") + "\r\n"); f.close();
  }
  function write(path, s) {
    var f = new File(path); f.open("w"); f.write(String(s)); f.close();
  }

  // ------------------------------------------------------------------ setup
  /* The runner injects AE_WORK before eval-ing the build, so a build never
     writes its log and proofs somewhere the runner is not watching. */
  function work(fallback) {
    return (typeof AE_WORK !== "undefined" && AE_WORK) ? String(AE_WORK) : (fallback || "/tmp/ae");
  }
  function init(comp, logPath) {
    C = comp;
    LOGPATH = logPath || null;
    if (LOGPATH) ensureFolder(parentFolder(LOGPATH));
    return AE;
  }
  function comp() { return C; }

  function findComp(name) {
    for (var i = 1; i <= app.project.numItems; i++) {
      var it = app.project.item(i);
      if (it instanceof CompItem && it.name === name) return it;
    }
    return null;
  }
  function findItem(name) {
    for (var i = 1; i <= app.project.numItems; i++)
      if (app.project.item(i).name === name) return app.project.item(i);
    return null;
  }
  function getOrMakeComp(name, w, h, fps, dur) {
    var c = findComp(name);
    if (!c) c = app.project.items.addComp(name, w, h, 1, dur, fps);
    c.duration = dur; c.frameRate = fps;
    return c;
  }

  /* Park the viewer on a throwaway comp before building.
     Without this AE re-renders the target comp after EVERY scripted change and
     a 100-layer build takes minutes instead of seconds. Looks exactly like a
     hang: DoScript returns 1 and nothing appears to happen. */
  function park() {
    var t = findComp("_park");
    if (!t) t = app.project.items.addComp("_park", 64, 64, 1, 1, 30);
    t.openInViewer();
    if (C) C.resolutionFactor = [8, 8];
    return t;
  }
  function unpark(resFactor) {
    var t = findComp("_park");
    if (t) { try { t.remove(); } catch (e) {} }
    if (C) { C.resolutionFactor = resFactor || [1, 1]; C.openInViewer(); }
  }

  function wipe() {                       // clear the comp before a rebuild
    if (!C) return;
    for (var i = C.numLayers; i >= 1; i--) C.layer(i).remove();
  }

  // ------------------------------------------------------------ shape layers
  function shape(name, threeD) {
    var s = C.layers.addShape();
    s.name = name;
    s.transform.anchorPoint.setValue(threeD ? [0, 0, 0] : [0, 0]);
    if (threeD) s.threeDLayer = true;
    return s;
  }
  function grp(layer, name) {
    var g = layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
    g.name = name;
    return g.property("ADBE Vectors Group");
  }
  function subgrp(contents) {             // nested group inside a contents group
    return contents.addProperty("ADBE Vector Group").property("ADBE Vectors Group");
  }
  function rect(g, w, h, r, pos) {
    var p = g.addProperty("ADBE Vector Shape - Rect");
    p.property("ADBE Vector Rect Size").setValue([w, h]);
    p.property("ADBE Vector Rect Roundness").setValue(r || 0);
    if (pos) p.property("ADBE Vector Rect Position").setValue(pos);
    return p;
  }
  function ell(g, w, h, pos) {
    var p = g.addProperty("ADBE Vector Shape - Ellipse");
    p.property("ADBE Vector Ellipse Size").setValue([w, h]);
    if (pos) p.property("ADBE Vector Ellipse Position").setValue(pos);
    return p;
  }
  function path(g, shapeObj, name) {      // free-form bezier path
    var p = g.addProperty("ADBE Vector Shape - Group");
    if (name) p.name = name;
    p.property("ADBE Vector Shape").setValue(shapeObj);
    return p;
  }
  function fill(g, col, op) {
    var f = g.addProperty("ADBE Vector Graphic - Fill");
    f.property("ADBE Vector Fill Color").setValue(col);
    if (op !== undefined) f.property("ADBE Vector Fill Opacity").setValue(op);
    return f;
  }
  function stroke(g, col, w, op) {
    var s = g.addProperty("ADBE Vector Graphic - Stroke");
    s.property("ADBE Vector Stroke Color").setValue(col);
    s.property("ADBE Vector Stroke Width").setValue(w);
    s.property("ADBE Vector Stroke Line Cap").setValue(2);   // round
    if (op !== undefined) s.property("ADBE Vector Stroke Opacity").setValue(op);
    return s;
  }
  function trim(g, name) {
    var t = g.addProperty("ADBE Vector Filter - Trim");
    if (name) t.name = name;
    return t;   // .property("ADBE Vector Trim Start"/"End"/"Offset")
  }

  // ---------------------------------------------------------------- effects
  /* repeatEdge MUST be false for anything smaller than the layer. On a
     comp-sized shape layer it clamps the blur to the layer bounds and you get a
     hard-edged SQUARE glow. Only true for full-frame solids. */
  function blur(layer, radius, repeatEdge) {
    var e = layer.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2");
    e.property("Blurriness").setValue(radius);
    e.property("Repeat Edge Pixels").setValue(repeatEdge === true);
    return e;
  }
  function grad4(layer, p1, c1, p2, c2, p3, c3, p4, c4, blend) {
    var e = layer.property("ADBE Effect Parade").addProperty("ADBE 4ColorGradient");
    e.property("Point 1").setValue(p1); e.property("Color 1").setValue(c1);
    e.property("Point 2").setValue(p2); e.property("Color 2").setValue(c2);
    e.property("Point 3").setValue(p3); e.property("Color 3").setValue(c3);
    e.property("Point 4").setValue(p4); e.property("Color 4").setValue(c4);
    e.property("Blend").setValue(blend || 400);
    return e;
  }
  function noise(layer, amount) {         // params are unnamed-safe: match by prefix
    var e = layer.property("ADBE Effect Parade").addProperty("ADBE Noise");
    for (var i = 1; i <= e.numProperties; i++) {
      var q = e.property(i);
      if (q.name.indexOf("Amount") === 0) { try { q.setValue(amount); } catch (x) {} }
      else if (q.name.indexOf("Color") >= 0) { try { q.setValue(false); } catch (x) {} }
    }
    return e;
  }
  /* Find an effect property already on a layer. addProperty() invalidates
     earlier references ("Object is invalid"), so re-fetch instead of caching. */
  function fx(layer, matchName, propName) {
    var ep = layer.property("ADBE Effect Parade");
    for (var i = 1; i <= ep.numProperties; i++)
      if (ep.property(i).matchName === matchName)
        return propName ? ep.property(i).property(propName) : ep.property(i);
    return null;
  }

  // ----------------------------------------------------------------- easing
  /* AE KeyframeEase(speed, influence): influence is handle LENGTH.
     High influence = flat curve near that key = slow there.
     Never use the same influence on both sides of every key — that is the
     single clearest amateur tell in motion graphics. */
  function easeKey(prop, k, inInf, outInf) {
    for (var d = (prop.value.length || 1); d >= 1; d--) {
      try {
        var ei = [], eo = [];
        for (var j = 0; j < d; j++) {
          ei.push(new KeyframeEase(0, Math.max(0.1, inInf)));
          eo.push(new KeyframeEase(0, Math.max(0.1, outInf)));
        }
        prop.setTemporalEaseAtKey(k, ei, eo);
        return;
      } catch (e) { if (d === 1) return; }   // spatial props take exactly 1 ease
    }
  }
  function cOut(p) {            // cubic-bezier(0.16,1,0.3,1): snap out, long settle
    var n = p.numKeys; if (n < 2) return;
    for (var k = 1; k <= n; k++) easeKey(p, k, (k === 1 ? 50 : 84), (k === n ? 50 : 12));
  }
  function cWeight(p) {         // heavy, eases both ends — default for hero moves
    var n = p.numKeys; if (n < 2) return;
    for (var k = 1; k <= n; k++) easeKey(p, k, (k === 1 ? 50 : 78), (k === n ? 50 : 38));
  }
  function cThru(p) {           // eased ends, continuous velocity through middles
    var n = p.numKeys; if (n < 2) return;
    for (var k = 1; k <= n; k++) {
      if (k === 1) easeKey(p, k, 50, 20);
      else if (k === n) easeKey(p, k, 88, 50);
      else easeKey(p, k, 54, 54);
    }
  }
  function impact(p, k) { easeKey(p, k, 0.5, 0.5); }   // floor contact: no cushion
  function hang(p, k)   { easeKey(p, k, 90, 90); }     // apex: floats

  /* Keyframe a colour through a palette. stops = [[time,[r,g,b]], ...] */
  function tint(prop, stops, mul) {
    var m = (mul === undefined) ? 1 : mul;
    for (var i = 0; i < stops.length; i++) {
      var c = stops[i][1];
      prop.setValueAtTime(stops[i][0], [c[0] * m, c[1] * m, c[2] * m, 1]);
    }
    cWeight(prop);
  }

  // ------------------------------------------------------------------- text
  function text(str, font, size, col, just, leading, tracking) {
    var tl = C.layers.addText(str);
    var tp = tl.property("ADBE Text Properties").property("ADBE Text Document");
    var td = tp.value;
    td.font = font; td.fontSize = size;
    td.applyFill = true; td.fillColor = col; td.applyStroke = false;
    td.justification = just || ParagraphJustification.CENTER_JUSTIFY;
    if (leading) { td.autoLeading = false; td.leading = leading; }
    if (tracking !== undefined) td.tracking = tracking;
    tp.setValue(td);
    return tl;
  }
  /* Place a text layer so its rendered bounding box centres on [x,y].
     align: "c" (default) | "l" | "r" */
  function place(tl, x, y, align, z) {
    var r = tl.sourceRectAtTime(0, false);
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (align === "l") cx = r.left;
    else if (align === "r") cx = r.left + r.width;
    if (tl.threeDLayer) tl.transform.position.setValue([x - cx, y - cy, z || 0]);
    else tl.transform.position.setValue([x - cx, y - cy]);
    return r;
  }
  /* Per-character reveal out of blur. Text should resolve, not fly in.
     VERIFIED: "ADBE Text Opacity" and "ADBE Text Blur".
     NOT VERIFIED: an animator Position property — "ADBE Text Position" is
     rejected. Animate the LAYER position instead for a rise. */
  function resolve(tl, t0, t1, blurAmt) {
    var an = tl.property("ADBE Text Properties")
               .property("ADBE Text Animators").addProperty("ADBE Text Animator");
    an.name = "RESOLVE";
    var props = an.property("ADBE Text Animator Properties");
    props.addProperty("ADBE Text Opacity").setValue(0);
    props.addProperty("ADBE Text Blur").setValue([blurAmt || 50, blurAmt || 50]);
    var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    for (var i = 1; i <= sel.numProperties; i++) {
      var q = sel.property(i);
      if (q.name === "Shape")      { try { q.setValue(6); } catch (e) {} }  // Smooth
      else if (q.name === "Smoothness") { try { q.setValue(100); } catch (e) {} }
    }
    var st = sel.property("ADBE Text Percent Start");
    st.setValueAtTime(t0, 0); st.setValueAtTime(t1, 100);
    cWeight(st);
    return an;
  }

  // -------------------------------------------------------------- transform
  /* 3D layers have NO .transform.rotation — that is zRotation. */
  function setRot(layer, deg) {
    try { layer.transform.zRotation.setValue(deg); }
    catch (e) { try { layer.transform.rotation.setValue(deg); } catch (e2) {} }
  }
  /* layer.parent = x PRESERVES world position and rewrites the child's values.
     Use this when you want the child to keep the numbers you just set. */
  function parent(child, par) {
    try { child.setParentWithJump(par); }
    catch (e) {
      var v = child.transform.position.value;
      child.parent = par;
      child.transform.position.setValue(v);
    }
  }
  /* A 3D null with anchorPoint [0,0,0] makes every child position a plain
     offset from the rig centre — worth doing for any grouped layout. */
  function rig(name, x, y, z) {
    var n = C.layers.addNull(C.duration);
    n.name = name; n.threeDLayer = true;
    n.transform.anchorPoint.setValue([0, 0, 0]);
    n.transform.position.setValue([x, y, z || 0]);
    n.enabled = false;
    return n;
  }

  // ----------------------------------------------------------------- camera
  function camera(name, zoomOrMm) {
    var cam = C.layers.addCamera(name, [C.width / 2, C.height / 2]);
    var zoom = zoomOrMm;
    if (zoomOrMm && zoomOrMm < 400) zoom = C.width * zoomOrMm / 36;  // treat as mm
    if (zoom) {
      var co = cam.property("ADBE Camera Options Group");
      for (var i = 1; i <= co.numProperties; i++)
        if (co.property(i).name === "Zoom") { co.property(i).setValue(zoom); break; }
    }
    return cam;
  }
  function poi(cam) {   // Point of Interest IS "ADBE Anchor Point" on a camera
    return cam.property("ADBE Transform Group").property("ADBE Anchor Point");
  }

  // ------------------------------------------------------------------ order
  /* AE inserts new layers next to the SELECTION, not at the top. Creation order
     tells you nothing. Always finish a build with an explicit order. */
  function order(names) {
    var seen = {}, list = [];
    for (var i = 0; i < names.length; i++)
      if (!seen[names[i]]) { seen[names[i]] = 1; list.push(names[i]); }
    for (var i = list.length - 1; i >= 0; i--) {
      var l = null;
      for (var j = 1; j <= C.numLayers; j++)
        if (C.layer(j).name === list[i]) { l = C.layer(j); break; }
      if (l) l.moveToBeginning(); else log("ORDER: missing layer " + list[i]);
    }
    for (var i = C.numLayers; i >= 1; i--)
      if (!seen[C.layer(i).name]) C.layer(i).moveToEnd();
  }
  /* 3D layers at identical Z sort unpredictably — a card can swallow the
     artwork at some times and not others. Give each its own depth. */
  function depth(layers, start, step) {
    var z = (start === undefined) ? 0 : start, d = step || 0.1;
    for (var i = 0; i < layers.length; i++) {
      var p = layers[i].transform.position.value;
      layers[i].transform.position.setValue([p[0], p[1], z]);
      z += d;
    }
  }

  // ---------------------------------------------------------------- cleanup
  /* Every addSolid/addNull creates a project item that SURVIVES deleting the
     layer. Repeated rebuilds pile up duplicates. Run this at the end of every
     build, not occasionally. */
  function cleanup() {
    var removed = 0;
    var t = findComp("_park");
    if (t) { try { t.remove(); removed++; } catch (e) {} }
    var used = {};
    for (var c = 1; c <= app.project.numItems; c++) {
      var it = app.project.item(c);
      if (it instanceof CompItem)
        for (var l = 1; l <= it.numLayers; l++) {
          var s = it.layer(l).source; if (s) used[s.id] = 1;
        }
    }
    for (var i = app.project.numItems; i >= 1; i--) {
      var it = app.project.item(i);
      if (it instanceof FootageItem && !used[it.id]) { it.remove(); removed++; }
    }
    for (var i = app.project.numItems; i >= 1; i--) {
      var it = app.project.item(i);
      if (it instanceof FolderItem && it.numItems === 0) { it.remove(); removed++; }
    }
    log("cleanup removed " + removed + " orphaned items");
    return removed;
  }

  // ----------------------------------------------------------------- proofs
  /* Render frames to disk so you can LOOK at what you built. This is the whole
     point of the workflow — never judge a change you have not seen. */
  function proofs(times, dir, resFactor) {
    ensureFolder(dir);
    park();
    C.resolutionFactor = resFactor || [1, 1];
    try { app.purge(PurgeTarget.ALL_CACHES); } catch (e) {}
    for (var i = 0; i < times.length; i++) {
      var n = (i < 10 ? "0" : "") + i;
      C.saveFrameToPng(times[i], new File(dir + "/f" + n + ".png"));
      log("proof f" + n + " @" + times[i]);
    }
    log("PROOFS DONE");
  }

  // --------------------------------------------------------------- comp cfg
  function motionBlur(shutterAngle, samples, phase) {
    C.motionBlur = true;
    try {
      C.shutterAngle = shutterAngle || 180;
      C.shutterPhase = (phase === undefined) ? -90 : phase;
      C.motionBlurSamplesPerFrame = samples || 32;
      C.motionBlurAdaptiveSampleLimit = 128;
    } catch (e) { log("motionBlur: " + e.toString()); }
  }
  /* 16 kills gradient banding. Do NOT use 32 — AE 2026 switches to a
     linearized pipeline and every frame renders dramatically darker. */
  function bitDepth(n) { try { app.project.bitsPerChannel = n || 16; } catch (e) {} }

  return {
    init: init, comp: comp, log: log, logReset: logReset, write: write,
    work: work, ensureFolder: ensureFolder,
    findComp: findComp, findItem: findItem, getOrMakeComp: getOrMakeComp,
    park: park, unpark: unpark, wipe: wipe,
    shape: shape, grp: grp, subgrp: subgrp, rect: rect, ell: ell, path: path,
    fill: fill, stroke: stroke, trim: trim,
    blur: blur, grad4: grad4, noise: noise, fx: fx,
    easeKey: easeKey, cOut: cOut, cWeight: cWeight, cThru: cThru,
    impact: impact, hang: hang, tint: tint,
    text: text, place: place, resolve: resolve,
    setRot: setRot, parent: parent, rig: rig,
    camera: camera, poi: poi,
    order: order, depth: depth, cleanup: cleanup, proofs: proofs,
    motionBlur: motionBlur, bitDepth: bitDepth
  };
})();
