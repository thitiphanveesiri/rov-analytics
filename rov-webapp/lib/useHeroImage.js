"use client";
// lib/useHeroImage.js
// ── Client-only — deliberately kept OUT of lib/heroes.js ──
// This file uses React hooks (useState/useEffect/createContext), so it can
// ONLY ever be imported from client components. It must never be imported
// by lib/matchSync.js or anything under app/api/ — those run server-side,
// and Next.js fails the build the moment a React hook shows up anywhere in
// a server route's import graph, even indirectly (this is exactly what
// broke the last deploy: useHeroImage was living in lib/heroes.js, which
// matchSync.js also imports for resolveHeroRole — so the API routes that
// use matchSync pulled in these hooks transitively and failed to build).
//
// Hero portraits come from files bundled with the app: public/heroes/<slug>.png
// (slug = the `img` field on each hero in lib/heroes.js). No external API
// call — checked once per hero per session and cached. If a file is
// missing, the calling component falls back to a letter avatar (existing
// onError handling in HeroChip/HeroCard/etc.), and you can just drop the
// PNG into public/heroes/ later — no code change needed.

import { useState, useEffect, useContext, createContext } from "react";

// Provides TeamData.heroPhotos (team's own uploaded hero photos) down to
// useHeroImage without threading it through every component's props. The
// <Provider> lives in RovAppInner's JSX (components/RovApp.js) — this is
// just the shared context object both sides reference.
export const HeroPhotosContext = createContext({});

// { heroName: url | null }  null = confirmed no local file for this hero
export const LOCAL_HERO_IMG_CACHE = {};

export function checkLocalHeroImage(slug) {
  return new Promise((resolve) => {
    const png = `/heroes/${slug}.png`;
    const jpg = `/heroes/${slug}.jpg`;

    const img = new Image();

    img.onload = () => resolve(img.src);

    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve(jpg);
      img2.onerror = () => resolve(null);
      img2.src = jpg;
    };

    img.src = png;
  });
}

// Hook: returns resolved image URL for a hero (or null while loading/missing)
// Priority: 1) team's own uploaded photo  2) bundled local image (public/heroes/)
export function useHeroImage(hero) {
  const name = hero?.name;
  const slug = hero?.img;
  const heroPhotos = useContext(HeroPhotosContext);
  const uploadedUrl = name ? heroPhotos[name] : null;
  const [localUrl, setLocalUrl] = useState(() => (name ? LOCAL_HERO_IMG_CACHE[name] ?? null : null));

  useEffect(() => {
    if (!name || uploadedUrl) return; // user-uploaded photo takes priority — skip local lookup
    if (LOCAL_HERO_IMG_CACHE[name] !== undefined) { setLocalUrl(LOCAL_HERO_IMG_CACHE[name]); return; }
    let cancelled = false;
    checkLocalHeroImage(slug).then((url) => {
      LOCAL_HERO_IMG_CACHE[name] = url; // cache the answer either way
      if (!cancelled) setLocalUrl(url);
    });
    return () => { cancelled = true; };
  }, [name, slug, uploadedUrl]);

  return uploadedUrl || localUrl;
}
