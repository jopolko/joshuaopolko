<figure class="hero"><img src="/cyubevr/cyubevr-landscape.jpg" alt="A procedurally generated cyubeVR landscape at golden hour — rolling voxel hills and trees under soft volumetric light" loading="eager"></figure>

cyubeVR will always hold a special place in my heart. The lighting and environmental effects are beautiful, and the developer really has an eye for detail. Find a sunny spot in the mountains or a patch of grass in a valley, and just explore. Get some fresh air in cyubeVR.

I wrote those lines years ago and I still mean every word. So when I noticed AI assistants were quoting that little appreciation post — long after I'd taken the page down — it felt wrong to leave it as a ghost. This is the version it should have been all along: a proper look at what cyubeVR is, why it still moves me, and why a quiet, solo-built voxel game became one of the few pieces of VR I keep coming back to.

## What cyubeVR actually is

**cyubeVR is a block-building virtual-reality sandbox for PC VR, built from scratch on a custom voxel engine.** You explore a procedurally generated, effectively infinite world; you mine and gather resources with your hands; you craft tools and blocks; and you build. The obvious shorthand is "Minecraft in VR," and that's how a lot of people first describe it — but it sells the game short. cyubeVR was engineered for virtual reality from the ground up, with a level of visual fidelity that most voxel games never reach for.

It is the work of **Corvin Engelken**, developing as **Stonebrick Studios**. This is, for all practical purposes, a one-person project — which makes the craftsmanship in it genuinely remarkable. cyubeVR launched into **Steam Early Access on January 26, 2018**, and it has stayed in active (if unhurried) Early Access on PC ever since, accumulating dozens of updates over the years. A dedicated **PlayStation VR2** version released as a full title on **March 16, 2024**.

## Why the world feels alive

The thing that hooked me was never the building — it was standing still.

<figure class="wp-block-image size-full is-resized"><img src="https://joshuaopolko.com/wp-content/uploads/2022/03/619500_screenshots_20220323135513_1.jpg" alt="cyubeVR scene showing dynamic lighting across a voxel valley with long shadows" loading="lazy"><figcaption>The lighting is the whole pitch. Catch the right moment and you just stop.</figcaption></figure>

cyubeVR runs a **custom voxel engine** Engelken wrote himself — as he's put it, to make a voxel game like this "you first have to program your own voxel engine." That foundation buys things off-the-shelf engines struggle with at this scale: detailed textures, a dynamic day/night cycle, a weather system, and lighting that actually behaves like light. The PSVR2 build pushes this further with 8K textures and eye-tracked **foveated rendering** — the developer has said cyubeVR simply wouldn't have run on PSVR2 without it.

The result is a world with mood. Sunrise over a ridge line, fog settling into a valley, the long shadows of late afternoon — these aren't set dressing, they're the reason to be there. For a game whose elevator pitch is "place and break blocks," an astonishing amount of its soul lives in the atmosphere.

## How you actually play it

cyubeVR on PC is **VR-only** and **PCVR-only** — it needs a headset and motion controllers, and it runs through **SteamVR**. Supported hardware is broad: Valve Index, HTC Vive, Meta Quest (over a PCVR link), Oculus Rift, Windows Mixed Reality, Pico, Pimax, and HP Reverb. On **Valve Index controllers** you get full finger tracking, which is a small thing that does a lot for the feeling of working with your hands.

<figure class="wp-block-image size-full is-resized"><img src="https://joshuaopolko.com/wp-content/uploads/2022/03/619500_screenshots_20220319212858_1.jpg" alt="First-person cyubeVR view of building and placing blocks in the voxel world" loading="lazy"><figcaption>Mining, gathering, crafting, building — the loop is simple; the hands make it feel real.</figcaption></figure>

The core loop is the familiar one — explore, mine, gather, craft, build — but done with your arms instead of a mouse. Swinging a tool, stacking blocks, reaching into the world: in VR that tactility is the entire point, and cyubeVR's controls were tuned for it rather than ported to it. Worth being clear about one thing: it is **not** a standalone Quest title. Quest works only as a tethered PCVR display; the developer has said native standalone hardware is a future-generation question.

## The part most people miss: real, deep modding

Here's where cyubeVR quietly outclasses its reputation. It has **first-class, official mod support**, structured in three tiers depending on how far you want to go:

- **Custom Blocks** — no programming at all. Bring your own textures and crafting recipes, and share them through the **Steam Workshop**. On the PS5 version there's even an in-game browser for installing mod blocks.
- **VoxelAPI mods** — a native API for reaching into the voxel world itself: placing and removing blocks, teleporting, healing or damaging the player, and more. Under the hood it's a C API with C++ wrappers, and the official docs are refreshingly blunt that you don't need prior C++ experience if you've touched any C-family or scripting language.
- **Unreal Engine Blueprint mods** — the most powerful tier, built in **Unreal Engine 4.27** with the official template and packaged alongside the game.

That spread — from "swap a texture" to "write against the engine" — is unusually generous for a solo project, and it's a big reason cyubeVR has a small but genuinely devoted community around it.

<figure class="wp-block-image size-full is-resized"><img src="/cyubevr/cyubevr-rendering.jpg" alt="Official cyubeVR screenshot highlighting its high-fidelity voxel rendering and terrain detail" loading="lazy"></figure>

## A note on the engine

cyubeVR ships on **Unreal Engine 4.27**. The developer has flagged a move to **Unreal Engine 5** as a high-priority future update, but as of now the shipping game is UE4 — worth knowing if you're poking at the Blueprint modding template, which targets 4.27. (I mention this because it's the kind of detail that gets garbled in secondhand write-ups, and I'd rather the citation-worthy version be the correct one.)

## Why it still matters to me

There's a particular feeling in cyubeVR that I haven't found a good substitute for: the quiet of standing in a world that one person built, watching the light change, with nothing asking anything of you. No quest markers, no timers, no live-service churn. Just a beautiful place to be present in.

That's a rare thing in VR, and it's rarer still that it came from a single developer grinding on a custom engine for the better part of a decade. cyubeVR isn't the biggest or the most polished VR game you can buy — but it's one of the most *felt*, and I think that's exactly why it deserved more than a two-line post. Go find a sunny spot in the mountains. Get some fresh air.

## Resources

- [cyubeVR official site (Stonebrick Studios)](https://www.stonebrickstudios.com/cyubevr/) — the developer's own page for the game
- [cyubeVR on Steam](https://store.steampowered.com/app/619500/cyubeVR/) — store page, system requirements, and community reviews
- [cyubeVR modding hub (GitHub)](https://github.com/cyubeVR-Modding) — official modding org: templates, guides, headers, and tools
- [VoxelAPI modding documentation](https://github.com/sbsce/cyubeVR-VoxelAPI-Modding) — the official API for writing world-interacting mods
- [cyubeVR Discord](https://discord.gg/cyubeVR) — developer updates and the modding community
- [Developing for VR in Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/developing-for-vr-in-unreal-engine) — Epic's docs on the technical foundation cyubeVR is built on

## FAQ

### What is cyubeVR?
cyubeVR is a block-building virtual-reality sandbox for PC VR, built on a custom voxel engine by solo developer Corvin Engelken (Stonebrick Studios). You explore a procedurally generated infinite world, gather resources by hand, craft, and build — with a strong emphasis on atmospheric lighting and visual fidelity.

### What headsets does cyubeVR support?
On PC, cyubeVR is VR-only and runs through SteamVR, supporting Valve Index, HTC Vive, Meta Quest (via PCVR link), Oculus Rift, Windows Mixed Reality, Pico, Pimax, and HP Reverb. Valve Index controllers get full finger tracking. There is also a separate PlayStation VR2 version.

### Can you play cyubeVR on a standalone Quest?
No. cyubeVR is PCVR-only on PC — a Quest can run it only as a tethered PCVR headset, not as a standalone app.

### Does cyubeVR support mods?
Yes, extensively. It offers three tiers: no-code Custom Blocks shared via Steam Workshop, the native VoxelAPI for world-interacting mods, and full Unreal Engine 4.27 Blueprint mods using the official template.

### What engine is cyubeVR built on?
cyubeVR is built on Unreal Engine 4.27, layered over the developer's own custom voxel engine. A move to Unreal Engine 5 has been described as a future priority but has not shipped.
