# WoW component visual QA

Reference: original vanilla 1.12 artwork from `doorknob6/vanilla-wow-interface-textures`, immutable commit `fce08de771abbb8ce8989b6c859f3071aff3f6c6`. This is a visual reference, not a claim of Classic Era or Forever rules parity.

Internal workbench: `/` with sections `#hud`, `#panels`, `#states`, and expandable `#references`. The reference gallery renders originals at one source pixel per CSS pixel. Desktop native panel/frame pieces retain that scale; narrow Quest panels and actionbar ornaments scale down explicitly for smaller containers. The top Prüfbreite toolbar offers full-width, 375px and 320px container checks, not physical mobile viewport emulation. Sample stats, items, talent nodes and text are marked presentation examples. Root controller owns managed browser QA and screenshot evidence.

## Asset inspection and mechanical verification

- Inspected actual source PNGs before declaring crops, including dialog eight-segment strip, player full/small frame atlas, target portrait on the right, minimap ring/title, baked 4×4 backpack, paperdoll quadrants, QuestGreeting parchment, and MageFire quadrants.
- The dialog's corner positions are x=128/160/192/224; x=64/96 are vertically stored top/bottom edge slices and receive 90° rotation. No border strip is stretched over a window.
- `prepareAssets` checks all 170 PNG signatures, actual IHDR dimensions, exact byte lengths, SHA256 and Git blob SHA before output. Crops must have positive integer dimensions and remain inside actual source rectangles. It emits lossless SVG viewports embedding original PNG bytes, not resampled graphics.
- Sources are all from the same immutable pin and were captured exclusively through the GitHub connector. Full source URLs and hashes are in `assets/source-lock.json`. Original art is Blizzard intellectual property; no permissive asset license is asserted. Internal visual evaluation only.
- Manual additions are `missing-icon.svg`, `map-placeholder.svg`, `armour-study.svg`, plus declared CSS overlays, labels and sample talent connections. They are separate from original art in `assets/components.json`.

## Component results

| Part | Workbench specimen / source | Verified implementation | Browser comparison |
| --- | --- | --- | --- |
| Action bar / endcaps | `#hud`; MainMenuBar Human + EndCap Human | Native central stone strip, 128px ornaments, mirrored right ornament, 12 icon callbacks, selected/cooldown/count/hotkey states, wrap at narrow widths | PASS: native stone/ornaments; all 12 slots wrap 4×3 within 288px bar at 320px container; Sturmangriff updates selected state/readout. [Final desktop workbench](wow-workbench.jpg). |
| Minimap | Header; UI-Minimap-Border | Ring and title use distinct declared crops; map circular mask and named marker callback; authored absent/error placeholder | PASS: circular ring/title aligned at desktop; original atlas compared 1:1 in reference gallery. |
| Player / target frames | `#hud`; Player-Portrait + TargetingFrame | Player face left, target face right; independent health/resource bars; long German name retains accessible name/title; native 193px frames | PASS: 193px frames, portrait sides, health/resource bounds and full accessible long name verified at desktop; original player/target sheets compared 1:1. |
| Backpack | `#panels`; BackpackBackground | Crop x65..256; icons align within baked 4×4 grid, without extra slot borders | PASS: baked 4×4 slots align at desktop and 320px; [narrow quest/bag capture](images/wow-ui-320-quest-bag.jpg). |
| Character sheet | `#panels`; PaperDoll L1/L2/R1/R2 | Four original tiles at native scale; item slots and explicitly authored armor study; German names/sample stats | PASS: paperdoll native tile seams and visible equipment/figure composition checked at desktop; original quadrant compared 1:1. |
| Quest parchment | `#panels`; QuestGreeting four quadrants | Original stone surround and gold parchment with real native seams; German sample prose and native red button | PASS: parchment seams/colors and visible Weiterlesen callback at 320px; [quest/bag capture](images/wow-ui-320-quest-bag.jpg). |
| Talents | `#panels`; MageFire four quadrants | Native background with explicitly illustrative node placement/ranks/connection; no game rules | PASS: MageFire background remains visible and fits narrow container; [talents capture](images/wow-ui-320-talents.jpg). |
| Dialog | `#states`; DialogBox background/header/border | Fixed corners, repeated edge pieces, repeated interior; close and reopen callbacks | PASS: fresh reload confirms corrected native header caps/center; confirm and reopen callbacks pass; [desktop states](images/wow-ui-desktop-states-reloaded.jpg). |
| Tooltip | `#states`; Tooltip-Border | Eight native 16px pieces; readable static specimen; focus/hover trigger, Escape dismissal, aria-describedby | PASS: compact static tooltip wraps; 260px triggered tooltip fits 320px container; focus/click opens, Escape closes; [tooltip capture](images/wow-ui-320-tooltip.jpg). |
| Button / icon state matrix | `#states`; native Up/Down/Highlight + Quickslot2 | Normal, pressed, highlighted, disabled, selected, cooldown; long German labels; missing/load-error icon fallback; native button semantics | PASS: normal/pressed/highlighted/disabled/selected/cooldown and fallback visually distinct; natural hyphens and full accessible names; [desktop states](images/wow-ui-desktop-states-reloaded.jpg). |
| Progress bars | `#hud`; UI-StatusBar | Native fill texture tinted by presentation tone; finite range clamp and accessible progressbar semantics | PASS: fill bounds and native texture/tone remain readable in unitframes and XP bar; original fill used without gameplay rules. |

## Automated checks

`npm run test`: full suite 54/54 passing (five files). `npm run test -- tests/ui/components.test.ts`: 15 tests passing (asset rectangles/dimensions and rejection, five button states, five icon states, fallback/load-error/cooldown, long unit name and finite progress). `npm run typecheck`: passing. Browser-native interaction, screenshots, narrow-container overflow and texture seams were checked directly by the controller below.

## Browser QA evidence

Root controller approved the T19 browser QA scope on 2026-10-21 after a fresh managed-preview reload. Desktop viewport: 1363×936, document width 1348px (no horizontal overflow). At the 375px and 320px internal width settings, `main.clientWidth`/rendered width and `main.scrollWidth` match 375 and 320 respectively. At 320px all 12 action slots fit a 288px bar in a 4×3 layout. The narrower Quest and talent specimens remain visible and interactive. The original-reference expander was opened and all 11 specimens compared at 1:1 CSS/source scale; see [original references](images/wow-components-native-references.jpg).

This is **container responsiveness QA**, not a physical-device viewport test: the available browser interface did not expose viewport resizing. No physical phone/device result is claimed.

Initial/stale HMR screenshots were not retained. The final fresh reload specifically verified the revised native header cap/center composition. The selected final captures are committed under `docs/qa/images/` and linked in the per-component table.

Optional later polish: the compact actionbar retains an extra metal gutter on its right. All slots remain visible and operable; this is not a T19 blocker.

Final desktop overview: [WoW component workbench](wow-workbench.jpg) (1348×926 JPEG, fresh reload).
