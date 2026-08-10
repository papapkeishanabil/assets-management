#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""M3.1 real-browser verification harness (Playwright + dev-viewer-test.html).

Menjalankan skenario manual yang dilaporkan user FAIL:
  TEST A single pin, TEST B deselect, TEST C 3 pin Kerah,
  TEST D fit, TEST E rapid interaction, TEST F resize.
Mencatat console error / pageerror. Exit 1 jika ada kegagalan.
"""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173/dev-viewer-test.html"
results = []
console_errors = []
page_errors = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("  PASS: " if ok else "  FAIL: ") + name + ("  [" + detail + "]" if detail else ""))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        def on_console(msg):
            if msg.type in ("error", "warning"):
                console_errors.append((msg.type, msg.text))

        def on_pageerror(exc):
            page_errors.append(str(exc))

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_selector("[data-pin='p1']", timeout=20000)
        page.wait_for_selector("#status:has-text('selected:')", timeout=10000)

        def viewer_state():
            return page.evaluate("""() => {
              const region = document.querySelector('[aria-label^="Viewer dokumen PO"]');
              if (!region) return { exists: false };
              const img = region.querySelector('img');
              const world = region.querySelector('div[style*="translate"]');
              const r = region.getBoundingClientRect();
              const style = world ? world.style.transform : '';
              return {
                exists: true,
                rect: { w: r.width, h: r.height },
                imgLoaded: !!(img && img.complete && img.naturalWidth > 0),
                imgNatural: img ? (img.naturalWidth + 'x' + img.naturalHeight) : 'none',
                worldTransform: style,
                nanTransform: /NaN|Infinity|undefined/.test(style),
              };
            }""")

        def pin_pos(pid):
            return page.evaluate(
                "pid => { const el = document.querySelector('[data-pin=\"' + pid + '\"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), vw: Math.round(el.offsetWidth), vh: Math.round(el.offsetHeight), visible: el.offsetParent !== null }; }",
                pid,
            )

        def cards_visible():
            return page.evaluate("""() => {
              const region = document.querySelector('[aria-label^="Viewer dokumen PO"]');
              const rr = region ? region.getBoundingClientRect() : null;
              const btns = document.querySelectorAll('button[aria-label="Tutup kartu pin"]');
              return Array.from(btns).map(btn => {
                const wrapper = btn.parentElement && btn.parentElement.parentElement ? btn.parentElement.parentElement.parentElement : null;
                if (!wrapper) return { x: -1, y: -1, w: 0, h: 0, visible: false };
                const r = wrapper.getBoundingClientRect();
                const style = getComputedStyle(wrapper);
                const notClipped = !rr || (r.left >= rr.left - 2 && r.top >= rr.top - 2 && r.right <= rr.right + 2 && r.bottom <= rr.bottom + 2);
                const visible = r.width > 0 && style.visibility !== 'hidden' && style.display !== 'none' && notClipped;
                return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible };
              });
            }""")

        def connectors():
            return page.evaluate("""() => {
              const paths = Array.from(document.querySelectorAll('svg path[marker-end]'));
              return paths.map(p => { const r = p.getBoundingClientRect(); return { len: p.getAttribute('d').length, x: Math.round(r.x), w: Math.round(r.width) }; });
            }""")

        def click_pin(pid):
            page.locator("[data-pin='" + pid + "']").click(timeout=5000)
            page.wait_for_timeout(450)

        shot = 0
        def screenshot(tag):
            nonlocal shot
            shot += 1
            path = r"C:\Users\USER\AppData\Local\Temp\opencode\m31_" + tag + "_" + str(shot) + ".png"
            page.screenshot(path=path)
            print("    (screenshot " + tag + ": " + path + ")")

        # ---------- TEST A: single pin ----------
        print("\n--- TEST A: SINGLE PIN ---")
        click_pin("p1")
        st = viewer_state()
        check("A1 viewer ada & tidak blank", st["exists"] and st["rect"]["w"] > 0, json.dumps(st["rect"]))
        check("A2 image loaded", st["imgLoaded"], st["imgNatural"])
        check("A3 transform valid (no NaN/Inf)", not st["nanTransform"], st["worldTransform"][:80])
        c = cards_visible()
        check("A4 floating card muncul (1 kartu)", len(c) == 1 and c[0]["visible"], json.dumps(c))
        p = pin_pos("p1")
        check("A5 pin #1 terlihat", bool(p and p["visible"]), json.dumps(p))
        cn = connectors()
        check("A6 connector dirender (>=1 path)", len(cn) >= 1, json.dumps(cn))
        screenshot("a_singlepin")

        # ---------- TEST B: deselect ----------
        print("\n--- TEST B: DESELECT ---")
        click_pin("p1")
        c = cards_visible()
        st = viewer_state()
        check("B1 kartu hilang", len(c) == 0, json.dumps(c))
        check("B2 image tetap terlihat", st["imgLoaded"] and st["exists"], "")

        # ---------- TEST C: 3 pin Kerah ----------
        print("\n--- TEST C: 3 PIN KERAH ---")
        page.locator("#btn-all-kerah").click()
        page.wait_for_timeout(600)
        st = viewer_state()
        check("C1 image tetap terlihat", st["exists"] and st["imgLoaded"] and not st["nanTransform"], st["worldTransform"][:80])
        c = cards_visible()
        check("C2 3 floating card muncul", len(c) == 3 and all(x["visible"] for x in c), json.dumps(c))
        rects = [(x["x"], x["y"], x["w"], x["h"]) for x in c]
        overlaps = sum(1 for i in range(len(rects)) for j in range(i + 1, len(rects)) if rects_overlap(rects[i], rects[j]))
        check("C3 kartu tidak overlap", overlaps == 0, "overlap=" + str(overlaps) + " rects=" + json.dumps(rects))
        cn = connectors()
        check("C4 3 connector", len(cn) >= 3, json.dumps(cn))
        screenshot("c_allkerah")

        # ---------- TEST D: fit ----------
        print("\n--- TEST D: FIT TO PO ---")
        page.locator("#btn-fit").click()
        page.wait_for_timeout(600)
        st = viewer_state()
        check("D1 viewer tidak blank setelah fit", st["exists"] and st["imgLoaded"] and not st["nanTransform"], st["worldTransform"][:80])
        c = cards_visible()
        check("D2 kartu hilang setelah fit", len(c) == 0, "")
        # Tombol Fit-to-PO asli di zoom controls canvas
        page.locator('[aria-label="Fit ke PO (reset zoom dan posisi)"]').click()
        page.wait_for_timeout(700)
        st = viewer_state()
        zoomtxt = page.evaluate("""() => {
          const el = document.querySelector('[aria-label^="Viewer dokumen PO"] span.font-mono');
          return el ? el.textContent.trim() : '';
        }""")
        check("D3 tombol Fit-to-PO: zoom kembali 100% & tidak blank", st["exists"] and st["imgLoaded"] and not st["nanTransform"] and zoomtxt == "100%", "zoom=" + zoomtxt + " " + st["worldTransform"][:80])
        screenshot("d_fit")

        # ---------- TEST E: rapid interaction ----------
        print("\n--- TEST E: RAPID INTERACTION ---")
        ok = True
        for i in range(3):
            for act in (("pin", "p1"), ("pin", "p2"), ("pin", "p3"), ("fit", None), ("bbox", None)):
                try:
                    if act[0] == "pin":
                        click_pin(act[1])
                    elif act[0] == "fit":
                        page.locator("#btn-fit").click()
                    else:
                        page.locator("#btn-all-kerah").click()
                    page.wait_for_timeout(200)
                except Exception as exc:
                    ok = False
                    check("E rapid " + str(act), False, str(exc))
        page.wait_for_timeout(500)
        st = viewer_state()
        check("E1 tidak crash/blank setelah rapid", ok and st["exists"] and st["imgLoaded"] and not st["nanTransform"], st["worldTransform"][:80])
        screenshot("e_rapid")

        # ---------- TEST F: resize ----------
        print("\n--- TEST F: RESIZE ---")
        page.locator("#btn-all-kerah").click()
        page.wait_for_timeout(500)
        page.set_viewport_size({"width": 900, "height": 700})
        page.wait_for_timeout(600)
        page.set_viewport_size({"width": 1280, "height": 900})
        page.wait_for_timeout(600)
        st = viewer_state()
        check("F1 viewer tidak blank setelah resize", st["exists"] and st["imgLoaded"] and not st["nanTransform"], st["worldTransform"][:80])
        c = cards_visible()
        check("F2 kartu tetap ada & terlihat", len(c) == 3 and all(x["visible"] for x in c), json.dumps(c))
        screenshot("f_resize")

        # ---------- TEST G: pan drag masih berfungsi ----------
        print("\n--- TEST G: PAN DRAG ---")
        page.locator('[aria-label="Fit ke PO (reset zoom dan posisi)"]').click()
        page.wait_for_timeout(700)
        before = page.evaluate("""() => { const el = document.querySelector('[aria-label^="Viewer dokumen PO"] div[style*="translate"]'); return el ? el.style.transform : ''; }""")
        region = page.locator('[aria-label^="Viewer dokumen PO"]')
        rb = region.bounding_box()
        # drag pada area kosong gambar (hindari pin & kartu) — pojok kiri atas
        cx = rb["x"] + 60
        cy = rb["y"] + 80
        page.mouse.move(cx, cy)
        page.mouse.down()
        page.mouse.move(cx + 120, cy + 60, steps=8)
        page.mouse.up()
        page.wait_for_timeout(500)
        after = page.evaluate("""() => { const el = document.querySelector('[aria-label^="Viewer dokumen PO"] div[style*="translate"]'); return el ? el.style.transform : ''; }""")
        st = viewer_state()
        check("G1 pan menggeser transform", before != after, "before=" + before[:60] + " after=" + after[:60])
        check("G2 tidak blank setelah pan", st["exists"] and st["imgLoaded"] and not st["nanTransform"], st["worldTransform"][:80])
        screenshot("g_pan")

        browser.close()

    # ---------- Console errors ----------
    real_errors = [e for e in console_errors if "useLayoutEffect" not in e[1] and "download the React DevTools" not in e[1]]
    pageerr = [e for e in page_errors if "download the React DevTools" not in e]
    check("Console tanpa error", len(real_errors) == 0 and len(pageerr) == 0, "console_errors=" + json.dumps(real_errors[:5]) + " page_errors=" + json.dumps(pageerr[:5]))


def rects_overlap(a, b):
    ax0, ay0, ax1, ay1 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx0, by0, bx1, by1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    return not (ax1 <= bx0 or bx1 <= ax0 or ay1 <= by0 or by1 <= ay0)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("SCRIPT ERROR: " + repr(exc))
        results.append(("script", False, str(exc)))
    fails = sum(1 for _, ok, _ in results if not ok)
    print("\n=== RESULT: " + str(len(results) - fails) + " PASS, " + str(fails) + " FAIL ===")
    sys.exit(1 if fails else 0)
