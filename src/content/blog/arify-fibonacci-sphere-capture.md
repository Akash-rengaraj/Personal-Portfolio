---
title: Spreading 50 capture points evenly on a sphere — the Fibonacci trick behind ARify
date: 2026-09-12
summary: How ARify guides a phone around a room using a spherical Fibonacci lattice, captures frames automatically, and ships them to a FastAPI backend for reconstruction.
tags: [ar, flutter, fastapi, math]
project: arify
---

**ARify** turns a room into a shareable 3D space using nothing but a phone's AR hardware and open-source processing. The hardest part turned out not to be the reconstruction — it was *telling the user where to point the camera*.

## Why "just walk around" doesn't work

Photogrammetry needs overlapping views from many directions. Ask someone to "capture the whole room" and you get twenty photos of the interesting wall and none of the ceiling. The result has holes.

What I needed was a set of target directions that covers the full sphere around the user **evenly**, so every region of the room gets roughly the same attention.

## Latitude/longitude grids are a trap

The obvious approach — rings of points at fixed latitudes — bunches points up near the poles and leaves the equator sparse. You end up over-capturing the floor and ceiling and under-capturing the walls, which is exactly backwards for a room.

## The spherical Fibonacci lattice

The fix is a **spherical Fibonacci lattice**. For `n` points, each point `i` gets:

- a height that steps evenly from top to bottom, and
- a rotation around the vertical axis that advances by the **golden angle** (≈ 137.5°) each step.

Because the golden angle is irrational, no two points ever line up in the same column, and the points spread out almost perfectly evenly.

```js
// n evenly distributed unit vectors on a sphere
function fibonacciSphere(n) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.39996 rad
  const points = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;       // height: 1 → -1
    const radius = Math.sqrt(1 - y * y);     // ring radius at that height
    const theta = goldenAngle * i;           // spin by the golden angle
    points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return points;
}
```

ARify uses **50 nodes** — enough overlap for reconstruction without turning the capture into a chore.

## Guiding the user

In the Flutter app, those 50 directions are placed as targets on a virtual guidance sphere around the user using native **Android ARCore** tracking. The user simply turns and tilts the phone toward the next highlighted target.

## Auto-trigger capture

Tapping a shutter button fifty times while holding a phone steady is miserable, so ARify captures **automatically**: the moment the camera's forward direction aligns with a target node, the frame is snapped and the node is marked done. The user's only job is to aim.

## Zero-cost processing

Instead of paying for a cloud reconstruction API, ARify compresses the captured frames into a `.zip` payload and sends it to a **FastAPI** backend. The backend accepts the multi-part upload and queues the heavy 3D reconstruction as a background job, so the app never blocks waiting for it.

## What I learned

- Good UX for a capture flow is mostly about removing decisions from the user.
- A little math (one irrational angle!) can replace a lot of heuristics.
- Keeping the expensive work asynchronous on the backend keeps the mobile app snappy.

ARify is still in development — follow along on [GitHub](https://github.com/Akash-rengaraj/ARify) or read the [case study](/projects/arify).
