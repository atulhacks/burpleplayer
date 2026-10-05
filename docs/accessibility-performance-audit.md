# Accessibility and performance audit — 2026-10-04

## Scope and method

This audit used the `accessible-animation` and `60fps-animation` skill checklists
against the Tauri macOS UI. Static review covered the React accessibility tree,
CSS transitions, GSAP tickers, and SVG spectrum updates. The app was exercised
through its native accessibility tree, and `pnpm audit:contrast` checked key
foreground/background pairs using the WCAG relative-luminance formula. The
contrast threshold is 4.5:1 for normal text ([WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)).

## Findings fixed

| Finding                                                                                    | Change                                                                                                                    | Verification                                                                                               |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Scene hotspots remained in keyboard order behind glass panels                              | The scene becomes `inert` once a panel is rendered; DOM order now starts with titlebar and navigation                     | Native accessibility tree removed scene controls in Library; Tab from navigation reached Library search    |
| Global transport shortcuts stole arrow keys from native select controls and panel browsing | Inputs, selects, editable content, and active panels are excluded; arrow shortcuts still work from ordinary buttons       | Code review of `src/App.tsx`                                                                               |
| Search input hid its visible focus ring; selects had no custom ring                        | Added focus rings for search wrapper, selects, and programmatically focused panel headings                                | CSS review and native focus traversal                                                                      |
| Reduced-motion navigation still jumped the pillars apart                                   | Pillars remain fixed in reduced mode; only a short panel fade remains                                                     | Code review plus live Settings toggle                                                                      |
| Long-running scanning art had no motion pause control                                      | Added a keyboard-operable pause/resume button for both ASCII and JSON-driven SVG motion; empty-library art now plays once | Code review; follows [WCAG 2.2 SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) |
| Spectrum bars changed SVG geometry at 30 Hz                                                | Fixed bar geometry and update only `scaleY` through refs                                                                  | Code review of `useSceneMotion.ts`                                                                         |
| Global button transitions included background color and shadow                             | Removed those per-frame paint transitions; press feedback remains transform-based                                         | CSS review                                                                                                 |
| Moving blurred clouds reduced the full-scene ticker cadence                                | Kept the soft foreground cloud layer static and replaced moving Gaussian cloud shadows with an alpha radial gradient      | Foreground mean interval improved from 51.9 ms to 33.3 ms; visual comparison retained the cloud silhouette |
| `block` 0.1.6 emitted a Rust future-incompatibility warning                                | Patched the existing transitive crate locally with an inhabited opaque class and explicit C ABI                           | `cargo check` and Clippy complete without warnings                                                         |

The scene, ASCII and Lottie extras use the shared GSAP ticker, not separate
visual `requestAnimationFrame` or `setInterval` loops. The scene ticker stops
when the document is hidden, reduced motion is active, or a glass panel is
open. The LCD spectrum keeps updating under reduced motion.

## Contrast measurements

`pnpm audit:contrast` checked eight pairs, including composited glass and dock
backgrounds. The lowest measured ratio was **5.50:1** for ASCII empty art over
glass; LCD ink over the blue screen measured **6.13:1**; title text over the
blue sky measured **6.41:1**. The checks cover named combinations, not every
possible pixel under translucent surfaces.

## Frame-timing measurements

The initial opt-in `VITE_PERF_AUDIT=1` probe sampled the shared GSAP ticker
after the document was focused. It recorded three seconds of steady Play view
and four view changes over four seconds in a debug macOS app bundle on an Apple
M4 with 16 GB RAM, two library tracks, and no audio playing. These are ticker
intervals, **not** a browser paint/composite trace. The current probe source is
`src/lib/performanceProbe.ts`; it writes `burple.perf-audit` to the app's local
storage.

| Mode                      | Window                | Frames | Mean interval |   p95 |    Max | Frames over 34 ms |
| ------------------------- | --------------------- | -----: | ------------: | ----: | -----: | ----------------: |
| Before cloud optimization | Steady, 3 s           |     58 |       51.9 ms | 79 ms |  83 ms |                58 |
| Before cloud optimization | Four transitions, 4 s |    107 |       37.4 ms | 52 ms | 125 ms |                28 |
| Optimized full scene      | Steady, 3 s           |     90 |       33.3 ms | 34 ms |  35 ms |                 1 |
| Optimized full scene      | Four transitions, 4 s |    118 |       33.9 ms | 35 ms |  99 ms |                10 |
| Reduced motion            | Steady, 3 s           |     90 |       33.3 ms | 34 ms |  35 ms |                 4 |
| Reduced motion            | Four transitions, 4 s |    118 |       33.9 ms | 56 ms |  73 ms |                13 |

### Focused release-bundle diagnostic

The audit was repeated with an opt-in **release** app bundle on the same Apple
M4, with the native window focused throughout. This version of the probe sampled
both the GSAP ticker and an independent `requestAnimationFrame` clock. The
report was recorded at 2026-10-04 13:44:31 UTC, before the later swing-anchor
change in commit `1b596d9`. The
physical display reported 1470 × 956 at **60 Hz** through CoreGraphics; the
WebKit screen reported the same size at device-pixel ratio 2. The stage-hidden
phase set `.scene-frame` to `visibility: hidden`, but kept the rest of the UI and
the scene's ticker alive. The extra rAF loop exists only in the opt-in audit
build; it is not part of a normal release.

To repeat the diagnostic, run `VITE_PERF_AUDIT=1 pnpm tauri build --bundles app`,
open that bundle, and keep its window focused for at least 13 seconds.
`python3 scripts/read-perf-audit.py` prints the latest saved report,
including a per-view transition breakdown in current probe builds. Rebuild
without `VITE_PERF_AUDIT` afterward to restore the normal release bundle.

| Clock       | Phase                 | Frames | Mean interval |   p95 |    Max | Frames over 25 ms |
| ----------- | --------------------- | -----: | ------------: | ----: | -----: | ----------------: |
| GSAP ticker | Steady scene, 3 s     |     90 |       33.3 ms | 35 ms |  35 ms |                90 |
| Raw rAF     | Steady scene, 3 s     |     90 |       33.3 ms | 35 ms |  35 ms |                90 |
| GSAP ticker | Stage hidden, 1.6 s   |     48 |       33.3 ms | 34 ms |  35 ms |                48 |
| Raw rAF     | Stage hidden, 1.6 s   |     48 |       33.3 ms | 34 ms |  34 ms |                48 |
| GSAP ticker | Four transitions, 4 s |    117 |       34.2 ms | 35 ms | 129 ms |               116 |
| Raw rAF     | Four transitions, 4 s |    117 |       34.2 ms | 35 ms | 130 ms |               116 |

The requested steady **60 fps** and zero-dropped-transition-frame budget is
**not met in this measured run**. Because raw rAF and GSAP share the same ~30 Hz
cadence even with the scene visually hidden, this result does not support
blaming the SVG scene or GSAP for the steady-state ceiling. It also does not
prove a general WKWebView cap: the test did not isolate every remaining DOM
layer, OS scheduling policy, or the capture environment. The 129–130 ms
transition outlier is a separate, observable hitch that still needs profiling.
The cloud-filter fix reduced avoidable paint work, but its previous ~30 Hz
result was a host cadence rather than proof of 60 fps.
