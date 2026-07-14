#!/usr/bin/env python3
"""
build.py — assemble the single self-contained team-longevity.html.

Inlines three things into template.html (replacing marker comments):
  <!-- D3 -->       vendored D3 v7 (classic script)
  <!-- COMPUTE -->  compute.js with its `export` keywords stripped, so its functions
                    become globals the tool can call directly (the on-disk module keeps
                    `export` for the node test — single source of truth, no logic copy)
  <!-- DATA -->     window.PARTICIPATION = <team_participation.json>

The browser calls the SAME buildRecords()/compute functions the tests exercise.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def read(name):
    with open(os.path.join(HERE, name)) as fh:
        return fh.read()

def main():
    template = read("template.html")
    d3 = read(os.path.join("vendor", "d3.v7.min.js"))
    compute = read("compute.js").replace("export function", "function").replace("export const", "const")
    with open(os.path.join(HERE, "team_participation.json")) as fh:
        data = fh.read()

    html = (template
            .replace("<!-- D3 -->", f"<script>{d3}</script>")
            .replace("<!-- COMPUTE -->", f"<script>{compute}</script>")
            .replace("<!-- DATA -->", f"<script>window.PARTICIPATION={data};</script>"))

    for marker in ("<!-- D3 -->", "<!-- COMPUTE -->", "<!-- DATA -->"):
        if marker in html:
            sys.exit(f"marker not replaced: {marker}")

    out = os.path.join(HERE, "team-longevity.html")
    with open(out, "w") as fh:
        fh.write(html)
    kb = os.path.getsize(out) // 1024
    print(f"Wrote {out} ({kb} KB)")

if __name__ == "__main__":
    main()
