// lib/heroes.js
// ── Extracted from components/RovApp.js ──
// This is a plain (non "use client") module so it can be safely imported
// from BOTH client components (RovApp.js, shared UI components) and server
// code (API routes, analytics endpoints) — that's the main reason to pull
// it out: the analytics routes need HERO_DATA's role mapping too, and
// importing a "use client" file into a server Route Handler is asking for
// bundler trouble.
//
// NOTE ON MUTATION: RovApp.js mutates HERO_DATA in place at runtime (pushes
// custom heroes, rewrites .role from roleOverrides). That behavior is
// preserved on purpose — HERO_DATA stays a single module-level singleton
// no matter how many files import it.
//
// NOTE ON REACT APIS HERE: this file isn't marked "use client", but that's
// fine — a plain hook/context declaration doesn't need it, only components
// that render JSX do. useHeroImage and HeroPhotosContext only ever get used
// from inside components that are already client components (HeroChip,
// RovAppInner, etc.), so there's no server/client mismatch risk. The
// Provider/Consumer relationship works off the shared object reference,
// not which file declared it — moving HeroPhotosContext here doesn't
// change behavior at all, RovApp.js just imports the same object instead
// of declaring it locally.

import { useState, useEffect, useContext, createContext } from "react";

export const HERO_DATA = [
  {name:"Airi",role:"Slayer",img:"airi"},{name:"Aleister",role:"Support",img:"aleister"},
  {name:"Alice",role:"Support",img:"alice"},{name:"Allain",role:"Slayer",img:"allain"},
  {name:"Amily",role:"Slayer",img:"amily"},{name:"Annette",role:"Support",img:"annette"},
  {name:"Arum",role:"Support",img:"arum"},{name:"Arthur",role:"Slayer",img:"arthur"},
  {name:"Astrid",role:"Slayer",img:"astrid"},{name:"Azzen'Ka",role:"Mid",img:"azzenka"},
  {name:"Baldum",role:"Support",img:"baldum"},{name:"Bijan",role:"Slayer",img:"bijan"},
  {name:"Butterfly",role:"Slayer",img:"butterfly"},{name:"Capheny",role:"Abyssal",img:"capheny"},
  {name:"Celica",role:"Mid",img:"celica"},{name:"Charlotte",role:"Support",img:"charlotte"},
  {name:"Chaugnar",role:"Support",img:"chaugnar"},{name:"D'Arcy",role:"Mid",img:"darcy"},
  {name:"Diao Chan",role:"Mid",img:"diaochan"},{name:"Dirak",role:"Slayer",img:"dirak"},
  {name:"Edras",role:"Slayer",img:"edras"},{name:"Eland'orr",role:"Jungle",img:"elandorr"},
  {name:"Elsu",role:"Abyssal",img:"elsu"},{name:"Enzo",role:"Support",img:"enzo"},
  {name:"Fennik",role:"Abyssal",img:"fennik"},{name:"Florentino",role:"Slayer",img:"florentino"},
  {name:"Gildur",role:"Support",img:"gildur"},{name:"Grakk",role:"Jungle",img:"grakk"},
  {name:"Hayate",role:"Jungle",img:"hayate"},{name:"Helen",role:"Support",img:"helen"},
  {name:"Ignis",role:"Mid",img:"ignis"},{name:"Ilumia",role:"Mid",img:"ilumia"},
  {name:"Ishar",role:"Slayer",img:"ishar"},{name:"Jinnar",role:"Mid",img:"jinnar"},
  {name:"Kahlii",role:"Mid",img:"kahlii"},{name:"Kaine",role:"Slayer",img:"kaine"},
  {name:"Keera",role:"Jungle",img:"keera"},{name:"Kil'Groth",role:"Jungle",img:"kilgroth"},
  {name:"Kriknak",role:"Jungle",img:"kriknak"},{name:"Krixi",role:"Mid",img:"krixi"},
  {name:"Krizzix",role:"Support",img:"krizzix"},{name:"Lauriel",role:"Mid",img:"lauriel"},
  {name:"Laville",role:"Abyssal",img:"laville"},{name:"Lindis",role:"Abyssal",img:"lindis"},
  {name:"Lorion",role:"Mid",img:"lorion"},{name:"Lu Bu",role:"Jungle",img:"lubu"},
  {name:"Lumburr",role:"Support",img:"lumburr"},{name:"Maloch",role:"Slayer",img:"maloch"},
  {name:"Marja",role:"Support",img:"marja"},{name:"Max",role:"Support",img:"max"},
  {name:"Mganga",role:"Mid",img:"mganga"},{name:"Mina",role:"Support",img:"mina"},
  {name:"Ming",role:"Mid",img:"ming"},{name:"Moren",role:"Abyssal",img:"moren"},
  {name:"Murad",role:"Jungle",img:"murad"},{name:"Nakroth",role:"Jungle",img:"nakroth"},
  {name:"Natalya",role:"Mid",img:"natalya"},{name:"Omen",role:"Jungle",img:"omen"},
  {name:"Ormarr",role:"Support",img:"ormarr"},{name:"Paine",role:"Slayer",img:"paine"},
  {name:"Preyta",role:"Mid",img:"preyta"},{name:"Qi",role:"Slayer",img:"qi"},
  {name:"Quillen",role:"Jungle",img:"quillen"},{name:"Raz",role:"Jungle",img:"raz"},
  {name:"Riktor",role:"Jungle",img:"riktor"},{name:"Rouie",role:"Support",img:"rouie"},
  {name:"Rourke",role:"Slayer",img:"rourke"},{name:"Roxie",role:"Slayer",img:"roxie"},
  {name:"Ryoma",role:"Slayer",img:"ryoma"},{name:"Sephera",role:"Support",img:"sephera"},
  {name:"Sinestrea",role:"Jungle",img:"sinestrea"},{name:"Skud",role:"Jungle",img:"skud"},
  {name:"Slimz",role:"Jungle",img:"slimz"},{name:"Stuart",role:"Support",img:"stuart"},
  {name:"Taara",role:"Slayer",img:"taara"},{name:"Tachi",role:"Jungle",img:"tachi"},
  {name:"Teeri",role:"Mid",img:"teeri"},{name:"Tel'Annas",role:"Abyssal",img:"telannas"},
  {name:"Thane",role:"Slayer",img:"thane"},{name:"Thorne",role:"Support",img:"thorne"},
  {name:"Toro",role:"Support",img:"toro"},{name:"Tulen",role:"Mid",img:"tulen"},
  {name:"Valhein",role:"Abyssal",img:"valhein"},{name:"Veera",role:"Jungle",img:"veera"},
  {name:"Veres",role:"Jungle",img:"veres"},{name:"Violet",role:"Abyssal",img:"violet"},
  {name:"Volkath",role:"Jungle",img:"volkath"},{name:"Wisp",role:"Abyssal",img:"wisp"},
  {name:"Wukong",role:"Jungle",img:"wukong"},{name:"Xeniel",role:"Support",img:"xeniel"},
  {name:"Y'bneth",role:"Support",img:"ybneth"},{name:"Yan",role:"Jungle",img:"yan"},
  {name:"Yena",role:"Jungle",img:"yena"},{name:"Yorn",role:"Abyssal",img:"yorn"},
  {name:"Yue",role:"Mid",img:"yue"},{name:"Zanis",role:"Slayer",img:"zanis"},
  {name:"Zata",role:"Jungle",img:"zata"},{name:"Zephys",role:"Jungle",img:"zephys"},
  {name:"Zill",role:"Mid",img:"zill"},{name:"Zip",role:"Support",img:"zip"},
  {name:"Zuka",role:"Jungle",img:"zuka"},

  {name:"Aoi",role:"Jungle",img:"aoi"},
  {name:"Arduin",role:"Slayer",img:"arduin"},
  {name:"Ata",role:"Support",img:"ata"},
  {name:"Aya",role:"Support",img:"aya"},
  {name:"Bonnie",role:"Mid",img:"bonnie"},
  {name:"Bright",role:"Jungle",img:"bright"},
  {name:"Cresht",role:"Support",img:"cresht"},
  {name:"Dextra",role:"Slayer",img:"dextra"},
  {name:"Erin",role:"Abyssal",img:"erin"},
  {name:"Errol",role:"Slayer",img:"errol"},
  {name:"Iggy",role:"Mid",img:"iggy"},
  {name:"Liliana",role:"Mid",img:"liliana"},
  {name:"Omega",role:"Support",img:"omega"},
  {name:"Richter",role:"Slayer",img:"richter"},
  {name:"Superman",role:"Slayer",img:"superman"},
  {name:"TeeMee",role:"Support",img:"teemee"},
  {name:"The Flash",role:"Jungle",img:"theflash"},
  {name:"Wiro",role:"Jungle",img:"wiro"},
  {name:"Wonder Woman",role:"Slayer",img:"wonderwoman"},
  {name:"Dolia",role:"Support",img:"dolia"},
  {name:"Dyadia",role:"Support",img:"dyadia"},
  {name:"Billow",role:"Jungle",img:"billow"},
  {name:"Heino",role:"Mid",img:"heino"},
  {name:"Goverra",role:"Mid",img:"goverra"},
  {name:"Biron",role:"Slayer",img:"biron"},
  {name:"Bolt Baron",role:"Slayer",img:"boltbaron"},
  {name:"Flowborn (Carry)",role:"Abyssal",img:"flowborncarry"},
  {name:"Flowborn (Mage)",role:"Mid",img:"flowbornmage"},
  {name:"Tamyn",role:"Support",img:"tamyn"},
].sort((a,b)=>a.name.localeCompare(b.name));

export const ROLES_FILTER = ["All","Slayer","Jungle","Mid","Abyssal","Support"];
export const ROLES_PICK   = ["Slayer","Jungle","Mid","Abyssal","Support"];
export const ROLE_COLOR   = {Slayer:"#e17055",Jungle:"#00b894",Mid:"#6C5CE7",Abyssal:"#fdcb6e",Support:"#74b9ff"};

/**
 * Resolve a hero's effective role, honoring role overrides and custom
 * (team-added) heroes.
 */
export function resolveHeroRole(heroName, customHeroes = [], roleOverrides = {}) {
  if (roleOverrides?.[heroName]) return roleOverrides[heroName];
  const builtin = HERO_DATA.find(h => h.name === heroName);
  if (builtin) return builtin.role;
  const custom = customHeroes.find(h => h.name === heroName);
  return custom?.role || "Unknown";
}

// ═══════════════════════════════════════════
//  HERO IMAGE RESOLVER (moved here from RovApp.js — co-located with the
//  hero data it resolves images for; TacticalWhiteboard's canvas code also
//  uses checkLocalHeroImage/LOCAL_HERO_IMG_CACHE directly without going
//  through the hook, same as before the move)
//
//  Hero portraits come from files bundled with the app: public/heroes/<slug>.png
//  (slug = the `img` field on each hero above, e.g. public/heroes/airi.png).
//  No external API call — checked once per hero per session and cached.
//  If a file is missing, the calling component falls back to a letter
//  avatar (existing onError handling), and you can just drop the PNG into
//  public/heroes/ later — no code change needed.
// ═══════════════════════════════════════════

// Provides TeamData.heroPhotos (team's own uploaded hero photos) down to
// useHeroImage without threading it through every component's props.
// Declared here (not in RovApp.js) purely so useHeroImage can consume it —
// the <Provider> still lives in RovAppInner's JSX, this is just the shared
// context object both sides reference.
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
