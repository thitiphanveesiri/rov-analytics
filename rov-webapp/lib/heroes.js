// lib/heroes.js
// ── Extracted from components/RovApp.js ──
// This is a plain (non "use client") module so it can be safely imported
// from BOTH client components (RovApp.js) and server code (API routes,
// analytics endpoints) — that's the main reason to pull it out: the
// analytics routes need HERO_DATA's role mapping too, and importing a
// "use client" file into a server Route Handler is asking for bundler
// trouble.
//
// NOTE ON MUTATION: RovApp.js currently mutates this array in place at
// runtime (pushes custom heroes, rewrites .role from roleOverrides — see
// the useEffect keyed on app.customHeroes/app.roleOverrides). That
// behavior is preserved here on purpose: HERO_DATA is still a single
// module-level singleton, so every file that imports it shares the same
// array reference, exactly like before. Moving the declaration doesn't
// change that.

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
].sort((a,b)=>a.name.localeCompare(b.name));

export const ROLES_FILTER = ["All","Slayer","Jungle","Mid","Abyssal","Support"];
export const ROLES_PICK   = ["Slayer","Jungle","Mid","Abyssal","Support"];
export const ROLE_COLOR   = {Slayer:"#e17055",Jungle:"#00b894",Mid:"#6C5CE7",Abyssal:"#fdcb6e",Support:"#74b9ff"};

/**
 * Resolve a hero's effective role, honoring role overrides and custom
 * (team-added) heroes — same precedence RovApp.js already uses at
 * runtime (roleOverrides[name] || original role), just factored out so
 * server-side analytics code can compute the same answer without
 * needing a live, mutated HERO_DATA array in memory.
 *
 * @param {string} heroName
 * @param {Array<{name:string, role:string}>} customHeroes - from TeamData.customHeroes
 * @param {Record<string,string>} roleOverrides - from TeamData.roleOverrides
 */
export function resolveHeroRole(heroName, customHeroes = [], roleOverrides = {}) {
  if (roleOverrides?.[heroName]) return roleOverrides[heroName];
  const builtin = HERO_DATA.find(h => h.name === heroName);
  if (builtin) return builtin.role;
  const custom = customHeroes.find(h => h.name === heroName);
  return custom?.role || "Unknown";
}
