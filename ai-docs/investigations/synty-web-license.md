# Investigation: Can Synty assets be used in a three.js portfolio website?

**Date:** 2026-10-17  **Status:** ✅ Resolved (2026-10-17). Ariann switched the portfolio to **Kenney (CC0)** assets, so Synty is not used anywhere in the portfolio and no email to Synty is needed. The analysis below is kept for reference, and it still matters for **Speed King itself** (a videogame, which the Synty EULA always covers).

> **Speed King vehicles and the portfolio:** the firetruck, police and garbage truck scenes use only `assets/models/kenney/cars/` (Kenney Car Kit, CC0), so they can be exported into the portfolio. The wheelchair's chair is Kenney, but its "lady" driver uses a Synty Kids texture, so leave her out.
**Not legal advice.** This is a reading of the public EULA. Synty's written answer settles it.

## Problem

The portfolio is a browser-based 3D driving experience built from Synty POLYGON assets. In a three.js site the browser downloads the `.glb` model files, so anyone can extract them. We need to know whether the Synty licence covers this use.

## TL;DR

- **It isn't forbidden, but it isn't clearly covered either.** The EULA covers a **"Product"**, defined as *"any videogame (which will always be covered by your licence)"*, or *"any other product or production that we agree with you in writing"*.
- **The portfolio is a playable browser game** (driving, a time trial, minigames). There's a reasonable argument that it counts as a videogame, but its main purpose is a portfolio, which is the grey area.
- **Showing Speed King's own vehicles to promote Speed King** looks like the clearest case. The entitlements include publishing and showing assets in promotional materials for your Products.
- **Hard rules that apply regardless:** never share **source files** (FBX/atlases) outside your team, which means never committing them to the public repo. Never offer assets for reuse (no "download the model" features). Never feed them into generative-AI datasets.
- **The licence is not limited by engine or platform**, so the web as a platform isn't excluded.

## Recommended remedy

1. **Email Synty** (bizdev@syntystudios.com, the address the EULA gives for uses outside the licence) and ask for written confirmation. Draft below.
2. **Keep building in the meantime.** Development, the Godot layout and local testing aren't affected. Only the **public deploy of the 3D world** waits for the answer. The Plain View (no Synty assets) can go live any time.
3. **Defensive measures**, which are good practice either way:
   - `level/assets/` and raw exports are git-ignored, so only optimized, merged `.glb` files ship
   - `gltf-transform join`/`instance` merges props into district meshes, so the shipped files aren't a neat library of individual assets
   - No feature that lets visitors download models
   - Credit in the footer and Plain View: "3D assets by Synty Studios" (check whether they want a specific attribution)
4. **Fallback** if Synty says no: Kenney kits (CC0, already in `~/Documents/Personal/Models`) for the town. Ask separately about the Speed King promo use, which is likely to be approved.

## Draft email

> **Subject:** Licence question: Synty assets in a browser-based portfolio game (three.js)
>
> Hi Synty team,
>
> I'm an indie developer (OutOfBoundsGames). My game **Speed King** (Steam app 4669300, releasing 10 Nov 2026) is built with POLYGON assets I bought from you.
>
> I'm building a personal portfolio website that is itself a small browser game: visitors drive a vehicle around a low-poly town made from POLYGON packs (Town, SciFi City, Shops, Street Racer, Kaiju), and each district presents my work and my games. It's built with three.js, so the browser loads optimized, merged glTF (.glb) files. No source files are distributed, and there's no way to download the models.
>
> Could you confirm in writing that:
> 1. this use is covered by my licence, and
> 2. I can show Speed King's vehicles in it to promote the game?
>
> If there's a specific credit line you'd like on the site, I'm happy to add it.
>
> Thanks,
> Ariann Michael
> ariannmichael@gmail.com

## How this was investigated

- Read the public EULA at `https://syntystore.com/pages/end-user-licence-agreement` (2026-10-17). It has no numbered sections. The relevant headings are *Definitions*, *Your licence entitlements*, *Source files* and *Other restrictions*. Web, WebGL, three.js, glTF and portfolio uses are not mentioned.
- No licence or EULA file is included in the local pack folders under `~/Documents/Personal/Models`.
- Inspected `~/Documents/Personal/be_quick_or_be_dead/assets/models`. Speed King uses Synty packs (Street Racer, Kids, Kaiju, Town, Farm, Pirates, etc.) plus Kenney assets.
- Also found `assets/models/nissan/nissan_gtr.glb` (real-brand trademark, unknown source) and `scenes/vehicles/gorilla/Gorilla.glb` (unknown source). Neither should go into the portfolio until their origin and licence are confirmed. **Worth checking for Speed King itself before launch too.**
