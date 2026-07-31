// lib/heroes.js
// ── Pure data + plain functions only — NO React imports in this file ──
// This file is imported from BOTH client components (RovApp.js, shared UI
// components) AND server code (matchSync.js → API routes like
// /api/admin/backfill-matches, /api/analytics/*). Next.js checks the
// react-hook-usage rule across the WHOLE module graph, not just at the
// call site — so if this file imports useState/useEffect/createContext,
// any server route that transitively imports it fails to build with
// "You're importing a component that needs useState... mark with use
// client" even though nothing here is a component.
//
// That's exactly what broke the last deploy. Fix: keep this file 100%
// React-free. Anything that needs React hooks (useHeroImage,
// HeroPhotosContext) now lives in lib/useHeroImage.js instead, which is
// only ever imported from client components — never from matchSync.js or
// any API route.

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
