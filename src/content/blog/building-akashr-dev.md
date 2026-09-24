---
title: Building akashr.dev — a terminal portfolio inside an OLED laptop
date: 2026-09-25
summary: Notes from rebuilding my portfolio: the 3D laptop frame, a floating bot that doesn't stutter, typing effects that never shift the layout, and making it fast.
tags: [react, css, performance, portfolio]
project: portfolio
---

My portfolio has always been a terminal. This rebuild kept that idea but put the terminal *inside something*: a laptop with an OLED screen, sitting on a softly lit desk. Here are the parts that were more interesting than they looked.

## A laptop made of CSS

The laptop is plain HTML and CSS — a lid, a bezel with a camera dot, a keyboard deck drawn as a trapezoid with `clip-path`, and a blurred shadow underneath.

The one rule I kept: **never transform the screen permanently.** Text inside a rotated 3D plane goes blurry. So the lid only rotates during the opening animation, then settles back to `transform: none`, keeping every character crisp. The "OLED" effect is a true-black panel with a black overlay that fades out after the lid opens, like a screen waking up.

On phones the whole frame disappears and the terminal becomes a full-screen app with a bottom tab bar — the laptop is a desktop treat, not a mobile tax.

## A bot that moves smoothly

The companion bot used to store its position in React state and update it every 20 ms. That meant constant re-renders and a jittery, fixed-step walk.

Now the position, velocity and target live in refs, and a `requestAnimationFrame` loop:

- steers velocity toward the target instead of teleporting,
- eases off as it arrives,
- writes the result straight to `transform` — no React render at all.

Dragging uses pointer events (so it works on touch), and dropping the bot clears its old destination — it used to fly back to where it was heading before you grabbed it.

## Typing effects that don't move anything

Typewriter effects usually cause layout shift: text grows, the container re-centres, everything nudges around. The fix is to render the **full final text from the first frame** and only reveal it:

```jsx
<span>{line.slice(0, shown)}</span>
<span className="caret" />
<span style={{ visibility: 'hidden' }}>{line.slice(shown)}</span>
```

The hidden remainder keeps its space, so wrapping is final before the first character appears. The same idea powers the `profile.json` card on the home page and the stat counters, whose widths are reserved for their final values.

## Making it fast

- Every page except the landing page is a separate chunk, loaded on demand; the rest are prefetched a few seconds after the first screen, once the browser is idle.
- The Firebase SDK for the view counter loads only after that first screen too, so it never competes with it.
- A tiny inline "booting…" shell paints straight from the HTML, before any JavaScript arrives.
- Project preview videos were re-encoded from 136 MB down to under 10 MB, show a lightweight WebP poster, and download nothing until they're hovered (or scrolled into view on a phone).
- Blog posts are rendered from markdown at build time, so the browser never downloads a markdown parser.
- The GitHub contribution graph is one SVG instead of ~365 separate boxes, and every loading shimmer animates opacity only.
- Each route is pre-rendered to static HTML at build time, with its own title, description, social preview card and structured data — so search engines, link previews and AI assistants can read it without running JavaScript. There's an `llms.txt` too.

## What's next

A proper virtual file system for the terminal (`cd projects && cat neo.md`), and more devlog posts like this one.

The source is on [GitHub](https://github.com/Akash-rengaraj/Personal-Portfolio).
