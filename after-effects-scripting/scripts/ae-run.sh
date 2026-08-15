#!/bin/zsh
# ae-run.sh — build + render proofs + contact sheet, in one command.
#
#   ae-run.sh <workdir> <comp-name> [app-name]
#
# Expects <workdir>/build.jsx to exist. Writes:
#   <workdir>/err.txt    "OK" or the build error with line number
#   <workdir>/prog.txt   progress log from AE.log()
#   <workdir>/shots/     proof frames
#   <workdir>/sheet_HHMMSS.png
#
# The build script itself decides which times to render (via AE.proofs).

set -u
WORK="${1:?usage: ae-run.sh <workdir> <comp-name> [app-name]}"
COMP="${2:?comp name required}"
APPNAME="${3:-Adobe After Effects 2026}"
HERE="${0:A:h}"

mkdir -p "$WORK/shots"
rm -rf "$WORK/shots"; mkdir -p "$WORK/shots"
rm -f "$WORK/err.txt" "$WORK/prog.txt"

# eval() rather than $.evalFile() so build errors are catchable instead of
# popping a modal dialog in AE (a dialog blocks every later DoScript call).
cat > "$WORK/_run.jsx" <<EOF
var AE_WORK="$WORK";
var msg="OK";
try{
  var fh=new File("$WORK/build.jsx"); fh.open("r"); var src=fh.read(); fh.close();
  eval(src);
}catch(e){ msg="ERROR: "+e.toString()+" | line="+e.line; }
var f=new File("$WORK/err.txt"); f.open("w"); f.write(msg); f.close();
EOF

osascript -e "with timeout of 1800 seconds" \
          -e "tell application \"$APPNAME\" to DoScript \"\$.evalFile(\\\"$WORK/_run.jsx\\\")\"" \
          -e "end timeout" >/dev/null 2>&1

until [ -s "$WORK/err.txt" ]; do sleep 2; done
STATUS="$(cat "$WORK/err.txt")"
echo "BUILD: $STATUS"
if [ "$STATUS" != "OK" ]; then
  echo "--- last progress:"; tail -6 "$WORK/prog.txt" 2>/dev/null | tr '\r' '\n'
  exit 1
fi

# Wait for AE to finish flushing PNGs. saveFrameToPng returns before the bytes
# hit disk; reading too early gives truncated files and misleading proofs.
LAST=""; STABLE=0
for i in $(seq 1 200); do
  CUR="$(ls -l "$WORK"/shots/*.png 2>/dev/null | awk '{print $5}' | tr '\n' ' ')"
  if [ -n "$CUR" ] && [ "$CUR" = "$LAST" ]; then
    STABLE=$((STABLE+1)); [ $STABLE -ge 3 ] && break
  else STABLE=0; fi
  LAST="$CUR"; sleep 2
done

N="$(ls -1 "$WORK"/shots/*.png 2>/dev/null | wc -l | tr -d ' ')"
echo "FRAMES: $N"
[ "$N" = "0" ] && { echo "no frames rendered — did the build call AE.proofs()?"; exit 1; }

python3 "$HERE/contact_sheet.py" "$WORK/shots" "$WORK"
