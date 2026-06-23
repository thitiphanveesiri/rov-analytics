"use client";
import { useState, useEffect, useReducer, useCallback, useRef, createContext, useContext } from "react";
import { useSession, signOut } from "next-auth/react";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

// ═══════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════
const HERO_DATA = [
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

const ROLES_FILTER = ["All","Slayer","Jungle","Mid","Abyssal","Support"];
const ROLES_PICK   = ["Slayer","Jungle","Mid","Abyssal","Support"];
const ROLE_COLOR   = {Slayer:"#e17055",Jungle:"#00b894",Mid:"#6C5CE7",Abyssal:"#fdcb6e",Support:"#74b9ff"};

const C = {
  bgBase:"#0a0a16", bgPanel:"#14112a", bgCard:"#1a1535", border:"#1e1640",
  primary:"#6C5CE7", primaryLight:"#a29bfe",
  win:"#00cec9", lose:"#fd79a8", ban:"#ff4757",
  blue:"#2196f3", red:"#f44336",
  textMain:"#e8e8f0", textMuted:"#6b6b8a",
};

const iStyle = {
  width:"100%", background:C.bgCard, border:`1px solid ${C.border}`,
  color:C.textMain, borderRadius:8, padding:"9px 12px", fontSize:14,
  boxSizing:"border-box", outline:"none",
};

const DRAFT_ORDER = [
  {team:"blue",action:"ban", slot:0},{team:"red", action:"ban", slot:0},
  {team:"blue",action:"ban", slot:1},{team:"red", action:"ban", slot:1},
  {team:"blue",action:"pick",slot:0},{team:"red", action:"pick",slot:0},
  {team:"red", action:"pick",slot:1},{team:"blue",action:"pick",slot:1},
  {team:"blue",action:"pick",slot:2},{team:"red", action:"pick",slot:2},
  {team:"red", action:"ban", slot:2},{team:"blue",action:"ban", slot:2},
  {team:"red", action:"ban", slot:3},{team:"blue",action:"ban", slot:3},
  {team:"red", action:"pick",slot:3},{team:"blue",action:"pick",slot:3},
  {team:"blue",action:"pick",slot:4},{team:"red", action:"pick",slot:4},
];

const PHASE_SEGS = [
  {label:"BAN 1", color:C.ban,  start:0, end:3,  flex:2},
  {label:"PICK 1",color:C.win,  start:4, end:9,  flex:3},
  {label:"BAN 2", color:C.ban,  start:10,end:13, flex:2},
  {label:"PICK 2",color:C.win,  start:14,end:17, flex:2},
];

const BO_OPTIONS = [1,2,3,4,5,6,7].map(n=>({label:`BO${n}`,total:n}));

const PATTERN_TAGS = [
  "Early Aggro","Late Game","Split Push","Team Fight","Poke Comp",
  "Burst Combo","Tank Heavy","Sustain","Pick Off","Objective Focus",
];

// ═══════════════════════════════════════════
//  HERO PHOTOS CONTEXT
//  User-uploaded hero images (heroPhotos in app state) take priority over
//  the web-resolved image. Provided via Context so HeroCard/HeroChip don't
//  need heroPhotos prop-drilled through every call site.
// ═══════════════════════════════════════════
const HeroPhotosContext = createContext({});

// ═══════════════════════════════════════════
//  HERO IMAGE RESOLVER
//  Fandom (arenaofvalor.fandom.com) uses hash-based image URLs that can't
//  be guessed from hero name. We resolve the real URL at runtime via the
//  MediaWiki API (action=query&prop=imageinfo), then cache the result so
//  each hero is only looked up once per session. Falls back to a letter
//  avatar if the API call fails (CORS, network, file not found, etc.)
//
//  IMPORTANT: Live Draft renders the full ~100-hero grid at once, which
//  would otherwise fire 100+ simultaneous fetches and likely get rate
//  limited / blocked. We queue all lookups and only run a few requests
//  concurrently, so every hero still resolves — just staggered.
// ═══════════════════════════════════════════
const HERO_IMG_CACHE = {}; // { heroName: url | null }  null = lookup failed, don't retry
const HERO_IMG_LISTENERS = {}; // { heroName: Set<setStateFn> }
const HERO_IMG_QUEUE = []; // pending heroNames waiting to be fetched
let HERO_IMG_INFLIGHT = 0;
const HERO_IMG_MAX_CONCURRENT = 4;

function queueHeroImageFetch(heroName) {
  if (HERO_IMG_CACHE[heroName] !== undefined) return; // already resolved or queued
  HERO_IMG_CACHE[heroName] = null; // mark as "pending" so we don't queue twice
  HERO_IMG_QUEUE.push(heroName);
  pumpHeroImageQueue();
}

function pumpHeroImageQueue() {
  while (HERO_IMG_INFLIGHT < HERO_IMG_MAX_CONCURRENT && HERO_IMG_QUEUE.length > 0) {
    const heroName = HERO_IMG_QUEUE.shift();
    HERO_IMG_INFLIGHT++;
    fetchHeroImage(heroName).finally(() => {
      HERO_IMG_INFLIGHT--;
      pumpHeroImageQueue();
    });
  }
}

async function fetchHeroImage(heroName) {
  // Build a few filename candidates to try in order (wiki naming isn't 100%
  // consistent for names with apostrophes/spaces, e.g. "Azzen'Ka", "D'Arcy")
  const candidates = [
    `${heroName}.png`,
    `${heroName}.jpg`,
    `${heroName.replace(/'/g,"")}.png`,
    `${heroName.replace(/\s+/g,"_")}.png`,
  ];

  for (const fileName of candidates) {
    try {
      const apiUrl = `https://arenaofvalor.fandom.com/api.php?action=query&format=json&prop=imageinfo&titles=${encodeURIComponent("File:"+fileName)}&iiprop=url&origin=*`;
      const res  = await fetch(apiUrl);
      const data = await res.json();
      const pages = data?.query?.pages;
      const page  = pages ? Object.values(pages)[0] : null;
      const url   = page?.imageinfo?.[0]?.url || null;
      if (url) {
        HERO_IMG_CACHE[heroName] = url;
        (HERO_IMG_LISTENERS[heroName]||[]).forEach(fn=>fn(url));
        return;
      }
    } catch {
      // try next candidate
    }
  }
  // all candidates failed
  HERO_IMG_CACHE[heroName] = null;
  (HERO_IMG_LISTENERS[heroName]||[]).forEach(fn=>fn(null));
}

// Hook: returns resolved image URL for a hero (or null while loading/failed)
function useHeroImage(hero) {
  const name = hero?.name;
  const heroPhotos = useContext(HeroPhotosContext);
  const uploadedUrl = name ? heroPhotos[name] : null;
  const [webUrl, setWebUrl] = useState(()=> name ? HERO_IMG_CACHE[name] : null);

  useEffect(() => {
    if (!name || uploadedUrl) return; // user-uploaded photo takes priority — skip web lookup entirely
    const cached = HERO_IMG_CACHE[name];
    if (cached) { setWebUrl(cached); return; } // already resolved to a real URL
    if (!HERO_IMG_LISTENERS[name]) HERO_IMG_LISTENERS[name] = new Set();
    HERO_IMG_LISTENERS[name].add(setWebUrl);
    queueHeroImageFetch(name);
    return () => { HERO_IMG_LISTENERS[name]?.delete(setWebUrl); };
  }, [name, uploadedUrl]);

  return uploadedUrl || webUrl;
}

// ═══════════════════════════════════════════
//  SMALL SHARED COMPONENTS
// ═══════════════════════════════════════════
function HeroCard({hero, size=72, banned=false, showName=true}) {
  const [err,setErr] = useState(false);
  const col = ROLE_COLOR[hero?.role]||"#a29bfe";
  const imgUrl = useHeroImage(hero);
  return (
    <div style={{position:"relative",width:size,height:size,borderRadius:8,overflow:"hidden",
      background:col+"22",border:`1.5px solid ${col}44`,flexShrink:0}}>
      {imgUrl && !err
        ? <img src={imgUrl}
            onError={()=>setErr(true)} alt={hero.name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:size*0.38,fontWeight:900,color:col}}>{hero.name.charAt(0)}</span>
          </div>
      }
      <div style={{position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:col}}/>
      {showName && <div style={{position:"absolute",bottom:0,left:0,right:0,
        background:"linear-gradient(transparent,rgba(0,0,0,0.88))",padding:"10px 3px 3px",textAlign:"center"}}>
        <div style={{fontSize:Math.max(8,size*0.135),color:"#fff",fontWeight:700,lineHeight:1.1,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hero.name}</div>
      </div>}
      {banned && <div style={{position:"absolute",inset:0,background:"rgba(255,71,87,0.65)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size*0.45,fontWeight:900,color:"#fff"}}>✕</span>
      </div>}
    </div>
  );
}

// ── HeroChip: lookup hero by name string, show small image + name inline ──
// Used anywhere a hero name list/badge is rendered (Hero Pool, Synergy/Counter, etc.)
function HeroChip({ name, size=24, accentCol, textCol, bold=true, fontSize=13 }) {
  const [err, setErr] = useState(false);
  const hero  = HERO_DATA.find(h=>h.name===name);
  const col   = accentCol || ROLE_COLOR[hero?.role] || C.primaryLight;
  const imgUrl = useHeroImage(hero);
  return (
    <div style={{display:"inline-flex",alignItems:"center",gap:6,minWidth:0}}>
      <div style={{position:"relative",width:size,height:size,borderRadius:6,overflow:"hidden",
        background:col+"22",border:`1.5px solid ${col}44`,flexShrink:0}}>
        {hero && imgUrl && !err ? (
          <img src={imgUrl}
            onError={()=>setErr(true)} alt={name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:size*0.42,fontWeight:900,color:col}}>{(name||"?").charAt(0)}</span>
          </div>
        )}
      </div>
      <span style={{fontWeight:bold?700:400,fontSize,color:textCol||"inherit",
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PLAYER AVATAR + PHOTO PICKER
// ═══════════════════════════════════════════
function PlayerAvatar({ name, photoUrl, size=44, team="our", style={} }) {
  const [err, setErr] = useState(false);
  const col = team==="our" ? C.primaryLight : C.lose;
  return (
    <div style={{position:"relative",width:size,height:size,borderRadius:"50%",
      overflow:"hidden",background:col+"22",border:`2px solid ${col}55`,
      flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",...style}}>
      {photoUrl && !err ? (
        <img src={photoUrl} onError={()=>setErr(true)} alt={name}
          style={{width:"100%",height:"100%",objectFit:"cover"}}/>
      ) : (
        <span style={{fontSize:size*0.38,fontWeight:800,color:col}}>
          {(name||"?").charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function PhotoPicker({ value, onChange, size=72, team="our" }) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlVal, setUrlVal] = useState(value && value.startsWith("http") ? value : "");
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5*1024*1024) {
      alert("ไฟล์รูปใหญ่เกินไป (จำกัด 1.5MB) — กรุณาเลือกรูปที่เล็กกว่านี้");
      e.target.value=""; return;
    }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
      <div style={{position:"relative"}}>
        <PlayerAvatar name="?" photoUrl={value} size={size} team={team}/>
        {value && (
          <button onClick={()=>{onChange(null);setUrlVal("");}}
            style={{position:"absolute",top:-4,right:-4,width:20,height:20,borderRadius:"50%",
              background:C.lose,border:"none",color:"#fff",cursor:"pointer",fontSize:11,
              display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>
            ✕
          </button>
        )}
      </div>
      <div style={{display:"flex",gap:5}}>
        <label style={{background:C.primary+"20",border:`1px solid ${C.primary}50`,
          color:C.primaryLight,borderRadius:6,padding:"3px 9px",cursor:"pointer",
          fontSize:10,fontWeight:700}}>
          📂 อัพโหลด
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
        <button onClick={()=>setShowUrlInput(v=>!v)}
          style={{background:showUrlInput?C.primary+"30":"transparent",
            border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:6,
            padding:"3px 9px",cursor:"pointer",fontSize:10,fontWeight:700}}>
          🔗 URL
        </button>
      </div>
      {showUrlInput && (
        <div style={{display:"flex",gap:4,width:"100%"}}>
          <input value={urlVal} onChange={e=>setUrlVal(e.target.value)}
            placeholder="https://..." style={{...iStyle,padding:"4px 8px",fontSize:10,flex:1}}/>
          <button onClick={()=>{if(urlVal.trim())onChange(urlVal.trim());}}
            style={{background:C.primary,color:"#fff",border:"none",borderRadius:6,
              padding:"0 10px",cursor:"pointer",fontSize:10,fontWeight:700}}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  UNIFIED STATS EDITOR — ทีมเรา + คู่แข่ง ในตารางเดียว
//  ✅ แก้ใหม่: ใช้ slot index เป็น key แทนชื่อผู้เล่น
//     เพื่อให้บันทึก stats ได้แม้ไม่ได้กรอกชื่อ
// ═══════════════════════════════════════════
function UnifiedStatsEditor({ ourPicks, enemyPicks, gameStats, onChangeStats }) {
  // gameStats = { our: { 0:{k,d,a,dmg,gold}, 1:... }, enemy: { 0:..., } }
  const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
  const labels = ["K","D","A","Dmg","DmgTaken","Gold"];

  function getVal(side, idx, field) {
    return (gameStats?.[side]?.[idx]?.[field]) ?? "";
  }
  function setVal(side, idx, field, val) {
    const next = {
      our:   { ...(gameStats?.our || {}) },
      enemy: { ...(gameStats?.enemy || {}) },
    };
    next[side] = {
      ...next[side],
      [idx]: { ...(next[side][idx] || {}), [field]: val === "" ? undefined : Number(val) },
    };
    onChangeStats(next);
  }

  const sections = [
    { label:"🛡️ ทีมเรา", side:"our",   picks: ourPicks,   col: C.win  },
    { label:"⚔️ คู่แข่ง", side:"enemy", picks: enemyPicks, col: C.lose },
  ];

  const anyPick = [...(ourPicks||[]), ...(enemyPicks||[])].some(s=>s?.hero||s?.player);
  if (!anyPick) return (
    <div style={{textAlign:"center",padding:"20px 0",color:C.textMuted,fontSize:12}}>
      ยังไม่มี Pick ในเกมนี้
    </div>
  );

  return (
    <div style={{background:"#080614",borderRadius:10,overflow:"hidden",border:`1px solid ${C.border}`}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:460}}>
          <thead>
            <tr style={{background:"#0f0c22"}}>
              <th style={{textAlign:"left",padding:"8px 10px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>
                ผู้เล่น / Hero
              </th>
              {labels.map(h=>(
                <th key={h} style={{textAlign:"center",padding:"8px 4px",fontWeight:700,fontSize:10,color:C.textMuted,whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map(({ label, side, picks, col }) => {
              const validPicks = (picks||[]).filter(s => s?.hero || s?.player);
              if (!validPicks.length) return null;
              return [
                <tr key={`hdr-${side}`}>
                  <td colSpan={6} style={{padding:"6px 10px",
                    background: col + "12",
                    fontSize:10, fontWeight:800, color:col, letterSpacing:1}}>
                    {label}
                  </td>
                </tr>,
                ...(picks||[]).map((slot, idx) => {
                  if (!slot?.hero && !slot?.player) return null;
                  return (
                    <tr key={`${side}-${idx}`} style={{borderTop:`1px solid ${C.border}`}}>
                      <td style={{padding:"5px 10px",minWidth:130}}>
                        <div style={{fontSize:11,fontWeight:700,color:col,lineHeight:1.2}}>
                          {slot.player || <span style={{color:C.textMuted,fontStyle:"italic",fontWeight:400}}>ไม่ระบุชื่อ</span>}
                        </div>
                        <div style={{fontSize:9,color:C.textMuted}}>{slot.hero?.name || "—"}</div>
                      </td>
                      {fields.map(field => (
                        <td key={field} style={{padding:"4px 3px",textAlign:"center"}}>
                          <input
                            type="number" min="0"
                            value={getVal(side, idx, field)}
                            onChange={e => setVal(side, idx, field, e.target.value)}
                            placeholder="0"
                            style={{width:52,background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:5,padding:"2px 5px",
                              fontSize:11,textAlign:"center",outline:"none"}}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                }).filter(Boolean),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SINGLE GAME DETAIL (Match Log)
// ═══════════════════════════════════════════
function SingleGameDetail({ g, gameNo, onUpdateStats, playerPhotos={}, rivalName }) {
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(g.gameStats || { our:{}, enemy:{} });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onUpdateStats && onUpdateStats(gameNo - 1, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
      border:`1px solid ${g.result==="WIN"?C.win+"30":C.lose+"30"}`}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>Game {gameNo}</span>
        <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
          background:g.result==="WIN"?C.win+"20":C.lose+"20",
          color:g.result==="WIN"?C.win:C.lose}}>{g.result}</span>
        {g.ourSide && (
          <span style={{fontSize:10,padding:"1px 8px",borderRadius:99,fontWeight:700,
            background:g.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:g.ourSide==="blue"?C.blue:C.red}}>
            {g.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <span style={{fontSize:12,color:C.textMuted,marginLeft:"auto"}}>
          <span style={{color:C.win,fontWeight:700}}>{g.ourScore||0}</span>
          <span style={{color:C.textMuted}}> : </span>
          <span style={{color:C.lose,fontWeight:700}}>{g.enemyScore||0}</span>
          <span style={{color:C.textMuted,fontSize:11}}> kills</span>
          <span style={{marginLeft:8,color:C.textMuted}}>{g.duration||0} นาที</span>
        </span>
      </div>

      {/* Bans */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🚫 เราแบน",     bans:g.ourBans},
          {label:"🚫 คู่แข่งแบน", bans:g.enemyBans},
        ].map(({label,bans})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5}}>{label}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {(bans||[]).filter(Boolean).map((h,i)=>(
                <span key={i} style={{background:C.ban+"20",color:C.ban,fontSize:10,padding:"2px 7px",borderRadius:99}}>
                  {h.name||h}
                </span>
              ))}
              {!(bans||[]).filter(Boolean).length && <span style={{fontSize:10,color:"#3a3a5c"}}>-</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Picks */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[
          {label:"🛡️ ทีมเรา",    picks:g.ourPicks,   col:C.win},
          {label:"⚔️ คู่แข่ง",   picks:g.enemyPicks, col:C.lose},
        ].map(({label,picks,col})=>(
          <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            {(picks||[]).filter(s=>s.hero).map((s,i)=>{
              const isEnemySide = label.includes("คู่แข่ง");
              const photoKey = s.player
                ? (isEnemySide ? `enemy:${rivalName}:${s.player}` : `our:${s.player}`)
                : null;
              return (
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                  {s.player && (
                    <PlayerAvatar name={s.player} photoUrl={playerPhotos[photoKey]} size={18}
                      team={isEnemySide?"enemy":"our"}/>
                  )}
                  <span style={{fontSize:9,color:ROLE_COLOR[s.role]||C.primaryLight,width:46}}>{s.role}</span>
                  <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                  {s.player && <span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {g.note && (
        <div style={{background:C.primary+"15",borderRadius:7,padding:"7px 10px",
          fontSize:12,color:C.primaryLight,marginBottom:8}}>📝 {g.note}</div>
      )}

      {/* Stats toggle */}
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"30":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
          {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
        </button>
        {showStats && (
          <button onClick={handleSave} style={{
            background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
            borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
            {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
          </button>
        )}
      </div>

      {showStats && (
        <div style={{marginTop:8}}>
          <UnifiedStatsEditor
            ourPicks={g.ourPicks}
            enemyPicks={g.enemyPicks}
            gameStats={gameStats}
            onChangeStats={setGameStats}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MATCH CARD (Match Log page)
// ═══════════════════════════════════════════
function MatchCardWithStats({ m, onUpdateStats, playerPhotos={} }) {
  const [open, setOpen] = useState(false);
  const isBO  = Array.isArray(m.games) && m.games.length > 0;
  const wins  = isBO ? m.games.filter(g=>g.result==="WIN").length : (m.result==="WIN"?1:0);
  const total = isBO ? m.games.length : 1;
  const bc    = wins > total/2 ? C.win : wins === total/2 ? "#fdcb6e" : C.lose;

  // single-game stats
  const [showStats, setShowStats] = useState(false);
  const [gameStats, setGameStats] = useState(m.gameStats || { our:{}, enemy:{} });
  const [saved,     setSaved]     = useState(false);

  function handleSingleSave() {
    onUpdateStats && onUpdateStats(m.id, null, gameStats);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${bc}40`,borderRadius:14,
      marginBottom:12,overflow:"hidden",borderLeft:`4px solid ${bc}`}}>
      {/* Header row */}
      <div onClick={()=>setOpen(v=>!v)} style={{padding:"14px 20px",cursor:"pointer",
        display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        {isBO
          ? <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:C.primary+"20",color:C.primaryLight}}>{m.boType||"BO?"}</span>
          : <span style={{padding:"3px 12px",borderRadius:99,fontSize:12,fontWeight:800,
              background:bc+"20",color:bc}}>{m.result}</span>
        }
        <span style={{fontWeight:800,fontSize:16,color:C.primaryLight}}>vs {m.rivalName}</span>
        <span style={{fontSize:13,color:C.textMuted}}>{m.date}</span>
        {isBO && (
          <div style={{display:"flex",gap:5}}>
            {m.games.map((g,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",fontSize:10,fontWeight:800,
                background:g.result==="WIN"?C.win+"30":C.lose+"30",
                color:g.result==="WIN"?C.win:C.lose}}>
                {g.result==="WIN"?"W":"L"}
              </div>
            ))}
          </div>
        )}
        {!isBO && m.ourSide && (
          <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:99,
            background:m.ourSide==="blue"?C.blue+"20":C.red+"20",
            color:m.ourSide==="blue"?C.blue:C.red}}>
            {m.ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
          </span>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {!isBO && (
            <span style={{fontSize:13}}>
              <span style={{color:C.win,fontWeight:700}}>{m.ourScore}</span>
              <span style={{color:C.textMuted}}> : </span>
              <span style={{color:C.lose,fontWeight:700}}>{m.enemyScore}</span>
              <span style={{color:C.textMuted,fontSize:11}}> kills</span>
            </span>
          )}
          {isBO && <span style={{fontSize:12,color:bc,fontWeight:700}}>{wins}W – {total-wins}L</span>}
          <span style={{color:C.textMuted,fontSize:14}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{padding:"0 16px 16px"}}>
          {isBO ? (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {m.games.map((g,i)=>(
                <SingleGameDetail
                  key={i} g={g} gameNo={i+1}
                  onUpdateStats={(gameIdx, gs) => onUpdateStats(m.id, gameIdx, gs)}
                  playerPhotos={playerPhotos} rivalName={m.rivalName}
                />
              ))}
            </div>
          ) : (
            <div>
              {/* Bans */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🚫 เราแบน",     bans:m.ourBans},
                  {label:"🚫 คู่แข่งแบน", bans:m.enemyBans},
                ].map(({label,bans})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:11,color:C.ban,fontWeight:700,marginBottom:8}}>{label}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(bans||[]).filter(Boolean).map((h,i)=>(
                        <span key={i} style={{background:C.ban+"20",color:C.ban,fontSize:12,padding:"3px 10px",borderRadius:99}}>
                          {h.name||h}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Picks */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                {[
                  {label:"🛡️ ทีมเรา",  picks:m.ourPicks,   col:C.win},
                  {label:"⚔️ คู่แข่ง", picks:m.enemyPicks, col:C.lose},
                ].map(({label,picks,col})=>(
                  <div key={label} style={{background:C.bgCard,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:12,color:col,fontWeight:700,marginBottom:10}}>{label}</div>
                    {(picks||[]).map((slot,i)=>{
                      const isEnemySide = label.includes("คู่แข่ง");
                      const photoKey = slot.player
                        ? (isEnemySide ? `enemy:${m.rivalName}:${slot.player}` : `our:${slot.player}`)
                        : null;
                      return (
                        <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                          {slot.player && (
                            <PlayerAvatar name={slot.player} photoUrl={playerPhotos[photoKey]} size={22}
                              team={isEnemySide?"enemy":"our"}/>
                          )}
                          <span style={{fontSize:11,color:C.primaryLight,width:55}}>{slot.role||ROLES_PICK[i]}</span>
                          <span style={{fontSize:13,fontWeight:700,flex:1}}>{slot.hero?.name||slot.hero||"-"}</span>
                          {slot.player && <span style={{fontSize:11,color:C.textMuted}}>{slot.player}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {m.note && (
                <div style={{background:C.primary+"15",border:`1px solid ${C.primary}40`,
                  borderRadius:8,padding:"10px 14px",fontSize:13,color:C.primaryLight,marginBottom:12}}>
                  📝 {m.note}
                </div>
              )}

              {/* Stats รวม */}
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button onClick={()=>setShowStats(v=>!v)} style={{
                  background:showStats?C.primary+"30":"transparent",
                  border:`1px solid ${showStats?C.primary:C.border}`,
                  color:showStats?C.primaryLight:C.textMuted,
                  borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {showStats?"▲ ซ่อน Stats":"📊 Stats ทั้งทีม"}
                </button>
                {showStats && (
                  <button onClick={handleSingleSave} style={{
                    background:saved?C.win+"30":C.primary,color:"#fff",border:"none",
                    borderRadius:7,padding:"4px 14px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                    {saved?"✅ บันทึกแล้ว!":"💾 บันทึก Stats"}
                  </button>
                )}
              </div>
              {showStats && (
                <UnifiedStatsEditor
                  ourPicks={m.ourPicks}
                  enemyPicks={m.enemyPicks}
                  gameStats={gameStats}
                  onChangeStats={setGameStats}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  PHASE TRACKER
// ═══════════════════════════════════════════
function PhaseTracker({ step }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",gap:3,marginBottom:4}}>
        {PHASE_SEGS.map(seg=>{
          const done   = step > seg.end;
          const active = step >= seg.start && step <= seg.end;
          return (
            <div key={seg.label} style={{flex:seg.flex,textAlign:"center",padding:"3px 4px",borderRadius:6,
              background:active?seg.color+"22":done?seg.color+"10":"#14112a",
              border:`1px solid ${active?seg.color:done?seg.color+"30":C.border}`}}>
              <div style={{fontSize:9,fontWeight:800,color:active?seg.color:done?seg.color+"60":"#3a3a5c"}}>{seg.label}</div>
              {active && <div style={{fontSize:8,color:seg.color+"cc"}}>{step-seg.start+1}/{seg.end-seg.start+1}</div>}
              {done   && <div style={{fontSize:8,color:seg.color+"50"}}>✓</div>}
            </div>
          );
        })}
      </div>
      <div style={{height:2,background:C.border,borderRadius:99}}>
        <div style={{height:2,borderRadius:99,width:`${(step/18)*100}%`,
          background:"linear-gradient(90deg,#ff4757,#6C5CE7,#00cec9)",transition:"width .3s"}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PLAYER PROFILE — ✅ อ่าน stats จาก gameStats ใหม่
// ═══════════════════════════════════════════
function PlayerProfile({ player, isEnemy, allGames, onBack, photoUrl }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px"} };
  const accentCol = isEnemy ? C.lose : C.win;

  const picksKey  = isEnemy ? "enemyPicks"      : "ourPicks";
  const sideKey   = isEnemy ? "enemy"            : "our";
  const resultWin = isEnemy ? "LOSE"             : "WIN";

  // หา index ของผู้เล่นในแต่ละเกม เพื่อ map กับ gameStats[sideKey][idx]
  const pGames = allGames.filter(g => (g[picksKey]||[]).some(s=>s.player===player));
  const pWins  = pGames.filter(g=>g.result===resultWin).length;
  const pWR    = pGames.length ? Math.round(pWins/pGames.length*100) : 0;

  // รวม stats ต่อ hero
  const heroSt = {};
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,totGold=0,totDur=0,statG=0;

  pGames.forEach(g=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    if (slotIdx < 0) return;
    const slot = picks[slotIdx];
    if (!slot?.hero) return;
    const hName = slot.hero.name;
    if (!heroSt[hName]) heroSt[hName] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
    heroSt[hName].picks++;
    if (g.result===resultWin) heroSt[hName].wins++;

    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    if (gs && gs.kills !== undefined) {
      heroSt[hName].k   += Number(gs.kills||0);
      heroSt[hName].d   += Number(gs.deaths||0);
      heroSt[hName].a   += Number(gs.assists||0);
      heroSt[hName].dmg += Number(gs.damage||0);
      heroSt[hName].dtk += Number(gs.damageTaken||0);
      heroSt[hName].gold+= Number(gs.gold||0);
      heroSt[hName].dur += Number(g.duration||0);
      heroSt[hName].cnt++;
      totK+=Number(gs.kills||0);totD+=Number(gs.deaths||0);totA+=Number(gs.assists||0);
      totDmg+=Number(gs.damage||0);totDtk+=Number(gs.damageTaken||0);
      totGold+=Number(gs.gold||0);
      totDur+=Number(g.duration||0);statG++;
    }
  });

  const heroArr = Object.entries(heroSt).map(([h,s])=>({
    hero:h, picks:s.picks,
    wr:Math.round(s.wins/s.picks*100),
    kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)/s.cnt).toFixed(2) : "-",
    avgK:  s.cnt ? (s.k/s.cnt).toFixed(1) : "-",
    avgD:  s.cnt ? (s.d/s.cnt).toFixed(1) : "-",
    avgA:  s.cnt ? (s.a/s.cnt).toFixed(1) : "-",
    avgDmg:s.cnt ? Math.round(s.dmg/s.cnt) : null,
    avgDtk:s.cnt ? Math.round(s.dtk/s.cnt) : null,
    goldPerMin: s.cnt&&s.dur ? Math.round(s.gold/s.dur) : null,
  })).sort((a,b)=>b.picks-a.picks);

  const avgKDAval  = statG ? ((totK+totA)/Math.max(totD,1)).toFixed(2) : "-";
  const avgDmg     = statG ? Math.round(totDmg/statG) : null;
  const avgDtk     = statG ? Math.round(totDtk/statG) : null;
  const goldPerMin = statG&&totDur ? Math.round(totGold/totDur) : null;
  const avgK = statG ? (totK/statG).toFixed(1) : "-";
  const avgD = statG ? (totD/statG).toFixed(1) : "-";
  const avgA = statG ? (totA/statG).toFixed(1) : "-";

  const chartGames = pGames.slice(-10);
  const chartData  = chartGames.map((g,i)=>{
    const picks = g[picksKey] || [];
    const slotIdx = picks.findIndex(s=>s.player===player);
    const slot = picks[slotIdx];
    const gs = g.gameStats?.[sideKey]?.[slotIdx];
    return {
      idx:i+1, win:g.result===resultWin,
      hero:slot?.hero?.name||"?",
      kda: gs?.kills!==undefined
        ? ((Number(gs.kills)+Number(gs.assists||0))/Math.max(Number(gs.deaths)||1,1)).toFixed(1)
        : null,
    };
  });

  return (
    <div>
      <button onClick={onBack} style={{background:"transparent",border:"none",
        color:C.textMuted,cursor:"pointer",fontSize:14,marginBottom:18,padding:0}}>
        ← กลับ Roster
      </button>
      <div style={{display:"flex",alignItems:"center",gap:18,marginBottom:20}}>
        <PlayerAvatar name={player} photoUrl={photoUrl} size={64} team={isEnemy?"enemy":"our"}
          style={{borderRadius:16,fontSize:26}}/>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <h2 style={{margin:0,fontSize:26,fontWeight:900}}>{player}</h2>
            <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
              background:isEnemy?C.lose+"20":C.win+"20",color:isEnemy?C.lose:C.win,
              border:`1px solid ${isEnemy?C.lose+"50":C.win+"50"}`}}>
              {isEnemy?"⚔️ คู่แข่ง":"🛡️ ทีมเรา"}
            </span>
          </div>
          <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>{pGames.length} เกมที่บันทึก</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {[
          {icon:"🎮",label:"Games",    val:pGames.length,       col:C.primaryLight},
          {icon:"🏆",label:"Win Rate", val:`${pWR}%`,           col:pWR>=50?accentCol:C.lose},
          {icon:"✅",label:"Wins",     val:pWins,               col:accentCol},
          {icon:"❌",label:"Losses",   val:pGames.length-pWins, col:C.lose},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center"}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{c.icon} {c.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:c.col}}>{c.val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10,marginBottom:16}}>
        {[
          {label:"Avg K",      val:avgK,                                col:"#00cec9"},
          {label:"Avg D",      val:avgD,                                col:C.lose},
          {label:"Avg A",      val:avgA,                                col:"#a29bfe"},
          {label:"KDA",        val:avgKDAval,                           col:"#fdcb6e"},
          {label:"Avg Dmg",    val:avgDmg?avgDmg.toLocaleString():"-",  col:"#e17055"},
          {label:"Avg DmgTkn", val:avgDtk?avgDtk.toLocaleString():"-",  col:"#fd79a8"},
          {label:"Gold/Min",   val:goldPerMin?goldPerMin.toLocaleString():"-", col:"#feca57"},
        ].map(c=>(
          <div key={c.label} style={{...SC.card,textAlign:"center",padding:"10px 8px"}}>
            <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
            <div style={{fontSize:16,fontWeight:800,color:statG>0?c.col:C.textMuted+"60"}}>{c.val}</div>
          </div>
        ))}
      </div>

      {statG===0 && pGames.length>0 && (
        <div style={{padding:"10px 14px",background:C.bgCard,borderRadius:8,marginBottom:16,
          fontSize:12,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
          💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
        </div>
      )}

      {pGames.length>0&&(
        <div style={{...SC.card,marginBottom:16}}>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>
            Win/Loss ({pWins}W — {pGames.length-pWins}L)
          </div>
          <div style={{display:"flex",height:14,borderRadius:99,overflow:"hidden",gap:1}}>
            {pWins>0&&<div style={{flex:pWins,background:`linear-gradient(90deg,${accentCol},#00b894)`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {pWR}%
            </div>}
            {pGames.length-pWins>0&&<div style={{flex:pGames.length-pWins,background:C.lose,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>
              {100-pWR}%
            </div>}
          </div>
        </div>
      )}

      <div style={{...SC.card,marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>📈 ผล 10 เกมล่าสุด</div>
        {chartData.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{display:"flex",gap:4,alignItems:"flex-end",height:100}}>
            {chartData.map((d,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                {d.kda&&<div style={{fontSize:8,color:"#fdcb6e",fontWeight:700,marginBottom:1}}>{d.kda}</div>}
                <div style={{width:"100%",flex:1,borderRadius:"6px 6px 0 0",minHeight:40,
                  background:d.win
                    ?`linear-gradient(180deg,${accentCol},#00b894)`
                    :`linear-gradient(180deg,${C.lose},#e84393)`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,fontWeight:900,color:"#fff"}}>
                  {d.win?"W":"L"}
                </div>
                <div style={{fontSize:8,color:C.textMuted,textAlign:"center",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%"}}>
                  {d.hero}
                </div>
              </div>
            ))}
          </div>
        }
      </div>

      <div style={{...SC.card}}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>🦸 Hero Stats</div>
        {heroArr.length===0
          ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","K","D","A","KDA","Avg Dmg","Avg DmgTkn","Gold/Min"].map(h=>(
                    <th key={h} style={{padding:"8px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"8px 8px",whiteSpace:"nowrap"}}><HeroChip name={s.hero} size={26}/></td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"8px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"2px 8px",borderRadius:6,fontWeight:700,fontSize:11,
                        background:s.wr>=50?accentCol+"20":C.lose+"20",color:s.wr>=50?accentCol:C.lose}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:C.textMuted,fontSize:12}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#fd79a8",fontSize:12}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"8px 8px",textAlign:"center",color:"#feca57",fontSize:12}}>
                      {s.goldPerMin?s.goldPerMin.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  RIVAL STATS SECTION (Rivals > Overview)
// ═══════════════════════════════════════════
function RivalStatsSection({ selRival, rGames, enemyRosters }) {
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"} };
  const enemyRoster = enemyRosters[selRival] || [];

  // ── คำนวณ stats ผู้เล่นคู่แข่ง ──
  const playerStats = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const name = slot.player;
      if (!name) return;
      if (!playerStats[name]) playerStats[name] = {games:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0,heroes:{}};
      const ps = playerStats[name];
      ps.games++;
      if (g.result === "LOSE") ps.wins++;
      if (slot.hero?.name) ps.heroes[slot.hero.name] = (ps.heroes[slot.hero.name]||0)+1;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        ps.k   += Number(gs.kills||0);
        ps.d   += Number(gs.deaths||0);
        ps.a   += Number(gs.assists||0);
        ps.dmg += Number(gs.damage||0);
        ps.dtk += Number(gs.damageTaken||0);
        ps.gold+= Number(gs.gold||0);
        ps.dur += Number(g.duration||0);
        ps.cnt++;
      }
    });
  });

  // ── คำนวณ KDA ต่อ Hero คู่แข่ง ──
  const heroKDA = {};
  rGames.forEach(g => {
    (g.enemyPicks||[]).forEach((slot, idx) => {
      const h = slot.hero?.name;
      if (!h) return;
      if (!heroKDA[h]) heroKDA[h] = {picks:0,wins:0,k:0,d:0,a:0,dmg:0,dtk:0,gold:0,dur:0,cnt:0};
      const hd = heroKDA[h];
      hd.picks++;
      if (g.result==="LOSE") hd.wins++;
      const gs = g.gameStats?.enemy?.[idx];
      if (gs?.kills !== undefined) {
        hd.k   += Number(gs.kills||0);
        hd.d   += Number(gs.deaths||0);
        hd.a   += Number(gs.assists||0);
        hd.dmg += Number(gs.damage||0);
        hd.dtk += Number(gs.damageTaken||0);
        hd.gold+= Number(gs.gold||0);
        hd.dur += Number(g.duration||0);
        hd.cnt++;
      }
    });
  });
  const heroArr = Object.entries(heroKDA)
    .map(([h,s]) => ({
      hero:h, picks:s.picks,
      wr: Math.round(s.wins/s.picks*100),
      kda: s.cnt ? ((s.k+s.a)/Math.max(s.d,1)/s.cnt).toFixed(2) : "-",
      avgK:  s.cnt?(s.k/s.cnt).toFixed(1):"-",
      avgD:  s.cnt?(s.d/s.cnt).toFixed(1):"-",
      avgA:  s.cnt?(s.a/s.cnt).toFixed(1):"-",
      avgDmg:s.cnt?Math.round(s.dmg/s.cnt):null,
      avgDtk:s.cnt?Math.round(s.dtk/s.cnt):null,
      gpm:   s.cnt&&s.dur?Math.round(s.gold/s.dur):null,
    }))
    .sort((a,b)=>b.picks-a.picks);

  const playerArr = Object.entries(playerStats)
    .map(([name,ps]) => ({
      name,
      games:ps.games, wins:ps.wins,
      wr: ps.games?Math.round(ps.wins/ps.games*100):0,
      kda: ps.cnt ? ((ps.k+ps.a)/Math.max(ps.d,1)/ps.cnt).toFixed(2):"-",
      avgK:  ps.cnt?(ps.k/ps.cnt).toFixed(1):"-",
      avgD:  ps.cnt?(ps.d/ps.cnt).toFixed(1):"-",
      avgA:  ps.cnt?(ps.a/ps.cnt).toFixed(1):"-",
      avgDmg:ps.cnt?Math.round(ps.dmg/ps.cnt):null,
      avgDtk:ps.cnt?Math.round(ps.dtk/ps.cnt):null,
      gpm:   ps.cnt&&ps.dur?Math.round(ps.gold/ps.dur):null,
      mainHero: Object.entries(ps.heroes).sort((a,b)=>b[1]-a[1])[0]?.[0]||"-",
      hasStats: ps.cnt>0,
    }))
    .sort((a,b)=>b.games-a.games);

  // ── กราฟเปรียบเทียบ ──
  // avg per game across all games that have stats
  function avgStat(side, field) {
    let total=0, cnt=0;
    rGames.forEach(g => {
      const picks = side==="our" ? (g.ourPicks||[]) : (g.enemyPicks||[]);
      picks.forEach((slot,idx)=>{
        const gs = g.gameStats?.[side]?.[idx];
        if (gs?.[field] !== undefined) { total+=Number(gs[field]||0); cnt++; }
      });
    });
    return cnt ? Math.round(total/cnt) : 0;
  }

  const compareData = [
    { label:"Avg Damage",    our: avgStat("our","damage"),      enemy: avgStat("enemy","damage"),      col:"#e17055" },
    { label:"Avg Dmg Taken", our: avgStat("our","damageTaken"), enemy: avgStat("enemy","damageTaken"), col:"#fd79a8" },
    { label:"Gold/min",      our: avgStat("our","gold"),        enemy: avgStat("enemy","gold"),        col:"#feca57" },
  ];
  const hasCompareData = compareData.some(d=>d.our>0||d.enemy>0);

  function Bar({val, maxVal, col, label}) {
    const pct = maxVal>0 ? Math.round(val/maxVal*100) : 0;
    return (
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <div style={{fontSize:9,color:C.textMuted,width:20,textAlign:"right"}}>{label}</div>
        <div style={{flex:1,height:14,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:99,
            display:"flex",alignItems:"center",paddingLeft:4,minWidth:pct>0?16:0,transition:"width .4s"}}>
            {pct>=10&&<span style={{fontSize:8,color:"#fff",fontWeight:700,whiteSpace:"nowrap"}}>
              {val.toLocaleString()}
            </span>}
          </div>
        </div>
        {pct<10&&<span style={{fontSize:9,color:col,fontWeight:700,minWidth:36}}>{val.toLocaleString()}</span>}
      </div>
    );
  }

  const hasPlayerStats = playerArr.some(p=>p.hasStats);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:4}}>

      {/* ── กราฟเปรียบเทียบ ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.primaryLight,marginBottom:14}}>
          📊 เปรียบเทียบ ทีมเรา vs {selRival}
        </div>
        {!hasCompareData ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มี Stats — กรอกข้อมูลใน Match Log ก่อนนะครับ
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {compareData.map(row => {
              const maxVal = Math.max(row.our, row.enemy, 1);
              return (
                <div key={row.label}>
                  <div style={{fontSize:10,color:row.col,fontWeight:700,marginBottom:6}}>{row.label}</div>
                  <Bar val={row.our}   maxVal={maxVal} col={C.win}  label="เรา"/>
                  <Bar val={row.enemy} maxVal={maxVal} col={C.lose} label="คู่แข่ง"/>
                  <div style={{display:"flex",gap:16,marginTop:4}}>
                    {row.our>0&&row.enemy>0&&(
                      <span style={{fontSize:10,color:row.our>=row.enemy?C.win:C.lose,fontWeight:700}}>
                        {row.our>=row.enemy
                          ? `🛡️ ทีมเรานำ +${(row.our-row.enemy).toLocaleString()}`
                          : `⚔️ คู่แข่งนำ +${(row.enemy-row.our).toLocaleString()}`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{display:"flex",gap:16,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.win}}/>
            <span style={{fontSize:10,color:C.win,fontWeight:700}}>🛡️ ทีมเรา</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:12,height:12,borderRadius:3,background:C.lose}}/>
            <span style={{fontSize:10,color:C.lose,fontWeight:700}}>⚔️ {selRival}</span>
          </div>
        </div>
      </div>

      {/* ── ตาราง Stats ผู้เล่นคู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          👤 Stats ผู้เล่น {selRival}
        </div>
        {playerArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>
            ยังไม่มีผู้เล่นที่ assign — เลือกชื่อผู้เล่นตอน Draft แล้วกรอก Stats ใน Match Log
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:640}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["ผู้เล่น","Main Hero","G","W%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn","GPM"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="ผู้เล่น"||h==="Main Hero"?"left":"center",
                      fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {playerArr.map((p,i)=>(
                  <tr key={p.name} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px",fontWeight:800,color:C.lose,fontSize:13}}>{p.name}</td>
                    <td style={{padding:"7px 8px"}}>
                      {p.mainHero!=="-" ? <HeroChip name={p.mainHero} size={22} fontSize={11} bold={false}/>
                        : <span style={{fontSize:11,color:C.textMuted}}>-</span>}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",fontWeight:700,color:C.primaryLight}}>{p.games}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:p.wr>=50?C.lose+"20":C.win+"20",
                        color:p.wr>=50?C.lose:C.win}}>{p.games?`${p.wr}%`:"-"}</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{p.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{p.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{p.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {p.avgDmg?p.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {p.avgDtk?p.avgDtk.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#feca57",fontSize:11}}>
                      {p.gpm?p.gpm.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!hasPlayerStats&&(
              <div style={{marginTop:10,padding:"8px 12px",background:C.primary+"10",borderRadius:7,
                fontSize:11,color:C.textMuted,borderLeft:`3px solid ${C.primary}`}}>
                💡 กรอก KDA/Damage/Gold ได้จากปุ่ม "📊 Stats ทั้งทีม" ใน Match Log
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── KDA ต่อ Hero คู่แข่ง ── */}
      <div style={SC.card}>
        <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:14}}>
          ⚔️ KDA ต่อ Hero ของ {selRival}
        </div>
        {heroArr.length===0 ? (
          <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"16px 0"}}>ยังไม่มีข้อมูล</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                  {["Hero","Picks","Win%","Avg K","Avg D","Avg A","KDA","Avg Dmg","Avg DmgTkn"].map(h=>(
                    <th key={h} style={{padding:"7px 8px",textAlign:h==="Hero"?"left":"center",fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heroArr.map((s,i)=>(
                  <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 8px"}}><HeroChip name={s.hero} size={24} accentCol={C.lose} fontSize={12}/></td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                    <td style={{padding:"7px 8px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                        background:s.wr>=50?C.lose+"20":C.win+"20",color:s.wr>=50?C.lose:C.win}}>{s.wr}%</span>
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#00cec9",fontWeight:700}}>{s.avgK}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:C.lose,fontWeight:700}}>{s.avgD}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#a29bfe",fontWeight:700}}>{s.avgA}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fdcb6e",fontWeight:700}}>{s.kda}</td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#e17055",fontSize:11}}>
                      {s.avgDmg?s.avgDmg.toLocaleString():"-"}
                    </td>
                    <td style={{padding:"7px 8px",textAlign:"center",color:"#fd79a8",fontSize:11}}>
                      {s.avgDtk?s.avgDtk.toLocaleString():"-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  CSV EXPORT UTIL
// ═══════════════════════════════════════════
function exportCSV(matches, allGames) {
  const rows = [];
  // header
  rows.push([
    "Date","Session","RivalName","BoType","GameNo",
    "Result","OurSide","OurScore","EnemyScore","Duration(min)",
    "Team","SlotIdx","Role","Hero","Player",
    "Kills","Deaths","Assists","Damage","DamageTaken","Gold","KDA"
  ].join(","));

  matches.forEach((m, si) => {
    const games = Array.isArray(m.games)&&m.games.length ? m.games : [m];
    games.forEach((g, gi) => {
      const gameNo = gi+1;
      // our picks
      (g.ourPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.our?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, `"${m.rivalName||""}"`, m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, g.duration||0,
          "เรา", idx, slot.role||"", `"${slot.hero?.name||""}"`, `"${slot.player||""}"`,
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
      // enemy picks
      (g.enemyPicks||[]).forEach((slot, idx) => {
        const gs = g.gameStats?.enemy?.[idx] || {};
        const k=Number(gs.kills||0), d=Number(gs.deaths||0), a=Number(gs.assists||0);
        const kda = (k+a)/Math.max(d,1);
        rows.push([
          m.date, si+1, `"${m.rivalName||""}"`, m.boType||"BO1", gameNo,
          g.result||"", g.ourSide||"", g.ourScore||0, g.enemyScore||0, g.duration||0,
          "คู่แข่ง", idx, slot.role||"", `"${slot.hero?.name||""}"`, `"${slot.player||""}"`,
          gs.kills??"-", gs.deaths??"-", gs.assists??"-",
          gs.damage??"-", gs.damageTaken??"-", gs.gold??"-",
          gs.kills!==undefined ? kda.toFixed(2) : "-"
        ].join(","));
      });
    });
  });

  const csv = "\uFEFF" + rows.join("\n"); // BOM for Excel Thai
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_stats_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export JSON backup ──
function exportJSON(appState) {
  const payload = {
    version: 7,
    exportedAt: new Date().toISOString(),
    matches:       appState.matches,
    rivals:        appState.rivals,
    roster:        appState.roster,
    enemyRosters:  appState.enemyRosters,
    scoutMatches:  appState.scoutMatches,
    playerPhotos:  appState.playerPhotos,
    heroPhotos:    appState.heroPhotos,
    customHeroes:  appState.customHeroes,
    roleOverrides: appState.roleOverrides,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `rov_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import JSON + merge (no overwrite by id) ──
function importJSON(file, currentState, onMerge) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      // dedup by id
      const mergeById = (existing, incoming) => {
        const ids = new Set(existing.map(x=>x.id));
        return [...existing, ...(incoming||[]).filter(x=>!ids.has(x.id))];
      };
      // roster: merge unique strings
      const mergeArr = (a, b) => [...new Set([...a, ...(b||[])])];
      // enemyRosters: merge per team
      const mergeRosters = (a, b) => {
        const result = {...a};
        Object.entries(b||{}).forEach(([team, players]) => {
          result[team] = mergeArr(result[team]||[], players);
        });
        return result;
      };
      // customHeroes: dedup by name (case-insensitive)
      const mergeCustomHeroes = (existing, incoming) => {
        const names = new Set(existing.map(h=>h.name.toLowerCase()));
        return [...existing, ...(incoming||[]).filter(h=>!names.has(h.name.toLowerCase()))];
      };

      const merged = {
        matches:       mergeById(currentState.matches,      data.matches),
        rivals:        mergeById(currentState.rivals,       data.rivals),
        roster:        mergeArr(currentState.roster,        data.roster),
        enemyRosters:  mergeRosters(currentState.enemyRosters, data.enemyRosters),
        scoutMatches:  mergeById(currentState.scoutMatches, data.scoutMatches),
        playerPhotos:  { ...currentState.playerPhotos,  ...(data.playerPhotos||{}) },
        heroPhotos:    { ...currentState.heroPhotos,    ...(data.heroPhotos||{}) },
        customHeroes:  mergeCustomHeroes(currentState.customHeroes, data.customHeroes),
        roleOverrides: { ...currentState.roleOverrides, ...(data.roleOverrides||{}) },
      };

      const added = {
        matches:      merged.matches.length      - currentState.matches.length,
        rivals:       merged.rivals.length       - currentState.rivals.length,
        scoutMatches: merged.scoutMatches.length - currentState.scoutMatches.length,
      };
      onMerge(merged, added);
    } catch {
      alert("❌ ไฟล์ไม่ถูกต้อง — กรุณาใช้ไฟล์ backup JSON ของแอปนี้เท่านั้น");
    }
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════
//  HERO SYNERGY / COUNTER MATRIX
// ═══════════════════════════════════════════
function HeroSynergyCounter({ allGames, scoutMatches }) {
  const [mode,       setMode]       = useState("synergy"); // "synergy" | "counter"
  const [dataSource, setDataSource] = useState("all");     // "all"|"our"|"enemy"|"scout"
  const [minGames,   setMinGames]   = useState(2);
  const [searchA,    setSearchA]    = useState("");
  const [searchB,    setSearchB]    = useState("");

  // ── build game samples ──
  // each sample: { heroA, heroB, win: bool }
  const samples = [];

  if (dataSource==="all" || dataSource==="our" || dataSource==="enemy") {
    allGames.forEach(g => {
      const ourWin = g.result==="WIN";
      if (mode==="synergy") {
        // same-team pairs
        if (dataSource!=="enemy") {
          const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<op.length;i++) for (let j=i+1;j<op.length;j++)
            samples.push({heroA:op[i], heroB:op[j], win:ourWin, src:"our"});
        }
        if (dataSource!=="our") {
          const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<ep.length;i++) for (let j=i+1;j<ep.length;j++)
            samples.push({heroA:ep[i], heroB:ep[j], win:!ourWin, src:"enemy"});
        }
      } else {
        // cross-team: our hero vs enemy hero
        const op = (g.ourPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        const ep = (g.enemyPicks||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
        if (dataSource!=="enemy") {
          op.forEach(ha => ep.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:ourWin, src:"our"})
          ));
        }
        if (dataSource!=="our") {
          ep.forEach(ha => op.forEach(hb =>
            samples.push({heroA:ha, heroB:hb, win:!ourWin, src:"enemy"})
          ));
        }
      }
    });
  }

  if (dataSource==="all" || dataSource==="scout") {
    scoutMatches.forEach(sm => {
      (sm.games||[]).forEach(g => {
        const aWin = g.teamAResult==="WIN";
        if (mode==="synergy") {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          for (let i=0;i<pa.length;i++) for (let j=i+1;j<pa.length;j++)
            samples.push({heroA:pa[i], heroB:pa[j], win:aWin, src:"scout"});
          for (let i=0;i<pb.length;i++) for (let j=i+1;j<pb.length;j++)
            samples.push({heroA:pb[i], heroB:pb[j], win:!aWin, src:"scout"});
        } else {
          const pa = (g.picksA||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          const pb = (g.picksB||[]).filter(s=>s.hero?.name).map(s=>s.hero.name);
          pa.forEach(ha => pb.forEach(hb => samples.push({heroA:ha, heroB:hb, win:aWin,  src:"scout"})));
          pb.forEach(ha => pa.forEach(hb => samples.push({heroA:ha, heroB:hb, win:!aWin, src:"scout"})));
        }
      });
    });
  }

  // ── aggregate ──
  const pairMap = {};
  samples.forEach(({heroA, heroB, win}) => {
    const key = [heroA, heroB].sort().join("|||");
    if (!pairMap[key]) pairMap[key] = {heroA, heroB, games:0, wins:0};
    pairMap[key].games++;
    if (win) pairMap[key].wins++;
  });

  const pairs = Object.values(pairMap)
    .filter(p => p.games >= minGames)
    .map(p => ({...p, wr: Math.round(p.wins/p.games*100)}))
    .sort((a,b) => b.wr===a.wr ? b.games-a.games : b.wr-a.wr);

  const filtered = pairs.filter(p => {
    const sa = searchA.toLowerCase(), sb = searchB.toLowerCase();
    const n1 = p.heroA.toLowerCase(), n2 = p.heroB.toLowerCase();
    const matchA = !sa || n1.includes(sa) || n2.includes(sa);
    const matchB = !sb || n1.includes(sb) || n2.includes(sb);
    return matchA && matchB;
  });

  const WRColor = wr => wr>=65?C.win : wr>=50?"#fdcb6e" : C.lose;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginTop:20}}>
      {/* header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🧬 Hero Synergy / Counter Matrix
        </h3>
        {/* mode toggle */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"synergy",label:"🤝 Synergy"},{id:"counter",label:"⚔️ Counter"}].map(m=>(
            <button key={m.id} onClick={()=>setMode(m.id)} style={{
              background:mode===m.id?C.primary:"transparent",
              border:"none",color:mode===m.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 14px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {m.label}
            </button>
          ))}
        </div>
        {/* data source */}
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"all",label:"ทั้งหมด"},{id:"our",label:"🛡️ ทีมเรา"},{id:"enemy",label:"⚔️ คู่แข่ง"},{id:"scout",label:"🔍 Scout"}].map(s=>(
            <button key={s.id} onClick={()=>setDataSource(s.id)} style={{
              background:dataSource===s.id?C.primary+"80":"transparent",
              border:"none",color:dataSource===s.id?C.primaryLight:C.textMuted,
              borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700,fontSize:11}}>
              {s.label}
            </button>
          ))}
        </div>
        {/* min games */}
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:10,color:C.textMuted}}>Min เกม</span>
          <select value={minGames} onChange={e=>setMinGames(Number(e.target.value))}
            style={{...iStyle,width:60,padding:"3px 6px",fontSize:11}}>
            {[1,2,3,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* mode description */}
      <div style={{fontSize:11,color:C.textMuted,marginBottom:12,padding:"6px 10px",
        background:C.bgCard,borderRadius:7,borderLeft:`3px solid ${C.primary}`}}>
        {mode==="synergy"
          ? "🤝 Synergy — Hero ที่อยู่ทีมเดียวกันแล้วชนะบ่อย (ข้อมูลจาก picks ฝั่งเดียวกัน)"
          : "⚔️ Counter — Hero A ข้ามทีม Hero B แล้วฝั่ง A ชนะบ่อย (ข้อมูลจาก picks ข้ามทีม)"}
      </div>

      {/* search filters */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <input value={searchA} onChange={e=>setSearchA(e.target.value)}
          placeholder="🔍 Hero A..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        <input value={searchB} onChange={e=>setSearchB(e.target.value)}
          placeholder="🔍 Hero B..."
          style={{...iStyle,flex:1,padding:"6px 10px",fontSize:12}}/>
        {(searchA||searchB)&&(
          <button onClick={()=>{setSearchA("");setSearchB("");}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"0 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
        )}
      </div>

      {/* results */}
      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"30px 20px",color:C.textMuted,fontSize:12}}>
          {samples.length===0
            ? `ยังไม่มีข้อมูลเพียงพอ — บันทึกแมตช์เพิ่มแล้วลองใหม่`
            : `ไม่พบ Hero pair ที่ตรงกับ filter (ลองลด Min เกม)`}
        </div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:480}}>
            <thead>
              <tr style={{background:"#0f0c22",borderBottom:`2px solid ${C.border}`}}>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700,width:60}}>WR%</th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"Hero คู่":"Hero A"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:C.textMuted,fontWeight:700}}>
                  {mode==="synergy"?"":"vs Hero B"}
                </th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>เกม</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>W</th>
                <th style={{padding:"8px 10px",textAlign:"center",fontSize:10,color:C.textMuted,fontWeight:700}}>L</th>
                <th style={{padding:"8px 10px",fontSize:10,color:C.textMuted,fontWeight:700,minWidth:100}}>WR Bar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0,50).map((p,i)=>{
                const col = WRColor(p.wr);
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${C.border}`,
                    background:i%2===0?"transparent":C.bgCard}}>
                    <td style={{padding:"7px 10px",textAlign:"center"}}>
                      <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,
                        fontWeight:800,fontSize:12,background:col+"22",color:col}}>
                        {p.wr}%
                      </span>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      <HeroChip name={p.heroA} size={26}/>
                    </td>
                    <td style={{padding:"7px 10px"}}>
                      {mode==="synergy" ? (
                        <HeroChip name={p.heroB} size={26}/>
                      ) : (
                        <HeroChip name={p.heroB} size={26} accentCol={C.lose} textCol={C.lose}/>
                      )}
                    </td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{p.games}</td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.win,fontWeight:700}}>{p.wins}</td>
                    <td style={{padding:"7px 10px",textAlign:"center",color:C.lose,fontWeight:700}}>{p.games-p.wins}</td>
                    <td style={{padding:"7px 10px"}}>
                      <div style={{height:8,background:C.bgBase,borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:`${p.wr}%`,height:"100%",background:col,borderRadius:99,transition:"width .3s"}}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length>50&&(
            <div style={{textAlign:"center",padding:"8px 0",fontSize:11,color:C.textMuted}}>
              แสดง 50 / {filtered.length} คู่ — ใช้ช่อง Search เพื่อ filter ให้แคบลง
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  SCOUT GAME FORM — บันทึก 1 เกม
// ═══════════════════════════════════════════
function ScoutGameForm({ gameNo, teamA, teamB, rivals, enemyRosters, onSave, onCancel }) {
  const initPicks = () => ROLES_PICK.map(r=>({role:r,hero:null,player:""}));
  const [picksA,    setPicksA]    = useState(initPicks);
  const [picksB,    setPicksB]    = useState(initPicks);
  // statsA/B: { [slotIdx]: { kills, deaths, assists, damage, damageTaken, gold } }
  const [statsA,    setStatsA]    = useState({});
  const [statsB,    setStatsB]    = useState({});
  const [result,    setResult]    = useState("A");
  const [killsA,    setKillsA]    = useState("");
  const [killsB,    setKillsB]    = useState("");
  const [duration,  setDuration]  = useState("");
  const [note,      setNote]      = useState("");
  const [tags,      setTags]      = useState([]);
  const [search,    setSearch]    = useState("");
  const [roleFilter,setRoleFilter]= useState("All");
  const [activeSlot,setActiveSlot]= useState({team:"A",idx:0});
  const [showStats, setShowStats] = useState(false);

  const usedHeroes = new Set([
    ...picksA.filter(p=>p.hero).map(p=>p.hero.name),
    ...picksB.filter(p=>p.hero).map(p=>p.hero.name),
  ]);

  const filtered = HERO_DATA.filter(h=>
    (roleFilter==="All"||h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  function pickHero(hero) {
    if (usedHeroes.has(hero.name)) return;
    const { team, idx } = activeSlot;
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero}; setPicksB(p); }
    if (team==="A") {
      const na=picksA.findIndex((s,i)=>i>idx&&!s.hero);
      if (na>=0) setActiveSlot({team:"A",idx:na});
      else { const nb=picksB.findIndex(s=>!s.hero); if(nb>=0) setActiveSlot({team:"B",idx:nb}); }
    } else {
      const nb2=picksB.findIndex((s,i)=>i>idx&&!s.hero);
      if (nb2>=0) setActiveSlot({team:"B",idx:nb2});
      else { const na2=picksA.findIndex(s=>!s.hero); if(na2>=0) setActiveSlot({team:"A",idx:na2}); }
    }
  }

  function clearPick(team, idx) {
    if (team==="A") { const p=[...picksA]; p[idx]={...p[idx],hero:null,player:""}; setPicksA(p); }
    else            { const p=[...picksB]; p[idx]={...p[idx],hero:null,player:""}; setPicksB(p); }
    setActiveSlot({team,idx});
  }

  function toggleTag(t) { setTags(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t]); }

  function setStatVal(side, idx, field, val) {
    const setter = side==="A" ? setStatsA : setStatsB;
    setter(prev=>({...prev,[idx]:{...(prev[idx]||{}),[field]:val===""?undefined:Number(val)}}));
  }

  function handleSave() {
    onSave({ gameNo, teamAResult:result==="A"?"WIN":"LOSE",
      picksA, picksB, statsA, statsB,
      killsA, killsB, duration, note, tags });
  }

  const rosterA = enemyRosters[teamA]||[];
  const rosterB = enemyRosters[teamB]||[];

  const renderPickColumn = (label, teamKey, picks, setpicks, roster, accentCol) => (
    <div style={{flex:1,background:"#0e0b1e",borderRadius:12,padding:"12px 10px"}}>
      <div style={{textAlign:"center",marginBottom:10}}>
        <span style={{fontWeight:900,fontSize:14,color:accentCol}}>{label}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {picks.map((slot,idx)=>{
          const isActive = activeSlot.team===teamKey && activeSlot.idx===idx;
          return (
            <div key={idx} onClick={()=>setActiveSlot({team:teamKey,idx})}
              style={{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",borderRadius:10,
                background:isActive?accentCol+"15":C.bgPanel,cursor:"pointer",
                border:`2px solid ${isActive?accentCol:C.border}`,
                boxShadow:isActive?`0 0 10px ${accentCol}40`:"none",
                transition:"all .15s",minHeight:52}}>
              {slot.hero ? (
                <>
                  <HeroCard hero={slot.hero} size={38} showName={false}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:800,lineHeight:1.2,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{slot.hero.name}</div>
                    <div style={{fontSize:9,color:ROLE_COLOR[slot.hero.role]}}>{slot.role}</div>
                    {roster.length>0&&(
                      <select value={slot.player||""} onClick={e=>e.stopPropagation()}
                        onChange={e=>{const p=[...picks];p[idx]={...p[idx],player:e.target.value};setpicks(p);}}
                        style={{width:"100%",background:"#0a0816",border:`1px solid ${C.border}`,
                          color:slot.player?accentCol:C.textMuted,borderRadius:4,
                          padding:"1px 4px",fontSize:10,outline:"none",marginTop:2}}>
                        <option value="">— เลือกผู้เล่น —</option>
                        {roster.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    )}
                  </div>
                  <button onClick={e=>{e.stopPropagation();clearPick(teamKey,idx);}}
                    style={{background:"none",border:"none",color:"#ff4757",cursor:"pointer",fontSize:14,padding:"0 2px",lineHeight:1}}>✕</button>
                </>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                  <div style={{width:38,height:38,borderRadius:8,flexShrink:0,
                    border:`2px dashed ${isActive?accentCol:C.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:16,color:isActive?accentCol:"#2a2550"}}>{isActive?"✛":"+"}</span>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:isActive?accentCol:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                    <div style={{fontSize:9,color:"#2a2550"}}>{isActive?"คลิก Hero":"รอเลือก"}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStatsTable = (teamKey, picks, stats, accentCol, teamName) => {
    const fields = ["kills","deaths","assists","damage","damageTaken","gold"];
    const headers = ["K","D","A","Dmg","DmgTkn","Gold"];
    if (!picks.some(s=>s.hero)) return null;
    return (
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:accentCol,fontWeight:800,marginBottom:5}}>
          {teamKey==="A"?`🔵 ${teamName}`:`🔴 ${teamName}`}
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:340}}>
            <thead>
              <tr style={{background:"#0f0c22"}}>
                <th style={{padding:"5px 8px",textAlign:"left",fontSize:9,color:C.textMuted,fontWeight:700}}>ผู้เล่น / Hero</th>
                {headers.map(h=>(
                  <th key={h} style={{padding:"5px 4px",textAlign:"center",fontSize:9,color:C.textMuted,fontWeight:700}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {picks.map((slot,idx)=>{
                if (!slot.hero) return null;
                return (
                  <tr key={idx} style={{borderTop:`1px solid ${C.border}`}}>
                    <td style={{padding:"4px 8px",minWidth:100}}>
                      <div style={{fontSize:10,fontWeight:700,color:accentCol}}>
                        {slot.player||<span style={{color:C.textMuted,fontWeight:400,fontStyle:"italic"}}>ไม่ระบุ</span>}
                      </div>
                      <div style={{fontSize:8,color:C.textMuted}}>{slot.hero.name}</div>
                    </td>
                    {fields.map(field=>{
                      const cur = stats[idx]?.[field];
                      return (
                        <td key={field} style={{padding:"3px 2px",textAlign:"center"}}>
                          <input type="number" min="0"
                            value={cur??""} placeholder="0"
                            onChange={e=>setStatVal(teamKey,idx,field,e.target.value)}
                            style={{width:46,background:"#0a0816",border:`1px solid ${C.border}`,
                              color:C.textMain,borderRadius:4,padding:"2px 3px",
                              fontSize:10,textAlign:"center",outline:"none"}}/>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
      <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,marginBottom:12}}>
        🎮 Game {gameNo}
      </div>

      {/* 3-col: teamA | hero grid | teamB */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {renderPickColumn(teamA||"ทีม A","A",picksA,setPicksA,rosterA,C.blue)}
        <div style={{flex:1.4,display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Hero..."
              style={{...iStyle,width:110,padding:"4px 8px",fontSize:11}}/>
            {ROLES_FILTER.map(r=>(
              <button key={r} onClick={()=>setRoleFilter(r)} style={{
                background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                color:roleFilter===r?"#fff":C.textMuted,
                borderRadius:99,padding:"2px 7px",fontSize:9,cursor:"pointer",fontWeight:700}}>{r}</button>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(54px,1fr))",
            gap:3,maxHeight:260,overflowY:"auto"}}>
            {filtered.map(hero=>{
              const used=usedHeroes.has(hero.name);
              return (
                <div key={hero.name} onClick={()=>!used&&pickHero(hero)}
                  style={{opacity:used?0.2:1,cursor:used?"not-allowed":"pointer",transition:"transform .1s"}}
                  onMouseEnter={e=>{if(!used)e.currentTarget.style.transform="scale(1.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                  <HeroCard hero={hero} size={54}/>
                </div>
              );
            })}
          </div>
        </div>
        {renderPickColumn(teamB||"ทีม B","B",picksB,setPicksB,rosterB,C.red)}
      </div>

      {/* Result + kills + duration */}
      <div style={{display:"flex",gap:10,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>ทีมที่ชนะ</div>
          <div style={{display:"flex",gap:6}}>
            {[{k:"A",label:teamA||"ทีม A",col:C.blue},{k:"B",label:teamB||"ทีม B",col:C.red}].map(opt=>(
              <button key={opt.k} onClick={()=>setResult(opt.k)}
                style={{background:result===opt.k?opt.col+"30":"transparent",
                  border:`2px solid ${result===opt.k?opt.col:C.border}`,
                  color:result===opt.k?opt.col:C.textMuted,
                  borderRadius:8,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                🏆 {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.blue,marginBottom:4}}>Kill {teamA||"A"}</div>
          <input type="number" min="0" value={killsA} onChange={e=>setKillsA(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.red,marginBottom:4}}>Kill {teamB||"B"}</div>
          <input type="number" min="0" value={killsB} onChange={e=>setKillsB(e.target.value)}
            placeholder="0" style={{...iStyle,width:70,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>เวลา (นาที)</div>
          <input type="number" value={duration} onChange={e=>setDuration(e.target.value)}
            placeholder="18" style={{...iStyle,width:80,padding:"5px 8px",fontSize:12}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Coach Notes</div>
          <input value={note} onChange={e=>setNote(e.target.value)}
            placeholder="วิเคราะห์ draft / pattern..."
            style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
        </div>
      </div>

      {/* Pattern Tags */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:10,color:C.textMuted,marginBottom:5,fontWeight:700}}>🏷️ Pattern Tags</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {PATTERN_TAGS.map(t=>(
            <button key={t} onClick={()=>toggleTag(t)} style={{
              background:tags.includes(t)?C.primary+"40":"transparent",
              border:`1px solid ${tags.includes(t)?C.primary:C.border}`,
              color:tags.includes(t)?C.primaryLight:C.textMuted,
              borderRadius:99,padding:"3px 10px",fontSize:10,cursor:"pointer",fontWeight:700}}>{t}</button>
          ))}
        </div>
      </div>

      {/* Stats accordion */}
      <div style={{marginBottom:12}}>
        <button onClick={()=>setShowStats(v=>!v)} style={{
          background:showStats?C.primary+"20":"transparent",
          border:`1px solid ${showStats?C.primary:C.border}`,
          color:showStats?C.primaryLight:C.textMuted,
          borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700,marginBottom:showStats?10:0}}>
          {showStats?"▲ ซ่อน Stats":"📊 กรอก Stats ผู้เล่น (K/D/A/Dmg ฯลฯ)"}
        </button>
        {showStats&&(
          <div style={{background:"#080614",borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
            {renderStatsTable("A",picksA,statsA,C.blue,teamA||"ทีม A")}
            {renderStatsTable("B",picksB,statsB,C.red, teamB||"ทีม B")}
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={onCancel}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
            borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:12}}>ยกเลิก</button>
        <button onClick={handleSave}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:8,padding:"6px 20px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          ✅ บันทึก Game {gameNo}
        </button>
      </div>
    </div>
  );
}
function ScoutSessionCreator({ rivals, enemyRosters, onSave, onCancel }) {
  const [teamA,    setTeamA]    = useState("");
  const [teamB,    setTeamB]    = useState("");
  const [mode,     setMode]     = useState("quick"); // "quick" | "bo"
  const [boType,   setBoType]   = useState("BO3");
  const [games,    setGames]    = useState([]);
  const [gameNo,   setGameNo]   = useState(1);
  const [stage,    setStage]    = useState("setup"); // "setup" | "recording" | "done"

  const bo = BO_OPTIONS.find(b=>b.label===boType)||BO_OPTIONS[2];

  function handleGameSave(gameData) {
    const newGames = [...games, gameData];
    setGames(newGames);
    if (mode==="quick" || newGames.length >= bo.total) {
      onSave({ teamA, teamB, mode, boType:mode==="bo"?boType:"Quick", games:newGames });
    } else {
      setGameNo(n=>n+1);
    }
  }

  if (stage==="setup") return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,padding:28,maxWidth:520}}>
      <div style={{textAlign:"center",marginBottom:22}}>
        <div style={{fontSize:32,marginBottom:6}}>🔍</div>
        <h3 style={{margin:0,fontSize:18,fontWeight:800}}>บันทึก Scout Match</h3>
        <p style={{margin:"4px 0 0",color:C.textMuted,fontSize:12}}>จดแมตช์ที่เราไปส่องมา</p>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        {[{label:"🔵 ทีม A",val:teamA,set:setTeamA,col:C.blue},
          {label:"🔴 ทีม B",val:teamB,set:setTeamB,col:C.red}].map(({label,val,set,col})=>(
          <div key={label}>
            <div style={{fontSize:11,color:col,fontWeight:700,marginBottom:5}}>{label}</div>
            <select value={rivals.find(r=>r.name===val)?val:"__custom__"}
              onChange={e=>{if(e.target.value!=="__custom__")set(e.target.value);else set("");}}
              style={iStyle}>
              <option value="__custom__">— พิมพ์ชื่อใหม่ —</option>
              {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
            {(!val||!rivals.find(r=>r.name===val))&&(
              <input value={val} onChange={e=>set(e.target.value)}
                placeholder="ชื่อทีม..." style={{...iStyle,marginTop:5}}/>
            )}
          </div>
        ))}
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>รูปแบบ</div>
        <div style={{display:"flex",gap:8}}>
          {[{id:"quick",label:"⚡ Quick (1 เกม)",sub:"จดเร็ว"},
            {id:"bo",   label:"📦 BO Series",   sub:"หลายเกม"}].map(opt=>(
            <button key={opt.id} onClick={()=>setMode(opt.id)}
              style={{flex:1,background:mode===opt.id?C.primary+"25":"transparent",
                border:`2px solid ${mode===opt.id?C.primary:C.border}`,
                color:mode===opt.id?C.primaryLight:C.textMuted,
                borderRadius:10,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
              <div style={{fontWeight:800,fontSize:13}}>{opt.label}</div>
              <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{opt.sub}</div>
            </button>
          ))}
        </div>
        {mode==="bo"&&(
          <div style={{marginTop:10}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>BO format</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
              {BO_OPTIONS.map(b=>(
                <button key={b.label} onClick={()=>setBoType(b.label)} style={{
                  background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:8,padding:"7px 2px",cursor:"pointer",textAlign:"center",fontSize:12,fontWeight:900}}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:8}}>
        <button onClick={onCancel}
          style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:9,padding:"10px",cursor:"pointer",fontWeight:700}}>
          ยกเลิก
        </button>
        <button onClick={()=>{
          if(!teamA.trim()||!teamB.trim()){alert("กรุณากรอกชื่อทั้งสองทีม");return;}
          if(teamA.trim()===teamB.trim()){alert("ทีม A และ B ต้องไม่เหมือนกัน");return;}
          setStage("recording");
        }} style={{flex:2,background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:9,padding:"10px",
          cursor:"pointer",fontWeight:800,fontSize:14}}>
          เริ่มบันทึก →
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{fontWeight:800,fontSize:15,color:C.primaryLight}}>
          🔍 Scout: <span style={{color:C.blue}}>{teamA}</span>
          <span style={{color:C.textMuted,margin:"0 6px"}}>vs</span>
          <span style={{color:C.red}}>{teamB}</span>
        </div>
        {mode==="bo"&&(
          <div style={{display:"flex",gap:5}}>
            {Array.from({length:bo.total},(_,i)=>(
              <div key={i} style={{width:22,height:22,borderRadius:"50%",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
                background:i<games.length?"#6C5CE730":i===gameNo-1?C.primary+"30":"transparent",
                border:`2px solid ${i<games.length?C.primary:i===gameNo-1?C.primary:C.border}`,
                color:i<games.length?C.primaryLight:i===gameNo-1?C.primary:C.textMuted}}>
                {i<games.length?"✓":i+1}
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>{if(window.confirm("ยกเลิกการบันทึก?"))onCancel();}}
          style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.lose}40`,
            color:C.lose,borderRadius:7,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
          ✕ ยกเลิก
        </button>
      </div>
      <ScoutGameForm
        key={gameNo} gameNo={gameNo}
        teamA={teamA} teamB={teamB}
        rivals={rivals} enemyRosters={enemyRosters}
        onSave={handleGameSave}
        onCancel={onCancel}
      />
    </div>
  );
}

// ═══════════════════════════════════════════
//  SCOUT CARD — แสดงผลใน Scout Log
// ═══════════════════════════════════════════
function ScoutCard({ sm, onDelete }) {
  const [open, setOpen] = useState(false);
  const gamesArr = sm.games||[];
  const aWins = gamesArr.filter(g=>g.teamAResult==="WIN").length;
  const bWins = gamesArr.length - aWins;

  // รวม kills ทั้ง session
  const totKillsA = gamesArr.reduce((s,g)=>s+Number(g.killsA||0),0);
  const totKillsB = gamesArr.reduce((s,g)=>s+Number(g.killsB||0),0);

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
      marginBottom:10,overflow:"hidden",borderLeft:`4px solid ${C.primary}`}}>
      <div onClick={()=>setOpen(v=>!v)}
        style={{padding:"12px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🔍</span>
        <div>
          <span style={{fontWeight:800,color:C.blue,fontSize:14}}>{sm.teamA}</span>
          <span style={{color:C.textMuted,margin:"0 8px",fontWeight:700}}>vs</span>
          <span style={{fontWeight:800,color:C.red,fontSize:14}}>{sm.teamB}</span>
        </div>
        <span style={{fontSize:11,color:C.textMuted}}>{sm.date}</span>
        <span style={{fontSize:11,padding:"2px 9px",borderRadius:99,fontWeight:700,
          background:C.primary+"20",color:C.primaryLight}}>{sm.boType}</span>
        <div style={{marginLeft:"auto",display:"flex",gap:12,alignItems:"center"}}>
          {/* win score */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <span style={{fontSize:13,color:C.blue,fontWeight:800}}>{aWins}W</span>
            <span style={{fontSize:11,color:C.textMuted}}>—</span>
            <span style={{fontSize:13,color:C.red,fontWeight:800}}>{bWins}W</span>
          </div>
          {/* kill score */}
          {(totKillsA>0||totKillsB>0)&&(
            <div style={{display:"flex",gap:4,alignItems:"center",
              background:C.bgCard,borderRadius:7,padding:"2px 8px",fontSize:11}}>
              <span style={{color:C.blue,fontWeight:700}}>{totKillsA}</span>
              <span style={{color:C.textMuted}}>:</span>
              <span style={{color:C.red,fontWeight:700}}>{totKillsB}</span>
              <span style={{color:C.textMuted,fontSize:9}}>kills</span>
            </div>
          )}
          <span style={{color:C.textMuted,fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {open&&(
        <div style={{padding:"0 16px 16px"}}>
          {gamesArr.map((g,gi)=>{
            const winner = g.teamAResult==="WIN" ? sm.teamA : sm.teamB;
            const hasStatsA = g.statsA && Object.values(g.statsA).some(s=>s?.kills!==undefined);
            const hasStatsB = g.statsB && Object.values(g.statsB).some(s=>s?.kills!==undefined);
            const hasAnyStats = hasStatsA || hasStatsB;

            return (
              <div key={gi} style={{background:C.bgCard,borderRadius:10,padding:"12px 14px",
                marginBottom:8,border:`1px solid ${C.border}`}}>
                {/* game header */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:12,color:C.primaryLight}}>Game {gi+1}</span>
                  <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
                    background:C.win+"20",color:C.win}}>🏆 {winner}</span>
                  {(g.killsA||g.killsB)&&(
                    <span style={{fontSize:11,color:C.textMuted}}>
                      <span style={{color:C.blue,fontWeight:700}}>{g.killsA||0}</span>
                      <span style={{margin:"0 4px"}}>:</span>
                      <span style={{color:C.red,fontWeight:700}}>{g.killsB||0}</span>
                      <span style={{fontSize:9}}> kills</span>
                    </span>
                  )}
                  {g.duration&&<span style={{fontSize:11,color:C.textMuted}}>{g.duration} นาที</span>}
                  {g.tags&&g.tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {g.tags.map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"1px 7px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* picks + inline stats */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:g.note?8:0}}>
                  {[
                    {label:`🔵 ${sm.teamA}`,picks:g.picksA,stats:g.statsA||{},col:C.blue},
                    {label:`🔴 ${sm.teamB}`,picks:g.picksB,stats:g.statsB||{},col:C.red},
                  ].map(({label,picks,stats,col})=>(
                    <div key={label} style={{background:"#0e0b1e",borderRadius:8,padding:"8px 10px"}}>
                      <div style={{fontSize:10,color:col,fontWeight:700,marginBottom:6}}>{label}</div>
                      {(picks||[]).filter(s=>s.hero).map((s,i)=>{
                        const ps = stats[i]||{};
                        const hasPs = ps.kills!==undefined;
                        const kda = hasPs
                          ? ((Number(ps.kills||0)+Number(ps.assists||0))/Math.max(Number(ps.deaths||1),1)).toFixed(1)
                          : null;
                        return (
                          <div key={i} style={{marginBottom:5}}>
                            <div style={{display:"flex",gap:6,alignItems:"center"}}>
                              <span style={{fontSize:9,color:ROLE_COLOR[s.role]||col,width:44}}>{s.role}</span>
                              <span style={{fontSize:11,fontWeight:700,flex:1}}>{s.hero?.name||"—"}</span>
                              {s.player&&<span style={{fontSize:9,color:C.textMuted}}>{s.player}</span>}
                              {kda&&<span style={{fontSize:9,color:"#fdcb6e",fontWeight:700}}>KDA {kda}</span>}
                            </div>
                            {hasPs&&(
                              <div style={{display:"flex",gap:6,marginLeft:50,marginTop:1}}>
                                <span style={{fontSize:9,color:"#00cec9"}}>{ps.kills??"-"}K</span>
                                <span style={{fontSize:9,color:C.lose}}>{ps.deaths??"-"}D</span>
                                <span style={{fontSize:9,color:"#a29bfe"}}>{ps.assists??"-"}A</span>
                                {ps.damage&&<span style={{fontSize:9,color:"#e17055"}}>{Number(ps.damage).toLocaleString()} dmg</span>}
                                {ps.damageTaken&&<span style={{fontSize:9,color:"#fd79a8"}}>{Number(ps.damageTaken).toLocaleString()} tkn</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {g.note&&(
                  <div style={{background:C.primary+"12",borderRadius:7,padding:"6px 10px",
                    fontSize:11,color:C.primaryLight,marginTop:6}}>
                    📝 {g.note}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={()=>{if(window.confirm("ลบ Scout record นี้?"))onDelete(sm.id);}}
            style={{background:C.lose+"15",border:`1px solid ${C.lose}30`,color:C.lose,
              borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:700,marginTop:4}}>
            🗑️ ลบ
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  SCOUT LOG PAGE — แสดงใน Rivals detail
// ═══════════════════════════════════════════
// ── helper: คำนวณ stats ต่อ matchup ──
function calcMatchupStats(records, teamFocus) {
  let wins=0, games=0, kFor=0, kAgainst=0;
  let totK=0,totD=0,totA=0,totDmg=0,totDtk=0,statCnt=0;
  const heroFreq={}, patternCount={};

  records.forEach(sm=>{
    const isA = sm.teamA===teamFocus;
    (sm.games||[]).forEach(g=>{
      games++;
      const won = isA ? g.teamAResult==="WIN" : g.teamAResult==="LOSE";
      if (won) wins++;
      kFor     += Number(isA?g.killsA:g.killsB||0);
      kAgainst += Number(isA?g.killsB:g.killsA||0);
      // stats per player
      const stats = isA?(g.statsA||{}):(g.statsB||{});
      Object.values(stats).forEach(ps=>{ if(ps?.kills!==undefined){
        totK+=Number(ps.kills||0);totD+=Number(ps.deaths||0);
        totA+=Number(ps.assists||0);totDmg+=Number(ps.damage||0);
        totDtk+=Number(ps.damageTaken||0);statCnt++;
      }});
      // hero freq
      const picks = isA?g.picksA:g.picksB;
      (picks||[]).forEach(s=>{ if(s.hero?.name) heroFreq[s.hero.name]=(heroFreq[s.hero.name]||0)+1; });
      // patterns
      (g.tags||[]).forEach(t=>{ patternCount[t]=(patternCount[t]||0)+1; });
    });
  });
  return {
    wins, games, losses:games-wins,
    wr: games?Math.round(wins/games*100):0,
    kFor, kAgainst,
    avgKDA:  statCnt?((totK+totA)/Math.max(totD,1)/statCnt).toFixed(2):"-",
    avgK:    statCnt?(totK/statCnt).toFixed(1):"-",
    avgD:    statCnt?(totD/statCnt).toFixed(1):"-",
    avgA:    statCnt?(totA/statCnt).toFixed(1):"-",
    avgDmg:  statCnt?Math.round(totDmg/statCnt):null,
    avgDtk:  statCnt?Math.round(totDtk/statCnt):null,
    statCnt,
    topHeroes: Object.entries(heroFreq).sort((a,b)=>b[1]-a[1]).slice(0,8),
    topPatterns: Object.entries(patternCount).sort((a,b)=>b[1]-a[1]).slice(0,6),
  };
}

// ── Matchup Detail: A vs B ──
function MatchupDetail({ rivalName, opponent, records, rivals, enemyRosters, onSaveScout, onDeleteScout, onBack }) {
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const st = calcMatchupStats(records, rivalName);
  const SC = { card:{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"} };

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  return (
    <div>
      {/* breadcrumb header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={onBack}
          style={{background:"transparent",border:"none",color:C.textMuted,
            cursor:"pointer",fontSize:13,padding:0,display:"flex",alignItems:"center",gap:4}}>
          ← Scout Log
        </button>
        <span style={{color:C.border}}>›</span>
        <span style={{fontWeight:800,fontSize:15,color:C.blue}}>{rivalName}</span>
        <span style={{color:C.textMuted,fontWeight:700}}>vs</span>
        <span style={{fontWeight:800,fontSize:15,color:C.red}}>{opponent}</span>
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,
          border:`1px solid ${C.border}`,marginLeft:"auto"}}>
          {[{id:"overview",label:"📊 Overview"},{id:"log",label:"📋 Records"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
              background:activeTab===t.id?C.primary:"transparent",
              border:"none",color:activeTab===t.id?"#fff":C.textMuted,
              borderRadius:6,padding:"5px 12px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={()=>setCreating(true)}
          style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"6px 14px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          + บันทึก Scout ใหม่
        </button>
      </div>

      {records.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มีข้อมูล {rivalName} vs {opponent}
        </div>
      ) : activeTab==="log" ? (
        records.map(sm=>(
          <ScoutCard key={sm.id} sm={sm} onDelete={id=>onDeleteScout(id)}/>
        ))
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {label:"🎮 เกม",        val:st.games,                              col:C.primaryLight},
              {label:"🏆 Win Rate",   val:st.games?`${st.wr}%`:"-",             col:st.wr>=50?C.win:C.lose},
              {label:"✅ W / ❌ L",   val:`${st.wins} / ${st.losses}`,          col:st.wins>=st.losses?C.win:C.lose},
              {label:"⚔️ Kill For",  val:st.kFor,                               col:C.win},
              {label:"💀 Kill Against",val:st.kAgainst,                         col:C.lose},
            ].map(c=>(
              <div key={c.label} style={{...SC.card,textAlign:"center",padding:"12px 8px"}}>
                <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>{c.label}</div>
                <div style={{fontSize:st.games>0&&c.label==="✅ W / ❌ L"?16:22,fontWeight:800,color:c.col}}>{c.val}</div>
              </div>
            ))}
          </div>

          {/* KDA */}
          {st.statCnt>0&&(
            <div style={SC.card}>
              <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                📈 KDA เฉลี่ยต่อผู้เล่น ({rivalName})
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
                {[
                  {label:"Avg K",      val:st.avgK,                              col:"#00cec9"},
                  {label:"Avg D",      val:st.avgD,                              col:C.lose},
                  {label:"Avg A",      val:st.avgA,                              col:"#a29bfe"},
                  {label:"KDA",        val:st.avgKDA,                            col:"#fdcb6e"},
                  {label:"Avg Dmg",    val:st.avgDmg?st.avgDmg.toLocaleString():"-", col:"#e17055"},
                  {label:"Avg DmgTkn", val:st.avgDtk?st.avgDtk.toLocaleString():"-", col:"#fd79a8"},
                ].map(c=>(
                  <div key={c.label} style={{background:C.bgCard,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                    <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{c.label}</div>
                    <div style={{fontSize:15,fontWeight:800,color:c.col}}>{c.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hero pool + patterns */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {st.topHeroes.length>0&&(
              <div style={SC.card}>
                <div style={{fontWeight:700,fontSize:12,color:C.lose,marginBottom:10}}>
                  🦸 Hero Pool ของ {rivalName}
                </div>
                {st.topHeroes.map(([h,cnt],i)=>(
                  <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:C.textMuted,width:16}}>#{i+1}</span>
                      <HeroChip name={h} size={26} accentCol={C.lose} fontSize={12}/>
                    </div>
                    <span style={{background:C.lose+"20",color:C.lose,fontSize:10,
                      padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
                  </div>
                ))}
              </div>
            )}
            {st.topPatterns.length>0&&(
              <div style={SC.card}>
                <div style={{fontWeight:700,fontSize:12,color:C.primaryLight,marginBottom:10}}>
                  🏷️ Pattern ที่เจอ
                </div>
                {st.topPatterns.map(([t,cnt],i)=>(
                  <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:6,marginBottom:2}}>
                    <span style={{fontWeight:700,fontSize:12,color:C.primaryLight}}>{t}</span>
                    <span style={{background:C.primary+"25",color:C.primaryLight,fontSize:10,
                      padding:"1px 8px",borderRadius:99,fontWeight:700}}>×{cnt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scout Log Page: matchup list ──
function ScoutLogPage({ rivalName, scoutMatches, rivals, enemyRosters, onSaveScout, onDeleteScout }) {
  const [creating,    setCreating]    = useState(false);
  const [selOpponent, setSelOpponent] = useState(null); // ทีมที่เลือก drill-down

  // records ที่ rivalName เกี่ยวข้อง
  const related = scoutMatches.filter(sm=>sm.teamA===rivalName||sm.teamB===rivalName);

  // สร้าง matchup map: { opponentName → records[] }
  const matchupMap = {};
  related.forEach(sm=>{
    const opp = sm.teamA===rivalName ? sm.teamB : sm.teamA;
    if (!matchupMap[opp]) matchupMap[opp]=[];
    matchupMap[opp].push(sm);
  });
  const matchups = Object.entries(matchupMap)
    .map(([opp,recs])=>({ opp, recs, ...calcMatchupStats(recs,rivalName) }))
    .sort((a,b)=>b.games-a.games);

  if (creating) return (
    <ScoutSessionCreator rivals={rivals} enemyRosters={enemyRosters}
      onSave={data=>{onSaveScout(data);setCreating(false);}}
      onCancel={()=>setCreating(false)}/>
  );

  // ── Drill-down: A vs B ──
  if (selOpponent) return (
    <MatchupDetail
      rivalName={rivalName}
      opponent={selOpponent}
      records={matchupMap[selOpponent]||[]}
      rivals={rivals}
      enemyRosters={enemyRosters}
      onSaveScout={data=>{onSaveScout(data);}}
      onDeleteScout={onDeleteScout}
      onBack={()=>setSelOpponent(null)}
    />
  );

  // ── Level 1: matchup list ──
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          🔍 Scout Log — {rivalName}
        </h3>
        <button onClick={()=>setCreating(true)}
          style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",
            cursor:"pointer",fontWeight:800,fontSize:12}}>
          + บันทึก Scout ใหม่
        </button>
      </div>

      {related.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 20px",background:C.bgPanel,
          borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>🔍</div>
          ยังไม่มี Scout record ของ {rivalName}<br/>
          <span style={{fontSize:12}}>กด "+ บันทึก Scout ใหม่" เพื่อเริ่มจด</span>
        </div>
      ) : (
        <>
          <p style={{margin:"0 0 12px",color:C.textMuted,fontSize:12}}>
            เลือก matchup เพื่อดูรายละเอียด
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {matchups.map(mu=>(
              <div key={mu.opp}
                onClick={()=>setSelOpponent(mu.opp)}
                style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,
                  padding:"14px 18px",cursor:"pointer",
                  borderLeft:`4px solid ${mu.wr>=50?C.win:mu.games===0?"#555":C.lose}`,
                  display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>

                {/* team names */}
                <div style={{minWidth:180}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontWeight:900,fontSize:15,color:C.blue}}>{rivalName}</span>
                    <span style={{color:C.textMuted,fontWeight:700,fontSize:12}}>vs</span>
                    <span style={{fontWeight:900,fontSize:15,color:C.red}}>{mu.opp}</span>
                  </div>
                  <div style={{fontSize:11,color:C.textMuted}}>
                    {mu.recs.length} session · {mu.games} เกม
                  </div>
                </div>

                {/* W/L record */}
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <div style={{background:C.win+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.win}}>{mu.wins}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>W</div>
                  </div>
                  <span style={{color:C.textMuted,fontWeight:700}}>—</span>
                  <div style={{background:C.lose+"20",borderRadius:8,padding:"4px 12px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.lose}}>{mu.losses}</div>
                    <div style={{fontSize:9,color:C.textMuted}}>L</div>
                  </div>
                </div>

                {/* WR badge */}
                <div style={{textAlign:"center",minWidth:52}}>
                  <div style={{fontSize:20,fontWeight:800,color:mu.wr>=50?C.win:C.lose}}>
                    {mu.games?`${mu.wr}%`:"-"}
                  </div>
                  <div style={{fontSize:9,color:C.textMuted}}>Win Rate</div>
                </div>

                {/* kill ratio */}
                {(mu.kFor>0||mu.kAgainst>0)&&(
                  <div style={{textAlign:"center",minWidth:80}}>
                    <div style={{fontSize:13,fontWeight:700}}>
                      <span style={{color:C.win}}>{mu.kFor}</span>
                      <span style={{color:C.textMuted,margin:"0 4px"}}>:</span>
                      <span style={{color:C.lose}}>{mu.kAgainst}</span>
                    </div>
                    <div style={{fontSize:9,color:C.textMuted}}>kills</div>
                  </div>
                )}

                {/* last game tags */}
                {(()=>{
                  const lastGame = mu.recs[mu.recs.length-1];
                  const lastG = (lastGame?.games||[]).slice(-1)[0];
                  const tags = lastG?.tags||[];
                  return tags.length>0&&(
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                      {tags.slice(0,3).map(t=>(
                        <span key={t} style={{background:C.primary+"20",color:C.primaryLight,
                          fontSize:9,padding:"2px 8px",borderRadius:99,fontWeight:700}}>{t}</span>
                      ))}
                    </div>
                  );
                })()}

                <span style={{marginLeft:"auto",color:C.textMuted,fontSize:13}}>→</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  PERFORMANCE TREND
// ═══════════════════════════════════════════
function PerformanceTrend({ allGames }) {
  const [period, setPeriod] = useState("week"); // week | month

  if (allGames.length === 0) return null;

  // group games by period
  function getPeriodKey(dateStr) {
    // dateStr = Thai locale like "15 ม.ค. 2568"
    // fallback: use index bucketing if parse fails
    return dateStr || "unknown";
  }

  // sort games by id (proxy for date order)
  const sorted = [...allGames].sort((a,b)=>(a._matchId||0)-(b._matchId||0));

  // bucket into weeks or months (use sequential index since dates are Thai strings)
  const buckets = [];
  const size = period==="week" ? 5 : 10; // games per bucket
  for (let i=0; i<sorted.length; i+=size) {
    const chunk = sorted.slice(i, i+size);
    const wins  = chunk.filter(g=>g.result==="WIN").length;
    const wr    = Math.round(wins/chunk.length*100);
    let totK=0,totD=0,totA=0,cnt=0;
    chunk.forEach(g=>{
      const picks=g.ourPicks||[];
      picks.forEach((slot,idx)=>{
        const gs=g.gameStats?.our?.[idx];
        if(gs?.kills!==undefined){
          totK+=Number(gs.kills||0);totD+=Number(gs.deaths||0);totA+=Number(gs.assists||0);cnt++;
        }
      });
    });
    const kda = cnt ? ((totK+totA)/Math.max(totD,1)).toFixed(2) : null;
    buckets.push({ label:`G${i+1}–${Math.min(i+size,sorted.length)}`, wins, total:chunk.length, wr, kda });
  }

  const maxWR = 100;
  const barH  = 120;

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginTop:20}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
          📈 Performance Trend
        </h3>
        <div style={{display:"flex",gap:3,background:C.bgBase,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {[{id:"week",label:"ทุก 5 เกม"},{id:"month",label:"ทุก 10 เกม"}].map(p=>(
            <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
              background:period===p.id?C.primary:"transparent",
              border:"none",color:period===p.id?"#fff":C.textMuted,
              borderRadius:6,padding:"4px 12px",cursor:"pointer",fontWeight:700,fontSize:11}}>
              {p.label}
            </button>
          ))}
        </div>
        <span style={{fontSize:11,color:C.textMuted,marginLeft:"auto"}}>
          {allGames.length} เกม รวม
        </span>
      </div>

      {buckets.length < 2 ? (
        <div style={{textAlign:"center",padding:"20px 0",color:C.textMuted,fontSize:12}}>
          ต้องการข้อมูลอย่างน้อย {size*2} เกมเพื่อแสดง trend
        </div>
      ) : (
        <div>
          {/* WR bars */}
          <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8}}>Win Rate %</div>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:barH+30,marginBottom:20}}>
            {buckets.map((b,i)=>{
              const h = Math.round((b.wr/maxWR)*barH);
              const col = b.wr>=60?C.win:b.wr>=40?"#fdcb6e":C.lose;
              const prev = buckets[i-1];
              const trend = prev ? (b.wr>prev.wr?"▲":b.wr<prev.wr?"▼":"—") : "";
              const trendCol = prev ? (b.wr>prev.wr?C.win:b.wr<prev.wr?C.lose:C.textMuted) : C.textMuted;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{fontSize:9,color:trendCol,fontWeight:700}}>{trend}</span>
                  <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:barH}}>
                    <div title={`${b.wr}% (${b.wins}W/${b.total}G)`}
                      style={{width:"100%",height:Math.max(h,4),
                        background:`linear-gradient(180deg,${col},${col}99)`,
                        borderRadius:"4px 4px 0 0",position:"relative",cursor:"default"}}>
                      <div style={{position:"absolute",top:-18,width:"100%",textAlign:"center",
                        fontSize:9,color:col,fontWeight:800}}>{b.wr}%</div>
                    </div>
                  </div>
                  <div style={{fontSize:8,color:C.textMuted,textAlign:"center",lineHeight:1.3}}>
                    {b.label}
                  </div>
                  <div style={{fontSize:8,color:col,fontWeight:700}}>{b.wins}/{b.total}</div>
                </div>
              );
            })}
          </div>

          {/* KDA trend line (only if stats exist) */}
          {buckets.some(b=>b.kda) && (
            <>
              <div style={{height:1,background:C.border,marginBottom:16}}/>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8}}>KDA เฉลี่ย (จากเกมที่กรอก Stats)</div>
              <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60}}>
                {buckets.map((b,i)=>{
                  const maxKDA = Math.max(...buckets.filter(x=>x.kda).map(x=>Number(x.kda)),1);
                  const h = b.kda ? Math.round((Number(b.kda)/maxKDA)*50)+4 : 4;
                  return (
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                      {b.kda && <div style={{fontSize:8,color:"#fdcb6e",fontWeight:700}}>{b.kda}</div>}
                      <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:54}}>
                        <div style={{width:"100%",height:h,background:b.kda?"#fdcb6e33":"transparent",
                          borderRadius:"3px 3px 0 0",border:b.kda?`1px solid #fdcb6e44`:"none"}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* summary */}
          {buckets.length >= 2 && (()=>{
            const first = buckets[0].wr;
            const last  = buckets[buckets.length-1].wr;
            const diff  = last - first;
            return (
              <div style={{marginTop:14,padding:"8px 14px",borderRadius:8,
                background:diff>0?C.win+"10":diff<0?C.lose+"10":C.bgCard,
                border:`1px solid ${diff>0?C.win+"30":diff<0?C.lose+"30":C.border}`,
                fontSize:12,color:diff>0?C.win:diff<0?C.lose:C.textMuted}}>
                {diff>0?`🚀 WR เพิ่มขึ้น +${diff}% ตั้งแต่ช่วงแรก`
                 :diff<0?`📉 WR ลดลง ${diff}% ตั้งแต่ช่วงแรก`
                 :"➡️ WR ทรงตัว"}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  COACH NOTES HUB
// ═══════════════════════════════════════════
function CoachNotesHub({ allGames, rivals }) {
  const [search,      setSearch]      = useState("");
  const [filterRival, setFilterRival] = useState("all");

  // รวม notes ทุกเกม
  const notes = allGames
    .filter(g=>g.note && g.note.trim())
    .map(g=>({
      note:      g.note,
      date:      g.date||"",
      rival:     g.rivalName||"",
      result:    g.result||"",
      ourSide:   g.ourSide||"",
      heroNames: (g.ourPicks||[]).filter(s=>s.hero).map(s=>s.hero.name).join(", "),
      _id:       g._matchId,
    }))
    .reverse(); // newest first

  const filtered = notes.filter(n=>{
    const matchRival  = filterRival==="all" || n.rival===filterRival;
    const matchSearch = !search || n.note.toLowerCase().includes(search.toLowerCase())
      || n.rival.toLowerCase().includes(search.toLowerCase());
    return matchRival && matchSearch;
  });

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>📝 Coach Notes Hub</h2>
        <span style={{fontSize:12,color:C.textMuted}}>{notes.length} notes รวม</span>
      </div>

      {/* filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 ค้นหา note..."
          style={{...iStyle,flex:1,minWidth:200,padding:"8px 12px",fontSize:13}}/>
        <select value={filterRival} onChange={e=>setFilterRival(e.target.value)}
          style={{...iStyle,width:180,padding:"8px 12px",fontSize:13}}>
          <option value="all">— ทุกทีม —</option>
          {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
      </div>

      {notes.length===0 ? (
        <div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
          <div style={{fontSize:32,marginBottom:8}}>📝</div>
          ยังไม่มี Coach Note — กรอกใน Match Log ตอนบันทึกเกม
        </div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:40,background:C.bgPanel,borderRadius:12,color:C.textMuted,fontSize:13}}>
          ไม่พบ note ที่ตรงกับ filter
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map((n,i)=>(
            <div key={i} style={{background:C.bgPanel,border:`1px solid ${C.border}`,
              borderRadius:12,padding:"14px 18px",
              borderLeft:`4px solid ${n.result==="WIN"?C.win:n.result==="LOSE"?C.lose:C.primary}`}}>
              {/* meta row */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
                {n.result && (
                  <span style={{padding:"2px 10px",borderRadius:99,fontSize:11,fontWeight:800,
                    background:n.result==="WIN"?C.win+"20":C.lose+"20",
                    color:n.result==="WIN"?C.win:C.lose}}>
                    {n.result}
                  </span>
                )}
                {n.rival && (
                  <span style={{fontWeight:700,fontSize:13,color:C.primaryLight}}>vs {n.rival}</span>
                )}
                {n.ourSide && (
                  <span style={{fontSize:11,padding:"1px 8px",borderRadius:99,fontWeight:700,
                    background:n.ourSide==="blue"?C.blue+"20":C.red+"20",
                    color:n.ourSide==="blue"?C.blue:C.red}}>
                    {n.ourSide==="blue"?"🔵 Blue":"🔴 Red"}
                  </span>
                )}
                <span style={{fontSize:11,color:C.textMuted,marginLeft:"auto"}}>{n.date}</span>
              </div>
              {/* note text */}
              <div style={{fontSize:13,color:C.textMain,lineHeight:1.6,marginBottom:n.heroNames?8:0}}>
                {n.note}
              </div>
              {/* heroes */}
              {n.heroNames && (
                <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>
                  🛡️ {n.heroNames}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  HERO IMAGE MANAGER
//  Bulk-upload images from the user's computer + auto-match by filename,
//  with a per-hero editor for fixing any mismatches.
// ═══════════════════════════════════════════
function HeroImageManager({ heroPhotos, onSetPhoto, onSetPhotosBulk, onRemovePhoto, onAddHero, onSetRole }) {
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [dragOver,   setDragOver]   = useState(false);
  const [matchLog,   setMatchLog]   = useState(null); // { matched:[], unmatched:[] }
  const [showAddHero, setShowAddHero] = useState(false);
  const bulkInputRef = useRef(null);

  // normalize a string for fuzzy filename matching: lowercase, strip
  // extension, strip non-alphanumeric chars (spaces, apostrophes, dashes…)
  function normalize(s) {
    return s.toLowerCase().replace(/\.[a-z0-9]+$/,"").replace(/[^a-z0-9]/g,"");
  }

  function handleBulkFiles(fileList) {
    const files = Array.from(fileList);
    const heroByNorm = {};
    HERO_DATA.forEach(h => { heroByNorm[normalize(h.name)] = h.name; });

    const matched = [];
    const unmatched = [];
    let pending = files.length;
    if (pending === 0) return;
    const updates = {};

    files.forEach(file => {
      const norm = normalize(file.name);
      const heroName = heroByNorm[norm];
      const reader = new FileReader();
      reader.onload = ev => {
        if (heroName) {
          updates[heroName] = ev.target.result;
          matched.push({ file: file.name, hero: heroName });
        } else {
          unmatched.push(file.name);
        }
        pending--;
        if (pending === 0) {
          if (Object.keys(updates).length > 0) onSetPhotosBulk(updates);
          setMatchLog({ matched, unmatched });
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleBulkFiles(e.dataTransfer.files);
  }

  const filtered = HERO_DATA.filter(h =>
    (roleFilter==="All"||h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const uploadedCount = HERO_DATA.filter(h => heroPhotos[h.name]).length;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🦸 Hero Images</h2>
        <span style={{background:C.primary,color:"#fff",fontSize:10,padding:"2px 8px",
          borderRadius:99,fontWeight:700}}>{uploadedCount}/{HERO_DATA.length} อัพโหลดแล้ว</span>
        <button onClick={()=>setShowAddHero(true)}
          style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"7px 16px",
            cursor:"pointer",fontWeight:800,fontSize:12,whiteSpace:"nowrap"}}>
          + เพิ่ม Hero ใหม่
        </button>
      </div>
      <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
        อัพโหลดรูป Hero จากเครื่องตัวเอง — รูปที่อัพโหลดจะใช้แทนรูปจากเว็บทันที · แก้ Role ได้ทุกตัวที่การ์ดด้านล่าง
      </p>

      {showAddHero && (
        <AddHeroModal onAdd={onAddHero} onClose={()=>setShowAddHero(false)}/>
      )}

      {/* Bulk upload zone */}
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
        style={{background:dragOver?C.primary+"15":C.bgPanel,
          border:`2px dashed ${dragOver?C.primary:C.border}`,borderRadius:14,
          padding:"28px 20px",textAlign:"center",marginBottom:16,transition:"all .15s"}}>
        <div style={{fontSize:30,marginBottom:8}}>📂</div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>
          ลากไฟล์รูปมาวางที่นี่ หรือเลือกหลายไฟล์พร้อมกัน
        </div>
        <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
          ระบบจะจับคู่ไฟล์กับ Hero อัตโนมัติจากชื่อไฟล์ เช่น "Toro.png" → Toro
        </div>
        <label style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:9,padding:"9px 22px",cursor:"pointer",
          fontWeight:800,fontSize:13,display:"inline-block"}}>
          เลือกไฟล์รูป (เลือกได้หลายไฟล์)
          <input ref={bulkInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
            onChange={e=>{ if(e.target.files?.length) handleBulkFiles(e.target.files); e.target.value=""; }}/>
        </label>
      </div>

      {/* Match result log */}
      {matchLog && (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
          padding:"14px 18px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <span style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>ผลการจับคู่ไฟล์</span>
            <button onClick={()=>setMatchLog(null)}
              style={{marginLeft:"auto",background:"none",border:"none",color:C.textMuted,
                cursor:"pointer",fontSize:14}}>✕</button>
          </div>
          {matchLog.matched.length>0 && (
            <div style={{fontSize:12,color:C.win,marginBottom:6}}>
              ✅ จับคู่สำเร็จ {matchLog.matched.length} ไฟล์: {matchLog.matched.map(m=>m.hero).join(", ")}
            </div>
          )}
          {matchLog.unmatched.length>0 && (
            <div style={{fontSize:12,color:C.lose}}>
              ❌ จับคู่ไม่ได้ {matchLog.unmatched.length} ไฟล์ (ชื่อไฟล์ไม่ตรงกับ Hero ใดเลย): {matchLog.unmatched.join(", ")}
              <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>
                แก้ไขได้ด้วยมือทีละตัวที่การ์ดด้านล่าง
              </div>
            </div>
          )}
        </div>
      )}

      {/* filters */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 ค้นหา Hero..."
          style={{...iStyle,flex:1,minWidth:180,padding:"7px 12px",fontSize:12}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["All",...ROLES_PICK].map(r=>(
            <button key={r} onClick={()=>setRoleFilter(r)} style={{
              background:roleFilter===r?(ROLE_COLOR[r]||C.primary)+"30":"transparent",
              border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
              color:roleFilter===r?(ROLE_COLOR[r]||C.primaryLight):C.textMuted,
              borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* per-hero grid editor */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10}}>
        {filtered.map(hero => (
          <HeroImageSlot key={hero.name} hero={hero}
            photoUrl={heroPhotos[hero.name]}
            onSet={(dataUrl)=>onSetPhoto(hero.name, dataUrl)}
            onRemove={()=>onRemovePhoto(hero.name)}
            onSetRole={(role)=>onSetRole(hero.name, role)}/>
        ))}
        {filtered.length===0 && (
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:30,color:C.textMuted}}>
            ไม่พบ Hero ที่ตรงกับการค้นหา
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Hero modal: name + role + optional photo ──
function AddHeroModal({ onAdd, onClose }) {
  const [name,  setName]  = useState("");
  const [role,  setRole]  = useState(ROLES_PICK[0]);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("กรุณากรอกชื่อ Hero"); return; }
    const exists = HERO_DATA.some(h=>h.name.toLowerCase()===trimmed.toLowerCase());
    if (exists) { setError(`มี Hero ชื่อ "${trimmed}" อยู่แล้ว`); return; }
    onAdd({ name: trimmed, role, photo });
    onClose();
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:16,
          padding:24,width:380,maxWidth:"90vw"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.primaryLight}}>+ เพิ่ม Hero ใหม่</h3>
          <button onClick={onClose}
            style={{marginLeft:"auto",background:"none",border:"none",color:C.textMuted,
              cursor:"pointer",fontSize:18}}>✕</button>
        </div>

        <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
          <PhotoPicker value={photo} onChange={setPhoto} size={64} team="our"/>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>ชื่อ Hero *</div>
          <input value={name} onChange={e=>{setName(e.target.value);setError("");}}
            onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            placeholder="เช่น Tulen, Liliana..." autoFocus
            style={{...iStyle,padding:"8px 12px",fontSize:13}}/>
        </div>

        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>Role *</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ROLES_PICK.map(r=>(
              <button key={r} onClick={()=>setRole(r)}
                style={{background:role===r?(ROLE_COLOR[r]||C.primary)+"30":"transparent",
                  border:`1.5px solid ${role===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                  color:role===r?(ROLE_COLOR[r]||C.primaryLight):C.textMuted,
                  borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{background:C.lose+"15",border:`1px solid ${C.lose}40`,color:C.lose,
            borderRadius:8,padding:"7px 12px",fontSize:12,marginBottom:14}}>
            ⚠️ {error}
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <button onClick={handleSubmit}
            style={{flex:1,background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:9,padding:"9px 0",
              cursor:"pointer",fontWeight:800,fontSize:13}}>
            ✅ เพิ่ม Hero
          </button>
          <button onClick={onClose}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:9,padding:"9px 18px",cursor:"pointer",fontSize:13}}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroImageSlot({ hero, photoUrl, onSet, onRemove, onSetRole }) {
  const [err, setErr] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const fileRef = useRef(null);
  const webUrl = useHeroImage(photoUrl ? null : hero); // only fall back to web lookup if no upload
  const displayUrl = photoUrl || webUrl;

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onSet(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div style={{background:C.bgPanel,border:`1px solid ${photoUrl?C.primary+"60":C.border}`,
      borderRadius:10,padding:8,textAlign:"center"}}>
      <div style={{position:"relative",width:"100%",aspectRatio:"1",borderRadius:8,
        overflow:"hidden",background:(ROLE_COLOR[hero.role]||C.primary)+"22",marginBottom:6}}>
        {displayUrl && !err ? (
          <img src={displayUrl} onError={()=>setErr(true)} alt={hero.name}
            style={{width:"100%",height:"100%",objectFit:"cover"}}/>
        ) : (
          <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:24,fontWeight:900,color:ROLE_COLOR[hero.role]||C.primaryLight}}>
              {hero.name.charAt(0)}
            </span>
          </div>
        )}
        {photoUrl && (
          <div style={{position:"absolute",top:3,right:3,background:C.win,color:"#fff",
            fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:99}}>✓</div>
        )}
        {hero._custom && (
          <div style={{position:"absolute",top:3,left:3,background:C.primary,color:"#fff",
            fontSize:8,fontWeight:800,padding:"1px 5px",borderRadius:99}}>NEW</div>
        )}
      </div>
      <div style={{fontSize:11,fontWeight:700,marginBottom:4,overflow:"hidden",
        textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{hero.name}</div>

      {/* role — click to edit */}
      {editingRole ? (
        <select autoFocus value={hero.role}
          onChange={e=>{ onSetRole(e.target.value); setEditingRole(false); }}
          onBlur={()=>setEditingRole(false)}
          style={{width:"100%",background:C.bgCard,border:`1px solid ${C.primary}`,
            color:C.textMain,borderRadius:5,padding:"2px 4px",fontSize:10,
            marginBottom:6,outline:"none"}}>
          {ROLES_PICK.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      ) : (
        <div onClick={()=>setEditingRole(true)} title="แก้ไข Role"
          style={{fontSize:9,fontWeight:700,marginBottom:6,cursor:"pointer",
            color:ROLE_COLOR[hero.role]||C.textMuted,
            display:"flex",alignItems:"center",justifyContent:"center",gap:3}}>
          {hero.role} <span style={{opacity:.6,fontSize:8}}>✏️</span>
        </div>
      )}

      <div style={{display:"flex",gap:4}}>
        <label style={{flex:1,background:C.primary+"20",border:`1px solid ${C.primary}50`,
          color:C.primaryLight,borderRadius:6,padding:"3px 0",cursor:"pointer",
          fontSize:10,fontWeight:700}}>
          📂
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
        </label>
        {photoUrl && (
          <button onClick={onRemove}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,fontWeight:700}}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  TACTICAL WHITEBOARD (merged module)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════
const HERO_LIST = [
  "Airi","Aleister","Alice","Allain","Amily","Annette","Arum","Arthur","Astrid",
  "Azzen'Ka","Baldum","Bijan","Butterfly","Capheny","Celica","Charlotte","Chaugnar",
  "D'Arcy","Diao Chan","Dirak","Edras","Eland'orr","Elsu","Enzo","Fennik",
  "Florentino","Gildur","Grakk","Hayate","Helen","Ignis","Ilumia","Ishar",
  "Jinnar","Kahlii","Kaine","Keera","Kil'Groth","Kriknak","Krixi","Krizzix",
  "Lauriel","Laville","Lindis","Lorion","Lu Bu","Lumburr","Maloch","Marja",
  "Max","Mganga","Mina","Ming","Moren","Murad","Nakroth","Natalya","Omen",
  "Ormarr","Paine","Preyta","Qi","Quillen","Raz","Riktor","Rouie","Rourke",
  "Roxie","Ryoma","Sephera","Sinestrea","Skud","Slimz","Stuart","Taara","Tachi",
  "Teeri","Tel'Annas","Thane","Thorne","Toro","Tulen","Valhein","Veera","Veres",
  "Violet","Volkath","Wisp","Wukong","Xeniel","Y'bneth","Yan","Yena","Yorn",
  "Yue","Zanis","Zata","Zephys","Zill","Zip","Zuka",
].sort();

const ROLE_COLORS = {
  Slayer:"#e17055", Jungle:"#00b894", Mid:"#6C5CE7",
  Abyssal:"#fdcb6e", Support:"#74b9ff",
};
const TEAM_COLORS = { our:"#00cec9", enemy:"#fd79a8" };


const TOOLS = [
  { id:"select",  icon:"↖",   label:"Select"   },
  { id:"pen",     icon:"✏️",  label:"Pen"      },
  { id:"arrow",   icon:"→",   label:"Arrow"    },
  { id:"text",    icon:"T",   label:"Text"     },
  { id:"hero",    icon:"🦸",  label:"Hero"     },
  { id:"erase",   icon:"⌫",   label:"Erase"    },
];

const COLORS = ["#ffffff","#00cec9","#fd79a8","#fdcb6e","#e17055","#6C5CE7","#00b894","#ff4757","#2196f3"];
const SIZES  = [2, 4, 8, 14];

// ═══════════════════════════════════════════
//  HERO ICON (letter avatar)
// ═══════════════════════════════════════════
function HeroAvatar({ name, team, size=40, style={} }) {
  const col = TEAM_COLORS[team] || TEAM_COLORS.our;
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:col+"30", border:`2.5px solid ${col}`,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontSize:size*0.28, fontWeight:900, color:col,
      userSelect:"none", flexShrink:0,
      ...style,
    }}>
      <div style={{lineHeight:1}}>{name.charAt(0)}</div>
      <div style={{fontSize:size*0.18,fontWeight:700,color:col+"cc",lineHeight:1,
        maxWidth:size-4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
        textAlign:"center"}}>
        {name.length>6?name.slice(0,5)+"…":name}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════
function TacticalWhiteboard() {
  const canvasRef    = useRef(null);
  const overlayRef   = useRef(null); // for drawing preview
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // ── tool state ──
  const [tool,       setTool]       = useState("pen");
  const [color,      setColor]      = useState("#00cec9");
  const [size,       setSize]       = useState(4);
  const [heroTeam,   setHeroTeam]   = useState("our");
  const [heroSearch, setHeroSearch] = useState("");
  const [showHeroPicker, setShowHeroPicker] = useState(false);

  // ── canvas state ──
  const [mapImg,     setMapImg]     = useState(null); // background image dataURL
  const [elements,   setElements]   = useState([]);   // drawn elements
  const [history,    setHistory]    = useState([]);   // undo stack
  const [formations, setFormations] = useState([]); // saved formations
  const [showFormations, setShowFormations] = useState(false);

  // ── drawing state ──
  const drawing    = useRef(false);
  const startPt    = useRef(null);
  const currentPath= useRef([]);

  // ── text input state ──
  const [textMode,   setTextMode]   = useState(false);
  const [textPos,    setTextPos]    = useState(null);
  const [textVal,    setTextVal]    = useState("");

  // ── selected element ──
  const [selected,   setSelected]   = useState(null);
  const [dragging,   setDragging]   = useState(false);
  const dragStart    = useRef(null);

  const canvasW = 800, canvasH = 600;

  // ── redraw canvas ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasW, canvasH);

    // background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // map image
    if (mapImg) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        drawElements(ctx);
      };
      img.src = mapImg;
    } else {
      // placeholder grid
      ctx.strokeStyle = "#1e1640";
      ctx.lineWidth = 1;
      for (let x=0; x<=canvasW; x+=50) {
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvasH); ctx.stroke();
      }
      for (let y=0; y<=canvasH; y+=50) {
        ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvasW,y); ctx.stroke();
      }
      ctx.fillStyle = "#2a2550";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("อัพโหลดรูปแมพ RoV ด้านบน", canvasW/2, canvasH/2);
      drawElements(ctx);
    }
  }, [mapImg, elements, selected]);

  function drawElements(ctx) {
    elements.forEach((el, idx) => {
      const isSel = selected === idx;
      ctx.save();
      if (el.type === "path") {
        ctx.strokeStyle = el.color;
        ctx.lineWidth   = el.size;
        ctx.lineCap     = "round";
        ctx.lineJoin    = "round";
        ctx.beginPath();
        el.points.forEach((p, i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
        ctx.stroke();
        if (isSel) {
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
          ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (el.type === "arrow") {
        drawArrow(ctx, el.x1, el.y1, el.x2, el.y2, el.color, el.size);
        if (isSel) {
          ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
          drawArrow(ctx, el.x1, el.y1, el.x2, el.y2, "#fff", 1);
          ctx.setLineDash([]);
        }
      } else if (el.type === "text") {
        ctx.font      = `${el.size*3+10}px 'Segoe UI', sans-serif`;
        ctx.fillStyle = el.color;
        ctx.textBaseline = "top";
        ctx.fillText(el.text, el.x, el.y);
        if (isSel) {
          const m = ctx.measureText(el.text);
          ctx.strokeStyle="#fff"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
          ctx.strokeRect(el.x-2, el.y-2, m.width+4, el.size*3+14);
          ctx.setLineDash([]);
        }
      } else if (el.type === "hero") {
        // draw circle with letter
        const col = TEAM_COLORS[el.team] || TEAM_COLORS.our;
        const r   = el.r || 22;
        ctx.fillStyle   = col+"40";
        ctx.strokeStyle = col;
        ctx.lineWidth   = isSel ? 3 : 2;
        ctx.beginPath(); ctx.arc(el.x, el.y, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle   = col;
        ctx.font        = `bold ${r*0.55}px 'Segoe UI', sans-serif`;
        ctx.textAlign   = "center";
        ctx.textBaseline= "middle";
        ctx.fillText(el.name.charAt(0), el.x, el.y-4);
        ctx.font        = `${r*0.35}px 'Segoe UI', sans-serif`;
        const short = el.name.length>5 ? el.name.slice(0,5)+"…" : el.name;
        ctx.fillText(short, el.x, el.y+r*0.45);
        ctx.textAlign = "left";
      }
      ctx.restore();
    });
  }

  function drawArrow(ctx, x1, y1, x2, y2, col, w) {
    const headLen = Math.max(14, w*4);
    const angle   = Math.atan2(y2-y1, x2-x1);
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth   = w; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2-headLen*Math.cos(angle-Math.PI/6), y2-headLen*Math.sin(angle-Math.PI/6));
    ctx.lineTo(x2-headLen*Math.cos(angle+Math.PI/6), y2-headLen*Math.sin(angle+Math.PI/6));
    ctx.closePath(); ctx.fill();
  }

  useEffect(() => { redraw(); }, [redraw]);

  // ── canvas coords ──
  function getPos(e) {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  // ── hit test ──
  function hitTest(pos) {
    for (let i = elements.length-1; i >= 0; i--) {
      const el = elements[i];
      if (el.type==="hero") {
        const r = el.r||22;
        if (Math.hypot(pos.x-el.x, pos.y-el.y) <= r) return i;
      } else if (el.type==="text") {
        const canvas=canvasRef.current; const ctx=canvas.getContext("2d");
        ctx.font=`${el.size*3+10}px 'Segoe UI', sans-serif`;
        const w=ctx.measureText(el.text).width, h=el.size*3+14;
        if (pos.x>=el.x-2&&pos.x<=el.x+w+2&&pos.y>=el.y-2&&pos.y<=el.y+h) return i;
      } else if (el.type==="path") {
        for (let j=0;j<el.points.length-1;j++){
          const p1=el.points[j], p2=el.points[j+1];
          const d=distToSegment(pos, p1, p2);
          if (d <= Math.max(el.size+4, 8)) return i;
        }
      } else if (el.type==="arrow") {
        const d=distToSegment(pos, {x:el.x1,y:el.y1}, {x:el.x2,y:el.y2});
        if (d <= Math.max(el.size+4, 8)) return i;
      }
    }
    return null;
  }

  function distToSegment(p, a, b) {
    const dx=b.x-a.x, dy=b.y-a.y, len2=dx*dx+dy*dy;
    if (len2===0) return Math.hypot(p.x-a.x, p.y-a.y);
    let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
    t=Math.max(0,Math.min(1,t));
    return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
  }

  // ── mouse handlers ──
  function onMouseDown(e) {
    if (textMode) return;
    const pos = getPos(e);

    if (tool==="select") {
      const hit = hitTest(pos);
      setSelected(hit);
      if (hit!==null) {
        setDragging(true);
        dragStart.current = { pos, el: {...elements[hit]} };
      }
      return;
    }
    if (tool==="erase") {
      const hit = hitTest(pos);
      if (hit!==null) deleteElement(hit);
      return;
    }
    if (tool==="text") {
      setTextPos(pos); setTextVal(""); setTextMode(true);
      setTimeout(()=>textInputRef.current?.focus(), 50);
      return;
    }
    if (tool==="hero") { setShowHeroPicker(true); return; }

    drawing.current = true;
    startPt.current = pos;
    if (tool==="pen") currentPath.current = [pos];
  }

  function onMouseMove(e) {
    if (!drawing.current && !dragging) return;
    const pos = getPos(e);

    if (dragging && selected!==null) {
      const orig = dragStart.current;
      const dx=pos.x-orig.pos.x, dy=pos.y-orig.pos.y;
      const el = orig.el;
      const updated = elements.map((item,i)=>{
        if (i!==selected) return item;
        if (item.type==="hero"||item.type==="text") return {...item, x:el.x+dx, y:el.y+dy};
        if (item.type==="arrow") return {...item, x1:el.x1+dx,y1:el.y1+dy, x2:el.x2+dx,y2:el.y2+dy};
        if (item.type==="path") return {...item, points:el.points.map(p=>({x:p.x+dx,y:p.y+dy}))};
        return item;
      });
      setElements(updated);
      return;
    }

    if (tool==="pen") {
      currentPath.current.push(pos);
      // preview on overlay
      const ov=overlayRef.current; if(!ov) return;
      const ctx=ov.getContext("2d");
      ctx.clearRect(0,0,canvasW,canvasH);
      ctx.strokeStyle=color; ctx.lineWidth=size; ctx.lineCap="round"; ctx.lineJoin="round";
      ctx.beginPath();
      currentPath.current.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
      ctx.stroke();
    } else if (tool==="arrow") {
      const ov=overlayRef.current; if(!ov) return;
      const ctx=ov.getContext("2d");
      ctx.clearRect(0,0,canvasW,canvasH);
      drawArrow(ctx, startPt.current.x, startPt.current.y, pos.x, pos.y, color, size);
    }
  }

  function onMouseUp(e) {
    if (dragging) {
      setDragging(false); dragStart.current=null;
      pushHistory(); return;
    }
    if (!drawing.current) return;
    drawing.current=false;
    const pos=getPos(e);
    const ov=overlayRef.current;
    if(ov) ov.getContext("2d").clearRect(0,0,canvasW,canvasH);

    if (tool==="pen" && currentPath.current.length>1) {
      pushHistory();
      setElements(prev=>[...prev,{type:"path",points:currentPath.current,color,size}]);
    } else if (tool==="arrow") {
      pushHistory();
      setElements(prev=>[...prev,{type:"arrow",x1:startPt.current.x,y1:startPt.current.y,x2:pos.x,y2:pos.y,color,size}]);
    }
    currentPath.current=[];
  }

  function commitText() {
    if (textVal.trim()) {
      pushHistory();
      setElements(prev=>[...prev,{type:"text",x:textPos.x,y:textPos.y,text:textVal,color,size}]);
    }
    setTextMode(false); setTextVal(""); setTextPos(null);
  }

  function placeHero(name) {
    const pos = { x: canvasW/2 + (Math.random()-0.5)*100, y: canvasH/2 + (Math.random()-0.5)*80 };
    pushHistory();
    setElements(prev=>[...prev,{type:"hero",x:pos.x,y:pos.y,name,team:heroTeam,r:22}]);
    setShowHeroPicker(false); setHeroSearch("");
  }

  function deleteElement(idx) {
    pushHistory();
    setElements(prev=>prev.filter((_,i)=>i!==idx));
    setSelected(null);
  }

  function pushHistory() {
    setHistory(prev=>[...prev.slice(-29), elements]);
  }

  function undo() {
    if (!history.length) return;
    setElements(history[history.length-1]);
    setHistory(prev=>prev.slice(0,-1));
    setSelected(null);
  }

  function clearAll() {
    if (!window.confirm("ล้าง canvas ทั้งหมด?")) return;
    pushHistory(); setElements([]); setSelected(null);
  }

  function saveFormation() {
    const name = prompt("ชื่อ Formation นี้:");
    if (!name?.trim()) return;
    setFormations(prev=>[...prev,{name:name.trim(), elements:[...elements], time:new Date().toLocaleString("th-TH")}]);
  }

  function loadFormation(f) {
    pushHistory(); setElements([...f.elements]); setShowFormations(false);
  }

  function downloadCanvas() {
    // flatten canvas + overlay into one image
    const out = document.createElement("canvas");
    out.width=canvasW; out.height=canvasH;
    const ctx=out.getContext("2d");
    ctx.drawImage(canvasRef.current,0,0);
    const a=document.createElement("a");
    a.download=`formation_${Date.now()}.png`;
    a.href=out.toDataURL("image/png");
    a.click();
  }

  function handleMapUpload(e) {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>setMapImg(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value="";
  }

  const filteredHeroes = HERO_LIST.filter(h=>h.toLowerCase().includes(heroSearch.toLowerCase()));

  return (
    <div style={{height:"calc(100vh - 114px)",background:C.bg,color:C.textMain,
      fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(90deg,#12072a,#0a0a16)",
        borderBottom:`1px solid ${C.border}`,padding:"0 20px",
        display:"flex",alignItems:"center",height:54,gap:14,flexShrink:0}}>
        <span style={{fontSize:20}}>🗺️</span>
        <span style={{fontWeight:900,fontSize:16,letterSpacing:2,color:C.primaryLight}}>
          RoV TACTICAL WHITEBOARD
        </span>
        <div style={{flex:1}}/>
        {/* map upload */}
        <label style={{background:C.primary+"30",border:`1px solid ${C.primary}60`,
          color:C.primaryLight,borderRadius:8,padding:"5px 14px",cursor:"pointer",
          fontSize:12,fontWeight:700}}>
          📂 อัพโหลดแมพ
          <input type="file" accept="image/*" style={{display:"none"}}
            ref={fileInputRef} onChange={handleMapUpload}/>
        </label>
        <button onClick={saveFormation}
          style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
            padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          💾 บันทึก Formation
        </button>
        <button onClick={()=>setShowFormations(v=>!v)}
          style={{background:showFormations?C.primary+"40":"transparent",
            border:`1px solid ${C.primary}60`,color:C.primaryLight,borderRadius:8,
            padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          📋 Formations ({formations.length})
        </button>
        <button onClick={downloadCanvas}
          style={{background:"#00b89430",border:`1px solid #00b89460`,
            color:"#00b894",borderRadius:8,padding:"5px 14px",cursor:"pointer",
            fontSize:12,fontWeight:700}}>
          ⬇️ Export PNG
        </button>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT TOOLBAR ── */}
        <div style={{width:64,background:C.panel,borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0",gap:4}}>
          {TOOLS.map(t=>(
            <button key={t.id} onClick={()=>{setTool(t.id);setSelected(null);setTextMode(false);}}
              title={t.label}
              style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:18,
                display:"flex",alignItems:"center",justifyContent:"center",
                background:tool===t.id?C.primary+"50":"transparent",
                border:`1.5px solid ${tool===t.id?C.primary:C.border}`,
                color:tool===t.id?C.primaryLight:C.textMuted}}>
              {t.icon}
            </button>
          ))}
          <div style={{height:1,width:40,background:C.border,margin:"6px 0"}}/>
          <button onClick={undo} title="Undo"
            style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"transparent",border:`1.5px solid ${C.border}`,color:C.textMuted}}>
            ↩
          </button>
          <button onClick={clearAll} title="Clear All"
            style={{width:44,height:44,borderRadius:10,cursor:"pointer",fontSize:16,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:"transparent",border:`1.5px solid #ff475740`,color:"#ff4757"}}>
            🗑️
          </button>
        </div>

        {/* ── CANVAS AREA ── */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
          background:"#080612",position:"relative",overflow:"hidden"}}>
          <div style={{position:"relative",
            boxShadow:"0 8px 40px rgba(0,0,0,0.6)",
            borderRadius:4,overflow:"hidden"}}>
            {/* main canvas */}
            <canvas ref={canvasRef} width={canvasW} height={canvasH}
              style={{display:"block",maxWidth:"100%",maxHeight:"calc(100vh - 174px)",
                cursor:tool==="pen"?"crosshair":tool==="arrow"?"crosshair":
                       tool==="text"?"text":tool==="erase"?"cell":
                       tool==="hero"?"copy":"default"}}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            />
            {/* overlay canvas for live preview */}
            <canvas ref={overlayRef} width={canvasW} height={canvasH}
              style={{position:"absolute",top:0,left:0,pointerEvents:"none",
                maxWidth:"100%",maxHeight:"calc(100vh - 174px)"}}
            />
            {/* text input overlay */}
            {textMode && textPos && (
              <div style={{position:"absolute",
                left:`${(textPos.x/canvasW)*100}%`,
                top:`${(textPos.y/canvasH)*100}%`,
                transform:"translate(0,-50%)"}}>
                <input ref={textInputRef}
                  value={textVal} onChange={e=>setTextVal(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter")commitText(); if(e.key==="Escape"){setTextMode(false);setTextVal("");} }}
                  onBlur={commitText}
                  style={{background:"rgba(20,17,42,0.92)",border:`1px solid ${C.primary}`,
                    color:color,borderRadius:4,padding:"3px 8px",
                    fontSize:`${size*3+10}px`,outline:"none",minWidth:100,fontWeight:700}}
                  placeholder="พิมพ์ข้อความ..."/>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{width:220,background:C.panel,borderLeft:`1px solid ${C.border}`,
          padding:"14px 12px",display:"flex",flexDirection:"column",gap:14,overflowY:"auto"}}>

          {/* Tool info */}
          <div>
            <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8,letterSpacing:1}}>
              TOOL: {TOOLS.find(t=>t.id===tool)?.label?.toUpperCase()}
            </div>

            {/* color picker */}
            {["pen","arrow","text"].includes(tool)&&(
              <>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>สี</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>setColor(c)}
                      style={{width:22,height:22,borderRadius:"50%",background:c,cursor:"pointer",
                        border:`2.5px solid ${color===c?"#fff":"transparent"}`,
                        boxShadow:color===c?"0 0 6px #fff6":"none"}}/>
                  ))}
                </div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ขนาด</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {SIZES.map(s=>(
                    <div key={s} onClick={()=>setSize(s)}
                      style={{width:28,height:28,borderRadius:6,background:size===s?C.primary+"40":"transparent",
                        border:`1.5px solid ${size===s?C.primary:C.border}`,
                        display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                      <div style={{width:s*1.5,height:s*1.5,borderRadius:"50%",background:color}}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* hero team selector */}
            {tool==="hero"&&(
              <>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ทีม</div>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {[{id:"our",label:"🛡️ เรา",col:TEAM_COLORS.our},
                    {id:"enemy",label:"⚔️ คู่แข่ง",col:TEAM_COLORS.enemy}].map(t=>(
                    <button key={t.id} onClick={()=>setHeroTeam(t.id)}
                      style={{flex:1,background:heroTeam===t.id?t.col+"30":"transparent",
                        border:`1.5px solid ${heroTeam===t.id?t.col:C.border}`,
                        color:heroTeam===t.id?t.col:C.textMuted,
                        borderRadius:8,padding:"5px 4px",cursor:"pointer",fontSize:10,fontWeight:700}}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowHeroPicker(true)}
                  style={{width:"100%",background:C.primary,color:"#fff",border:"none",
                    borderRadius:8,padding:"7px 0",cursor:"pointer",fontSize:12,fontWeight:800}}>
                  + วาง Hero บนแมพ
                </button>
              </>
            )}

            {/* select tool actions */}
            {tool==="select"&&selected!==null&&(
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,color:C.primaryLight,fontWeight:700,marginBottom:8}}>
                  เลือก element #{selected+1}
                </div>
                <button onClick={()=>deleteElement(selected)}
                  style={{width:"100%",background:"#ff475720",border:"1px solid #ff475740",
                    color:"#ff4757",borderRadius:7,padding:"6px 0",cursor:"pointer",
                    fontSize:12,fontWeight:700}}>
                  🗑️ ลบ element นี้
                </button>
              </div>
            )}
          </div>

          {/* On-canvas heroes list */}
          {elements.filter(e=>e.type==="hero").length>0&&(
            <div>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:8,letterSpacing:1}}>
                HEROES บนแมพ
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {elements.map((el,i)=>el.type!=="hero"?null:(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,
                    background:C.card,borderRadius:8,padding:"5px 8px",
                    border:`1px solid ${selected===i?TEAM_COLORS[el.team]:C.border}`,
                    cursor:"pointer"}}
                    onClick={()=>{setTool("select");setSelected(i);}}>
                    <HeroAvatar name={el.name} team={el.team} size={28}/>
                    <span style={{fontSize:11,fontWeight:700,flex:1,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{el.name}</span>
                    <button onClick={e=>{e.stopPropagation();deleteElement(i);}}
                      style={{background:"none",border:"none",color:"#ff4757",
                        cursor:"pointer",fontSize:13,padding:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* tips */}
          <div style={{fontSize:10,color:C.textMuted,lineHeight:1.7,marginTop:"auto",
            background:C.card,borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontWeight:700,color:C.primaryLight,marginBottom:4}}>💡 Tips</div>
            <div>✏️ วาดเส้นอิสระ</div>
            <div>→ วาดลูกศรทิศทาง</div>
            <div>T พิมพ์ข้อความ</div>
            <div>🦸 วาง Hero icon</div>
            <div>↖ Select & ย้าย</div>
            <div>⌫ ลบ element</div>
            <div>↩ Undo (toolbar)</div>
          </div>
        </div>
      </div>

      {/* ── HERO PICKER MODAL ── */}
      {showHeroPicker&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
            padding:20,width:420,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.primaryLight}}>
                เลือก Hero — {heroTeam==="our"?"🛡️ ทีมเรา":"⚔️ คู่แข่ง"}
              </h3>
              <button onClick={()=>{setShowHeroPicker(false);setHeroSearch("");}}
                style={{marginLeft:"auto",background:"none",border:"none",
                  color:C.textMuted,cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            <input value={heroSearch} onChange={e=>setHeroSearch(e.target.value)}
              placeholder="🔍 ค้นหา Hero..." autoFocus
              style={{background:C.card,border:`1px solid ${C.border}`,color:C.textMain,
                borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none",marginBottom:10}}/>
            <div style={{overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
              {filteredHeroes.map(h=>(
                <button key={h} onClick={()=>placeHero(h)}
                  style={{background:C.card,border:`1px solid ${C.border}`,
                    color:C.textMain,borderRadius:8,padding:"8px 4px",cursor:"pointer",
                    fontSize:11,fontWeight:700,textAlign:"center",
                    display:"flex",flexDirection:"column",alignItems:"center",gap:4}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=TEAM_COLORS[heroTeam]}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <HeroAvatar name={h} team={heroTeam} size={36}/>
                  <span style={{fontSize:9,lineHeight:1.2,overflow:"hidden",
                    textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",
                    textAlign:"center"}}>{h}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FORMATIONS PANEL ── */}
      {showFormations&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:998}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:16,
            padding:20,width:380,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <h3 style={{margin:0,fontSize:15,fontWeight:800,color:C.primaryLight}}>
                📋 Formations ที่บันทึกไว้
              </h3>
              <button onClick={()=>setShowFormations(false)}
                style={{marginLeft:"auto",background:"none",border:"none",
                  color:C.textMuted,cursor:"pointer",fontSize:20}}>✕</button>
            </div>
            {formations.length===0?(
              <div style={{textAlign:"center",padding:"30px 0",color:C.textMuted,fontSize:12}}>
                ยังไม่มี Formation — วาดแล้วกด "💾 บันทึก Formation"
              </div>
            ):(
              <div style={{overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
                {formations.map((f,i)=>(
                  <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,
                    borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:C.primaryLight}}>{f.name}</div>
                      <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>
                        {f.time} · {f.elements.length} elements
                      </div>
                    </div>
                    <button onClick={()=>loadFormation(f)}
                      style={{background:C.primary,color:"#fff",border:"none",
                        borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                      โหลด
                    </button>
                    <button onClick={()=>setFormations(prev=>prev.filter((_,j)=>j!==i))}
                      style={{background:"#ff475720",border:"1px solid #ff475740",color:"#ff4757",
                        borderRadius:7,padding:"5px 8px",cursor:"pointer",fontSize:11}}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════
//  VIDEO LIBRARY (merged module)
// ═══════════════════════════════════════════


const TAG_COLORS = {
  drill:"#6C5CE7", review:"#00cec9", scrim:"#fdcb6e",
  tutorial:"#00b894", highlight:"#e17055",
};

const TAGS = ["drill","review","scrim","tutorial","highlight"];

// detect YouTube/video URL type
function getVideoInfo(url) {
  try {
    const u = url.trim();
    const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return { type:"youtube", id:ytMatch[1] };
    if (u.startsWith("blob:") || /\.(mp4|webm|mov|avi|mkv)$/i.test(u)) return { type:"video", url:u };
    if (u.startsWith("http")) return { type:"iframe", url:u };
    return null;
  } catch { return null; }
}

function VideoEmbed({ src, title }) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const info = getVideoInfo(src);

  if (!info) return (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#080614",
      borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
      color:C.textMuted,fontSize:12}}>
      ❌ URL ไม่ถูกต้อง
    </div>
  );

  const YouTubeFallback = ({ url }) => (
    <div style={{width:"100%",aspectRatio:"16/9",background:"#0f0f0f",
      borderRadius:8,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:14}}>
      <div style={{fontSize:36}}>▶️</div>
      <div style={{fontSize:13,color:C.textMuted,textAlign:"center",padding:"0 20px"}}>
        วิดีโอนี้ไม่อนุญาตให้ embed — คลิกเพื่อเปิดใน YouTube
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
        style={{background:"#ff0000",color:"#fff",borderRadius:8,
          padding:"9px 22px",fontWeight:700,fontSize:13,
          textDecoration:"none",display:"flex",alignItems:"center",gap:8}}>
        🔗 เปิดใน YouTube
      </a>
    </div>
  );

  if (info.type==="youtube") {
    if (embedFailed) return <YouTubeFallback url={src}/>;
    return (
      <iframe
        style={{width:"100%",aspectRatio:"16/9",border:"none",borderRadius:8}}
        src={`https://www.youtube.com/embed/${info.id}?rel=0`}
        title={title} allowFullScreen
        onError={()=>setEmbedFailed(true)}/>
    );
  }
  if (info.type==="video") return (
    <video controls style={{width:"100%",aspectRatio:"16/9",borderRadius:8,background:"#000"}}>
      <source src={src}/>
    </video>
  );
  return (
    <iframe src={src} title={title}
      style={{width:"100%",aspectRatio:"16/9",border:"none",borderRadius:8}}
      allowFullScreen/>
  );
}

function VideoCard({ v, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({...v});

  function saveEdit() {
    onEdit(editData); setEditing(false);
  }

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,
      overflow:"hidden",borderLeft:`4px solid ${C.primary}`}}>
      {/* header */}
      <div onClick={()=>setOpen(p=>!p)}
        style={{padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{fontSize:18}}>🎬</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:800,fontSize:14,color:C.primaryLight,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.title}</div>
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
            {v.rival&&<span style={{fontSize:10,fontWeight:700,color:C.lose}}>vs {v.rival}</span>}
            {v.date&&<span style={{fontSize:10,color:C.textMuted}}>{v.date}</span>}
            {(v.tags||[]).map(t=>(
              <span key={t} style={{fontSize:9,padding:"1px 7px",borderRadius:99,fontWeight:700,
                background:(TAG_COLORS[t]||C.primary)+"20",color:TAG_COLORS[t]||C.primary}}>
                {t}
              </span>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={e=>{e.stopPropagation();setEditing(p=>!p);}}
            style={{background:C.card,border:`1px solid ${C.border}`,color:C.textMuted,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11}}>
            ✏️
          </button>
          <button onClick={e=>{e.stopPropagation();if(window.confirm("ลบวิดีโอนี้?"))onDelete();}}
            style={{background:C.lose+"20",border:`1px solid ${C.lose}30`,color:C.lose,
              borderRadius:7,padding:"3px 10px",cursor:"pointer",fontSize:11}}>
            🗑️
          </button>
          <span style={{color:C.textMuted,fontSize:13}}>{open?"▲":"▼"}</span>
        </div>
      </div>

      {editing&&(
        <div style={{padding:"0 16px 16px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[{label:"ชื่อวิดีโอ",key:"title"},{label:"ทีมคู่แข่ง",key:"rival"},
              {label:"วันที่",key:"date"},{label:"URL / Link",key:"url"}].map(f=>(
              <div key={f.key}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>{f.label}</div>
                <input value={editData[f.key]||""} onChange={e=>setEditData(p=>({...p,[f.key]:e.target.value}))}
                  style={iStyle}/>
              </div>
            ))}
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Tags</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {TAGS.map(t=>(
                <button key={t} onClick={()=>setEditData(p=>({...p,
                  tags:(p.tags||[]).includes(t)?(p.tags||[]).filter(x=>x!==t):[...(p.tags||[]),t]}))}
                  style={{background:(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary)+"30":"transparent",
                    border:`1px solid ${(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.border}`,
                    color:(editData.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.textMuted,
                    borderRadius:99,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Note</div>
            <textarea value={editData.note||""} onChange={e=>setEditData(p=>({...p,note:e.target.value}))}
              rows={2} style={{...iStyle,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={saveEdit}
              style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                padding:"6px 18px",cursor:"pointer",fontWeight:700,fontSize:12}}>
              ✅ บันทึก
            </button>
            <button onClick={()=>setEditing(false)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12}}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {open&&!editing&&(
        <div style={{padding:"0 16px 16px"}}>
          <VideoEmbed src={v.url} title={v.title}/>
          {v.note&&(
            <div style={{marginTop:10,background:C.primary+"12",borderRadius:8,
              padding:"8px 12px",fontSize:12,color:C.primaryLight,lineHeight:1.6}}>
              📝 {v.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VideoLibrary() {
  const [videos,      setVideos]      = useState([]);
  const [showAdd,     setShowAdd]     = useState(false);
  const [filterTag,   setFilterTag]   = useState("all");
  const [filterRival, setFilterRival] = useState("");
  const [search,      setSearch]      = useState("");
  const fileInputRef  = useRef(null);

  const [form, setForm] = useState({
    title:"", url:"", rival:"", date:"", tags:[], note:"", type:"link",
  });

  function addVideo() {
    if (!form.title.trim()) { alert("กรุณากรอกชื่อวิดีโอ"); return; }
    if (!form.url.trim())   { alert("กรุณาใส่ URL หรืออัพโหลดไฟล์"); return; }
    const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
    setVideos(prev=>[{
      id:Date.now(), ...form,
      date: form.date || today,
    }, ...prev]);
    setForm({title:"",url:"",rival:"",date:"",tags:[],note:"",type:"link"});
    setShowAdd(false);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const url  = URL.createObjectURL(file);
    setForm(p=>({...p, url, title:p.title||file.name, type:"file"}));
    e.target.value="";
  }

  const rivals = [...new Set(videos.filter(v=>v.rival).map(v=>v.rival))];

  const filtered = videos.filter(v=>{
    const matchTag   = filterTag==="all"   || (v.tags||[]).includes(filterTag);
    const matchRival = !filterRival        || v.rival===filterRival;
    const matchSearch= !search             ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      (v.note||"").toLowerCase().includes(search.toLowerCase()) ||
      (v.rival||"").toLowerCase().includes(search.toLowerCase());
    return matchTag && matchRival && matchSearch;
  });

  return (
    <div>
      {/* page header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
        <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🎬 Video Library</h2>
        <span style={{background:C.primary,color:"#fff",fontSize:10,padding:"2px 8px",
          borderRadius:99,fontWeight:700}}>{videos.length} วิดีโอ</span>
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{marginLeft:"auto",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:9,padding:"7px 18px",
            cursor:"pointer",fontWeight:800,fontSize:13}}>
          + เพิ่มวิดีโอ
        </button>
      </div>
      <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
        เก็บวิดีโอซ้อม / scrim review / tutorial ไว้ดูซ้ำได้
      </p>

      <div style={{maxWidth:1100}}>

        {/* ADD FORM */}
        {showAdd&&(
          <div style={{background:C.panel,border:`1px solid ${C.border}`,
            borderRadius:16,padding:20,marginBottom:20}}>
            <h3 style={{margin:"0 0 16px",fontSize:16,fontWeight:800,color:C.primaryLight}}>
              + เพิ่มวิดีโอใหม่
            </h3>
            {/* type toggle */}
            <div style={{display:"flex",gap:3,background:C.bg,borderRadius:8,padding:3,
              border:`1px solid ${C.border}`,width:"fit-content",marginBottom:14}}>
              {[{id:"link",label:"🔗 ใส่ Link URL"},{id:"file",label:"📂 อัพโหลดไฟล์"}].map(t=>(
                <button key={t.id} onClick={()=>setForm(p=>({...p,type:t.id,url:""}))}
                  style={{background:form.type===t.id?C.primary:"transparent",
                    border:"none",color:form.type===t.id?"#fff":C.textMuted,
                    borderRadius:6,padding:"5px 16px",cursor:"pointer",fontWeight:700,fontSize:12}}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>ชื่อวิดีโอ *</div>
                <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                  placeholder="เช่น Scrim vs Alpha BO3 Game1" style={iStyle}/>
              </div>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>ทีมคู่แข่ง</div>
                <input value={form.rival} onChange={e=>setForm(p=>({...p,rival:e.target.value}))}
                  placeholder="เช่น Alpha Wolves" style={iStyle}/>
              </div>
              <div>
                {form.type==="link" ? (
                  <>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>
                      YouTube URL / Link วิดีโอ *
                    </div>
                    <input value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))}
                      placeholder="https://youtube.com/watch?v=..." style={iStyle}/>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>อัพโหลดไฟล์วิดีโอ *</div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <label style={{flex:1,background:C.card,border:`1px dashed ${C.border}`,
                        color:C.textMuted,borderRadius:8,padding:"8px 12px",cursor:"pointer",
                        fontSize:12,textAlign:"center"}}>
                        {form.url ? "✅ ไฟล์พร้อมแล้ว" : "คลิกเลือกไฟล์..."}
                        <input ref={fileInputRef} type="file" accept="video/*"
                          style={{display:"none"}} onChange={handleFileUpload}/>
                      </label>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>วันที่</div>
                <input value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                  placeholder="เช่น 15 มิ.ย. 2568" style={iStyle}/>
              </div>
            </div>

            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Tags</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {TAGS.map(t=>(
                  <button key={t} onClick={()=>setForm(p=>({...p,
                    tags:(p.tags||[]).includes(t)?(p.tags||[]).filter(x=>x!==t):[...(p.tags||[]),t]}))}
                    style={{background:(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary)+"30":"transparent",
                      border:`1px solid ${(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.border}`,
                      color:(form.tags||[]).includes(t)?(TAG_COLORS[t]||C.primary):C.textMuted,
                      borderRadius:99,padding:"4px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Note / วิเคราะห์</div>
              <textarea value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
                rows={2} placeholder="จุดสังเกต, ช่วงเวลาสำคัญ..."
                style={{...iStyle,resize:"vertical"}}/>
            </div>

            {/* preview */}
            {form.url&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>Preview</div>
                <VideoEmbed src={form.url} title={form.title}/>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              <button onClick={addVideo}
                style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                  color:"#fff",border:"none",borderRadius:9,padding:"8px 24px",
                  cursor:"pointer",fontWeight:800,fontSize:13}}>
                ✅ เพิ่มวิดีโอ
              </button>
              <button onClick={()=>setShowAdd(false)}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textMuted,borderRadius:9,padding:"8px 18px",cursor:"pointer",fontSize:13}}>
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="🔍 ค้นหาวิดีโอ..."
            style={{...iStyle,flex:1,minWidth:180,padding:"7px 12px",fontSize:12}}/>
          {rivals.length>0&&(
            <select value={filterRival} onChange={e=>setFilterRival(e.target.value)}
              style={{...iStyle,width:170,padding:"7px 12px",fontSize:12}}>
              <option value="">— ทุกทีม —</option>
              {rivals.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <div style={{display:"flex",gap:4}}>
            {["all",...TAGS].map(t=>(
              <button key={t} onClick={()=>setFilterTag(t)} style={{
                background:filterTag===t?(t==="all"?C.primary:TAG_COLORS[t]||C.primary)+"30":"transparent",
                border:`1px solid ${filterTag===t?(t==="all"?C.primary:TAG_COLORS[t]||C.primary):C.border}`,
                color:filterTag===t?(t==="all"?C.primaryLight:TAG_COLORS[t]||C.primary):C.textMuted,
                borderRadius:99,padding:"4px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>
                {t==="all"?"ทั้งหมด":t}
              </button>
            ))}
          </div>
        </div>

        {/* STATS ROW */}
        {videos.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
            {[
              {label:"🎬 ทั้งหมด",  val:videos.length,                            col:C.primaryLight},
              ...TAGS.map(t=>({
                label:t, val:videos.filter(v=>(v.tags||[]).includes(t)).length,
                col:TAG_COLORS[t]||C.primary,
              }))
            ].slice(0,5).map(s=>(
              <div key={s.label} style={{background:C.panel,border:`1px solid ${C.border}`,
                borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{s.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:s.col}}>{s.val}</div>
              </div>
            ))}
          </div>
        )}

        {/* VIDEO LIST */}
        {videos.length===0 ? (
          <div style={{textAlign:"center",padding:60,background:C.panel,borderRadius:14,color:C.textMuted}}>
            <div style={{fontSize:40,marginBottom:10}}>🎬</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>ยังไม่มีวิดีโอ</div>
            <div style={{fontSize:12}}>กด "+ เพิ่มวิดีโอ" เพื่อเริ่ม</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:"center",padding:40,background:C.panel,borderRadius:12,
            color:C.textMuted,fontSize:12}}>
            ไม่พบวิดีโอที่ตรงกับ filter
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(v=>(
              <VideoCard key={v.id} v={v}
                onDelete={()=>setVideos(prev=>prev.filter(x=>x.id!==v.id))}
                onEdit={updated=>setVideos(prev=>prev.map(x=>x.id===v.id?{...x,...updated}:x))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  REDUCERS
// ═══════════════════════════════════════════

// ── 1. APP REDUCER — persistent data ──────
const APP_INIT = {
  matches:      null,   // loaded lazily from localStorage
  rivals:       null,
  roster:       null,
  enemyRosters: null,
};

// ── App state defaults (actual load/save now goes through lib/storage.js,
//    which talks to the real Postgres-backed /api/data route) ──

function defaultAppState() {
  return {
    matches:       [],
    rivals:        [],
    roster:        ["Player 1","Player 2"],
    enemyRosters:  {},
    scoutMatches:  [],
    playerPhotos:  {}, // { "our:Name": dataURL|URL, "enemy:Team:Name": dataURL|URL }
    heroPhotos:    {}, // { "HeroName": dataURL } — user-uploaded hero images, overrides web lookup
    customHeroes:  [], // [{name, role, img}] — heroes added by the user (future patches/new releases)
    roleOverrides: {}, // { "HeroName": "Role" } — role edits for ANY hero (built-in or custom)
  };
}

function initAppState() {
  // sync default — actual data is hydrated async via loadFromStorage()
  return { ...defaultAppState(), _loaded: false };
}

function appReducer(state, action) {
  switch (action.type) {

    case "LOAD_FROM_STORAGE":
      return { ...action.payload };

    case "SAVE_MATCH": {
      const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
      const m = { id: Date.now(), date: today, ...action.payload };
      const rivals = state.rivals.find(r => r.name === action.payload.rivalName)
        ? state.rivals
        : [...state.rivals, { id: Date.now()+1, name: action.payload.rivalName }];
      return { ...state, matches: [m, ...state.matches], rivals };
    }

    case "UPDATE_STATS": {
      const { matchId, gameIdx, gameStats } = action.payload;
      const matches = state.matches.map(m => {
        if (m.id !== matchId) return m;
        if (gameIdx != null && Array.isArray(m.games)) {
          const games = [...m.games];
          games[gameIdx] = { ...games[gameIdx], gameStats };
          return { ...m, games };
        }
        return { ...m, gameStats };
      });
      return { ...state, matches };
    }

    case "ADD_PLAYER": {
      const name = action.payload.trim();
      if (!name || state.roster.includes(name)) return state;
      return { ...state, roster: [...state.roster, name] };
    }

    case "REMOVE_PLAYER": {
      const { [`our:${action.payload}`]: _omit, ...restPhotos } = state.playerPhotos;
      return { ...state, roster: state.roster.filter(p => p !== action.payload), playerPhotos: restPhotos };
    }

    case "ADD_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      const cur = state.enemyRosters[rivalName] || [];
      if (!playerName.trim() || cur.includes(playerName.trim())) return state;
      return {
        ...state,
        enemyRosters: { ...state.enemyRosters, [rivalName]: [...cur, playerName.trim()] },
      };
    }

    case "REMOVE_ENEMY_PLAYER": {
      const { rivalName, playerName } = action.payload;
      const { [`enemy:${rivalName}:${playerName}`]: _omit, ...restPhotos } = state.playerPhotos;
      return {
        ...state,
        enemyRosters: {
          ...state.enemyRosters,
          [rivalName]: (state.enemyRosters[rivalName] || []).filter(p => p !== playerName),
        },
        playerPhotos: restPhotos,
      };
    }

    case "SET_PHOTO": {
      // payload: { key, dataUrl }  key e.g. "our:Name" or "enemy:Team:Name"
      return { ...state, playerPhotos: { ...state.playerPhotos, [action.payload.key]: action.payload.dataUrl } };
    }

    case "REMOVE_PHOTO": {
      const { [action.payload]: _omit, ...rest } = state.playerPhotos;
      return { ...state, playerPhotos: rest };
    }

    case "SET_HERO_PHOTO": {
      // payload: { heroName, dataUrl }
      return { ...state, heroPhotos: { ...state.heroPhotos, [action.payload.heroName]: action.payload.dataUrl } };
    }

    case "SET_HERO_PHOTOS_BULK": {
      // payload: { [heroName]: dataUrl, ... }
      return { ...state, heroPhotos: { ...state.heroPhotos, ...action.payload } };
    }

    case "REMOVE_HERO_PHOTO": {
      const { [action.payload]: _omit, ...rest } = state.heroPhotos;
      return { ...state, heroPhotos: rest };
    }

    case "ADD_RIVAL": {
      const name = action.payload.trim();
      if (!name || state.rivals.some(r=>r.name.toLowerCase()===name.toLowerCase())) return state;
      return { ...state, rivals: [...state.rivals, { id: Date.now()+Math.random(), name }] };
    }

    case "ADD_CUSTOM_HERO": {
      // payload: { name, role, img? }
      const name = action.payload.name.trim();
      if (!name) return state;
      const exists = [...HERO_DATA, ...state.customHeroes].some(h=>h.name.toLowerCase()===name.toLowerCase());
      if (exists) return state; // don't add duplicates
      return { ...state, customHeroes: [...state.customHeroes, { name, role: action.payload.role, img: name.toLowerCase() }] };
    }

    case "SET_ROLE_OVERRIDE": {
      // payload: { heroName, role }
      return { ...state, roleOverrides: { ...state.roleOverrides, [action.payload.heroName]: action.payload.role } };
    }

    case "SAVE_SCOUT": {
      const today = new Date().toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
      const sm = { id: Date.now(), date: today, ...action.payload };
      // auto-add rivals if new
      const newRivals = [...state.rivals];
      [sm.teamA, sm.teamB].forEach(name => {
        if (name && !newRivals.find(r=>r.name===name))
          newRivals.push({ id: Date.now() + Math.random(), name });
      });
      return { ...state, scoutMatches: [sm, ...state.scoutMatches], rivals: newRivals };
    }

    case "DELETE_SCOUT":
      return { ...state, scoutMatches: state.scoutMatches.filter(s=>s.id!==action.payload) };

    case "MERGE_STATE":
      return { ...state, ...action.payload };

    default: return state;
  }
}

// ── 2. UI REDUCER — navigation & inputs ───
function initUIState() {
  return {
    page:           "overview",
    selRival:       null,
    rivalView:      "history",
    rosterTab:      "our",
    selPlayer:      null,
    selPlayerEnemy: false,
    selEnemyTeam:   null,
    newName:        "",
    newEnemyName:   "",
    scoutView:      null,   // null | "log" | "new"
  };
}

function uiReducer(state, action) {
  switch (action.type) {
    case "SET_PAGE":            return { ...state, page: action.payload, selRival: null };
    case "SET_SEL_RIVAL":       return { ...state, selRival: action.payload, rivalView: "history", scoutView: null };
    case "SET_RIVAL_VIEW":      return { ...state, rivalView: action.payload };
    case "SET_SCOUT_VIEW":      return { ...state, scoutView: action.payload };
    case "SET_ROSTER_TAB":      return { ...state, rosterTab: action.payload, selEnemyTeam: null };
    case "SET_SEL_PLAYER":      return { ...state, selPlayer: action.payload.name, selPlayerEnemy: action.payload.isEnemy };
    case "CLEAR_SEL_PLAYER":    return { ...state, selPlayer: null, selPlayerEnemy: false };
    case "SET_SEL_ENEMY_TEAM":  return { ...state, selEnemyTeam: action.payload };
    case "SET_NEW_NAME":        return { ...state, newName: action.payload };
    case "SET_NEW_ENEMY_NAME":  return { ...state, newEnemyName: action.payload };
    case "CLEAR_NEW_NAME":      return { ...state, newName: "" };
    case "CLEAR_NEW_ENEMY_NAME":return { ...state, newEnemyName: "" };
    default: return state;
  }
}

// ── 3. DRAFT REDUCER — entire draft session ──
function initDraftState() {
  return {
    stage:          "setup",   // setup | chooseSide | playing | done
    boType:         "BO3",
    rivalName:      "",
    ourSide:        null,
    currentGame:    1,
    completedGames: [],
    // SingleGameDraft sub-state
    step:           0,
    blueBans:       Array(4).fill(null),
    redBans:        Array(4).fill(null),
    bluePicks:      ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
    redPicks:       ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
    roleFilter:     "All",
    search:         "",
    meta:           { result:"WIN", ourScore:"", enemyScore:"", duration:"", note:"" },
  };
}

function draftReducer(state, action) {
  switch (action.type) {

    case "SETUP_SET_BO":       return { ...state, boType: action.payload };
    case "SETUP_SET_RIVAL":    return { ...state, rivalName: action.payload };
    case "SETUP_NEXT":         return { ...state, stage: "chooseSide" };

    case "CHOOSE_SIDE":
      return { ...state, ourSide: action.payload, stage: "playing" };

    case "BACK_TO_SETUP":
      return { ...initDraftState(), boType: state.boType };

    case "RESET":
      return initDraftState();

    // Hero selection
    case "SELECT_HERO": {
      const { hero, team, action: act, slot } = action.payload;
      if (act === "ban") {
        const key = team === "blue" ? "blueBans" : "redBans";
        const arr = [...state[key]]; arr[slot] = hero;
        return { ...state, [key]: arr, step: state.step + 1 };
      } else {
        const key = team === "blue" ? "bluePicks" : "redPicks";
        const arr = [...state[key]]; arr[slot] = { ...arr[slot], hero };
        return { ...state, [key]: arr, step: state.step + 1 };
      }
    }

    case "UNDO": {
      if (state.step === 0) return state;
      const prev = DRAFT_ORDER[state.step - 1];
      const { team, action: act, slot } = prev;
      if (act === "ban") {
        const key = team === "blue" ? "blueBans" : "redBans";
        const arr = [...state[key]]; arr[slot] = null;
        return { ...state, [key]: arr, step: state.step - 1 };
      } else {
        const key = team === "blue" ? "bluePicks" : "redPicks";
        const arr = [...state[key]]; arr[slot] = { ...arr[slot], hero: null };
        return { ...state, [key]: arr, step: state.step - 1 };
      }
    }

    case "SET_PLAYER": {
      const { team, idx, playerName } = action.payload;
      const key = team === "blue" ? "bluePicks" : "redPicks";
      const arr = [...state[key]];
      arr[idx] = { ...arr[idx], player: playerName };
      return { ...state, [key]: arr };
    }

    case "SET_ROLE_FILTER": return { ...state, roleFilter: action.payload };
    case "SET_SEARCH":      return { ...state, search: action.payload };
    case "SET_META":        return { ...state, meta: { ...state.meta, ...action.payload } };

    case "GAME_DONE": {
      // Note: when this was the LAST game of the BO series, the component
      // intercepts handleGameDone() and calls onFinishSession() directly
      // instead of dispatching here — see DraftPageR.handleGameDone().
      // This reducer case only ever runs for non-final games now, so it
      // always advances to the next game.
      const newGames = [...state.completedGames, { ...action.payload, gameNo: state.currentGame }];
      return {
        ...state,
        completedGames: newGames,
        currentGame: state.currentGame + 1,
        stage: "chooseSide",
        // reset board for next game
        step: 0,
        blueBans:  Array(4).fill(null),
        redBans:   Array(4).fill(null),
        bluePicks: ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        redPicks:  ROLES_PICK.map(r => ({ role: r, hero: null, player: "" })),
        meta: { result:"WIN", ourScore:"", enemyScore:"", duration:"", note:"" },
      };
    }

    case "FINISH_EARLY":
      return { ...state, stage: "done" };

    default: return state;
  }
}

// ═══════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════
export default function RovApp() {
  const { data: session } = useSession();
  const [app,  dispatchApp]  = useReducer(appReducer,  null, initAppState);
  const [ui,   dispatchUI]   = useReducer(uiReducer,   null, initUIState);
  const [draft, dispatchDraft]= useReducer(draftReducer, null, initDraftState);
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [heroDataVersion, setHeroDataVersion] = useState(0); // bump to force re-render after HERO_DATA mutation

  // ── load from Database on mount ──
  useEffect(() => {
    let cancelled = false;
    loadFromStorage().then(loaded => {
      if (!cancelled) dispatchApp({ type:"LOAD_FROM_STORAGE", payload: loaded });
    });
    return () => { cancelled = true; };
  }, []);

  // ── save to Database (debounced) whenever app data changes ──
  useEffect(() => {
    if (!app._loaded) return; // don't save until initial load completes
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      await saveToStorage(app);
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"), 1500);
    }, 600); // debounce: wait 600ms after last change before saving
    return () => clearTimeout(timer);
  }, [app]);

  // ── sync HERO_DATA (module-level array) with custom heroes + role overrides ──
  // HERO_DATA is referenced directly (HERO_DATA.filter/.find) in many places
  // throughout the app (draft hero grid, scout form, HeroChip lookups, etc).
  // Rather than thread a "all heroes" value through every one of those call
  // sites, we mutate the shared array in place once data loads/changes —
  // the array reference never changes, only its contents, which keeps all
  // existing .filter()/.find() callers working without modification.
  useEffect(() => {
    if (!app._loaded) return;
    // remove any previously-synced custom heroes, then re-add current ones
    for (let i = HERO_DATA.length - 1; i >= 0; i--) {
      if (HERO_DATA[i]._custom) HERO_DATA.splice(i, 1);
    }
    app.customHeroes.forEach(h => HERO_DATA.push({ ...h, _custom: true }));
    // apply role overrides to every hero (built-in or custom), keeping the
    // original role stashed so an override can be reverted cleanly later
    HERO_DATA.forEach(h => {
      if (h._origRole === undefined) h._origRole = h.role;
      h.role = app.roleOverrides[h.name] || h._origRole;
    });
    setHeroDataVersion(v => v + 1); // force re-render so HeroCard/HeroChip pick up new role/list
  }, [app.customHeroes, app.roleOverrides, app._loaded]);

  // ── derived: allGames flat list ──
  const allGames = app.matches.flatMap(m =>
    Array.isArray(m.games) && m.games.length > 0
      ? m.games.map((g, gi) => ({ ...g, rivalName:m.rivalName, date:m.date, _matchId:m.id, _gameIdx:gi }))
      : [{ ...m, _matchId:m.id, _gameIdx:null }]
  );

  // ── handlers (wrapped in useCallback for stable refs) ──
  const handleSaveMatch = useCallback((draftResult) => {
    dispatchApp({ type:"SAVE_MATCH", payload: draftResult });
    dispatchUI({ type:"SET_PAGE", payload:"matches" });
    dispatchDraft({ type:"RESET" });
  }, []);

  const handleUpdateStats = useCallback((matchId, gameIdx, gameStats) => {
    dispatchApp({ type:"UPDATE_STATS", payload:{ matchId, gameIdx, gameStats } });
  }, []);

  const [newPlayerPhoto,      setNewPlayerPhoto]      = useState(null);
  const [newEnemyPlayerPhoto, setNewEnemyPlayerPhoto]  = useState(null);
  const [showAddRival,        setShowAddRival]         = useState(false);
  const [newRivalName,        setNewRivalName]         = useState("");

  const handleAddPlayer = useCallback(() => {
    const name = ui.newName.trim();
    dispatchApp({ type:"ADD_PLAYER", payload: name });
    if (name && newPlayerPhoto) {
      dispatchApp({ type:"SET_PHOTO", payload:{ key:`our:${name}`, dataUrl:newPlayerPhoto } });
    }
    setNewPlayerPhoto(null);
    dispatchUI({ type:"CLEAR_NEW_NAME" });
  }, [ui.newName, newPlayerPhoto]);

  const handleRemovePlayer = useCallback((name) => {
    if (window.confirm(`ลบ ${name} ออกจากทีม?`))
      dispatchApp({ type:"REMOVE_PLAYER", payload: name });
  }, []);

  const handleAddEnemyPlayer = useCallback((rivalName) => {
    const name = ui.newEnemyName.trim();
    dispatchApp({ type:"ADD_ENEMY_PLAYER", payload:{ rivalName, playerName: name } });
    if (name && newEnemyPlayerPhoto) {
      dispatchApp({ type:"SET_PHOTO", payload:{ key:`enemy:${rivalName}:${name}`, dataUrl:newEnemyPlayerPhoto } });
    }
    setNewEnemyPlayerPhoto(null);
    dispatchUI({ type:"CLEAR_NEW_ENEMY_NAME" });
  }, [ui.newEnemyName, newEnemyPlayerPhoto]);

  const handleRemoveEnemyPlayer = useCallback((rivalName, playerName) => {
    if (window.confirm(`ลบ ${playerName} ออกจาก ${rivalName}?`))
      dispatchApp({ type:"REMOVE_ENEMY_PLAYER", payload:{ rivalName, playerName } });
  }, []);

  // ── draft: finish session ──
  function finishSession(games) {
    if (!games.length) { dispatchDraft({ type:"RESET" }); return; }
    handleSaveMatch({ rivalName:draft.rivalName, boType:draft.boType, games, ourSide:games[0].ourSide });
  }

  // ── overview stats ──
  const tG = allGames.length, tW = allGames.filter(g=>g.result==="WIN").length;
  const wr = tG ? Math.round(tW/tG*100) : 0;
  const uniq = new Set();
  allGames.forEach(g=>(g.ourPicks||[]).forEach(s=>{if(s.hero?.name)uniq.add(s.hero.name);}));
  const banCounts = {};
  allGames.forEach(g=>(g.ourBans||[]).forEach(h=>{if(h?.name)banCounts[h.name]=(banCounts[h.name]||0)+1;}));
  const top10 = Object.entries(banCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const heroSt = {};
  allGames.forEach(g=>{
    const w = g.result==="WIN";
    (g.ourPicks||[]).forEach(s=>{ if(s.hero?.name){
      if(!heroSt[s.hero.name]) heroSt[s.hero.name]={picks:0,wins:0};
      heroSt[s.hero.name].picks++;
      if(w) heroSt[s.hero.name].wins++;
    }});
  });
  const heroArr = Object.entries(heroSt)
    .map(([h,s])=>({hero:h,picks:s.picks,wr:Math.round(s.wins/s.picks*100)}))
    .sort((a,b)=>b.picks-a.picks);

  const NAV = [
    {id:"overview",icon:"📊",label:"Overview"},
    {id:"draft",   icon:"⚔️",label:"Live Draft"},
    {id:"matches", icon:"📋",label:"Match Log"},
    {id:"rivals",  icon:"🎯",label:"Rivals"},
    {id:"roster",  icon:"👥",label:"Roster"},
    {id:"notes",   icon:"📝",label:"Notes"},
    {id:"video",   icon:"🎬",label:"Video"},
    {id:"board",   icon:"🗺️",label:"Whiteboard"},
    {id:"heroimg", icon:"🦸",label:"Hero Images"},
  ];

  // ── short aliases for readability ──
  const { page, selRival, rivalView, rosterTab, selPlayer, selPlayerEnemy,
          selEnemyTeam, newName, newEnemyName } = ui;
  const { matches, rivals, roster, enemyRosters, scoutMatches } = app;

  // ── loading screen until Database hydration completes ──
  if (!app._loaded) {
    return (
      <div style={{minHeight:"100vh",background:C.bgBase,color:C.textMain,
        display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        gap:14,fontFamily:"'Segoe UI',sans-serif"}}>
        <div style={{fontSize:36}}>🦅</div>
        <div style={{fontSize:14,color:C.textMuted}}>กำลังโหลดข้อมูล...</div>
        <div style={{width:120,height:3,background:C.bgPanel,borderRadius:99,overflow:"hidden"}}>
          <div style={{width:"40%",height:"100%",background:C.primary,borderRadius:99,
            animation:"loadbar 1.1s ease-in-out infinite"}}/>
        </div>
        <style>{`@keyframes loadbar{0%{margin-left:-40%}50%{margin-left:60%}100%{margin-left:140%}}`}</style>
      </div>
    );
  }

  return (
    <HeroPhotosContext.Provider value={app.heroPhotos || {}}>
    <div style={{minHeight:"100vh",background:C.bgBase,color:C.textMain,fontFamily:"'Segoe UI',sans-serif"}}>

      {/* NAV */}
      <div style={{background:"linear-gradient(90deg,#12072a,#0a0a16)",borderBottom:`1px solid ${C.border}`,
        padding:"0 24px",display:"flex",alignItems:"center",height:60,position:"sticky",top:0,zIndex:200}}>
        <span style={{fontSize:22,marginRight:10}}>🦅</span>
        <span style={{fontWeight:900,fontSize:17,letterSpacing:2,color:C.primaryLight}}>PRO TEAM ANALYTICS</span>
        <span style={{background:C.primary,color:"#fff",fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:700,marginLeft:10}}>V7</span>
        {/* save status indicator */}
        <span style={{marginLeft:12,fontSize:11,color:
          saveStatus==="saving"?C.primaryLight:saveStatus==="saved"?"#00b894":saveStatus==="error"?"#ff4757":C.textMuted,
          display:"flex",alignItems:"center",gap:4,transition:"opacity .3s",
          opacity:saveStatus==="idle"?0.4:1}}>
          {saveStatus==="saving" && <>☁️ กำลังบันทึก...</>}
          {saveStatus==="saved"  && <>✅ บันทึกแล้ว</>}
          {saveStatus==="idle"   && <>☁️ ซิงค์แล้ว</>}
        </span>
        <div style={{flex:1}}/>
        {NAV.map(n=>(
          <button key={n.id}
            onClick={()=>dispatchUI({type:"SET_PAGE",payload:n.id})}
            style={{background:page===n.id?C.primary+"30":"transparent",
              border:"none",color:page===n.id?C.primaryLight:C.textMuted,
              padding:"6px 14px",cursor:"pointer",fontSize:13,
              fontWeight:page===n.id?700:400,borderRadius:8}}>
            {n.icon} {n.label}
          </button>
        ))}
        {session?.user && (
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:14,paddingLeft:14,
            borderLeft:`1px solid ${C.border}`}}>
            {session.user.teamName && (
              <span style={{fontSize:11,color:C.primaryLight,fontWeight:700}}>
                🏆 {session.user.teamName}
              </span>
            )}
            {session.user.inviteCode && (
              <span
                title="คลิกเพื่อคัดลอก Invite Code"
                onClick={()=>{navigator.clipboard.writeText(session.user.inviteCode);alert(`คัดลอก Invite Code แล้ว: ${session.user.inviteCode}`);}}
                style={{fontSize:10,color:C.textMuted,background:C.bgPanel,
                  border:`1px solid ${C.border}`,borderRadius:6,padding:"2px 8px",
                  cursor:"pointer",fontFamily:"monospace"}}>
                🔑 {session.user.inviteCode}
              </span>
            )}
            <span style={{fontSize:11,color:C.textMuted}}>
              {session.user.name || session.user.email}
            </span>
            <button onClick={()=>signOut({ callbackUrl: "/login" })}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
                borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>

      {/* ── DRAFT PAGE ── */}
      {page==="draft" && (
        <DraftPageR
          draft={draft}
          dispatch={dispatchDraft}
          roster={roster}
          rivals={rivals}
          enemyRosters={enemyRosters}
          onFinishSession={finishSession}
          allGames={allGames}
          scoutMatches={scoutMatches}
        />
      )}

      {/* ── WHITEBOARD PAGE (full-screen, no padding) ── */}
      {page==="board" && <TacticalWhiteboard/>}

      {page!=="draft" && page!=="board" && (
        <div style={{padding:28,maxWidth:1300,margin:"0 auto"}}>

          {/* ═══ OVERVIEW ═══ */}
          {page==="overview" && (
            <div>
              <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>📊 Team Overview</h2>
              <p style={{margin:"0 0 24px",color:C.textMuted,fontSize:13}}>สรุปภาพรวมสถิติการซ้อมทั้งหมด</p>
              {(()=>{
                const blueG=allGames.filter(g=>g.ourSide==="blue");
                const redG =allGames.filter(g=>g.ourSide==="red");
                const blueW=blueG.filter(g=>g.result==="WIN").length;
                const redW =redG.filter(g=>g.result==="WIN").length;
                const blueWR=blueG.length?Math.round(blueW/blueG.length*100):0;
                const redWR =redG.length ?Math.round(redW/redG.length*100):0;
                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:14,marginBottom:16}}>
                      {[
                        {label:"🏆 Win Rate",   val:`${wr}%`,     col:wr>=50?C.win:C.lose, sub:`${tW}W — ${tG-tW}L`},
                        {label:"🎮 เกมทั้งหมด", val:tG,           col:C.primaryLight,       sub:`${matches.length} sessions`},
                        {label:"🦸 Heroes Used",val:uniq.size,    col:"#feca57",            sub:"ตัวละครไม่ซ้ำ"},
                        {label:"🔵 Blue Side",  val:`${blueWR}%`, col:C.blue,              sub:`${blueG.length} เกม (${blueW}W)`},
                        {label:"🔴 Red Side",   val:`${redWR}%`,  col:C.red,               sub:`${redG.length} เกม (${redW}W)`},
                      ].map(c=>(
                        <div key={c.label} style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>{c.label}</div>
                          <div style={{fontSize:32,fontWeight:800,color:c.col,lineHeight:1}}>{c.val}</div>
                          <div style={{marginTop:8,fontSize:12,color:C.textMuted}}>{c.sub}</div>
                        </div>
                      ))}
                    </div>
                    {tG>0&&(
                      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
                        padding:"12px 18px",marginBottom:18}}>
                        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:8}}>
                          สัดส่วนการเลือกฝั่ง ({tG} เกม)
                        </div>
                        <div style={{display:"flex",height:16,borderRadius:99,overflow:"hidden",gap:2}}>
                          {blueG.length>0&&<div style={{flex:blueG.length,background:C.blue,display:"flex",
                            alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>
                            {Math.round(blueG.length/tG*100)}%
                          </div>}
                          {redG.length>0&&<div style={{flex:redG.length,background:C.red,display:"flex",
                            alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700}}>
                            {Math.round(redG.length/tG*100)}%
                          </div>}
                        </div>
                        <div style={{display:"flex",gap:20,marginTop:6}}>
                          <span style={{fontSize:11,color:C.blue,fontWeight:700}}>🔵 Blue {blueG.length} เกม</span>
                          <span style={{fontSize:11,color:C.red,fontWeight:700}}>🔴 Red {redG.length} เกม</span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              <div style={{display:"grid",gridTemplateColumns:"280px 1fr",gap:20}}>
                <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.ban,marginBottom:14}}>🚫 Top 10 Hero ที่แบน</div>
                  {top10.length===0
                    ?<div style={{color:C.textMuted,fontSize:13,textAlign:"center",padding:"20px 0"}}>ยังไม่มีข้อมูล</div>
                    :top10.map(([hero,cnt],i)=>(
                      <div key={hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                        background:C.bgCard,padding:"9px 12px",borderRadius:8,marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{color:C.textMuted,fontSize:11,width:16}}>#{i+1}</span>
                          <span style={{fontWeight:700}}>{hero}</span>
                        </div>
                        <span style={{fontSize:12,color:C.ban,fontWeight:700,background:C.ban+"20",padding:"2px 8px",borderRadius:4}}>
                          {cnt}x
                        </span>
                      </div>
                    ))
                  }
                </div>
                <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,overflowX:"auto"}}>
                  <div style={{fontWeight:700,fontSize:14,color:C.primaryLight,marginBottom:14}}>📋 Hero Stats</div>
                  {heroArr.length===0
                    ?<div style={{color:C.textMuted,textAlign:"center",padding:"40px 0"}}>ยังไม่มีข้อมูล</div>
                    :<table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:11}}>
                          <th style={{padding:"10px 8px",textAlign:"left"}}>Hero</th>
                          <th style={{padding:"10px 8px",textAlign:"center"}}>Picks</th>
                          <th style={{padding:"10px 8px",textAlign:"center"}}>Win Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heroArr.map((s,i)=>(
                          <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2?"transparent":C.bgCard}}>
                            <td style={{padding:8}}><HeroChip name={s.hero} size={32}/></td>
                            <td style={{padding:8,textAlign:"center",fontWeight:800,color:C.primaryLight}}>{s.picks}</td>
                            <td style={{padding:8,textAlign:"center"}}>
                              <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontWeight:700,fontSize:12,
                                background:s.wr>=50?C.win+"20":C.lose+"20",color:s.wr>=50?C.win:C.lose}}>{s.wr}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                </div>
              </div>
              <HeroSynergyCounter allGames={allGames} scoutMatches={scoutMatches}/>
              <PerformanceTrend allGames={allGames}/>
            </div>
          )}

          {/* ═══ MATCH LOG ═══ */}
          {page==="matches" && (
            <div>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:10}}>
                <h2 style={{margin:0,fontSize:24,fontWeight:800}}>📋 Match Log</h2>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {/* Import JSON */}
                  <label style={{display:"flex",alignItems:"center",gap:6,
                    background:C.primary+"20",border:`1px solid ${C.primary}50`,
                    color:C.primaryLight,borderRadius:9,padding:"7px 16px",
                    cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    📂 Import JSON
                    <input type="file" accept=".json" style={{display:"none"}}
                      onChange={e=>{
                        const file = e.target.files?.[0];
                        if (!file) return;
                        importJSON(file, app, (merged, added) => {
                          if (window.confirm(
                            `พบข้อมูลใหม่:\n• Match: +${added.matches}\n• Rivals: +${added.rivals}\n• Scout: +${added.scoutMatches}\n\nMerge เข้าข้อมูลเดิมไหม?`
                          )) {
                            dispatchApp({type:"MERGE_STATE", payload: merged});
                          }
                        });
                        e.target.value = "";
                      }}/>
                  </label>
                  {/* Export JSON */}
                  <button onClick={()=>exportJSON(app)}
                    style={{display:"flex",alignItems:"center",gap:6,
                      background:C.primary+"20",border:`1px solid ${C.primary}50`,
                      color:C.primaryLight,borderRadius:9,padding:"7px 16px",
                      cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                    💾 Backup JSON
                  </button>
                  {matches.length>0&&(
                    <button onClick={()=>exportCSV(matches, allGames)}
                      style={{display:"flex",alignItems:"center",gap:6,
                        background:C.win+"20",border:`1px solid ${C.win}50`,
                        color:C.win,borderRadius:9,padding:"7px 16px",
                        cursor:"pointer",fontWeight:700,fontSize:12,whiteSpace:"nowrap"}}>
                      ⬇️ Export CSV
                    </button>
                  )}
                </div>
              </div>
              <p style={{margin:"0 0 20px",color:C.textMuted,fontSize:13}}>
                คลิกที่แมตช์เพื่อดูรายละเอียด · กด <b style={{color:C.win}}>📊 Stats ทั้งทีม</b> เพื่อกรอก KDA/Damage/DmgTaken/Gold
              </p>
              {matches.length===0
                ?<div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
                    ยังไม่มีประวัติ — บันทึกแมตช์จาก Live Draft ก่อน
                  </div>
                :matches.map(m=>(
                    <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} playerPhotos={app.playerPhotos}/>
                  ))
              }
            </div>
          )}

          {/* ═══ RIVALS ═══ */}
          {page==="rivals" && (
            <div>
              {!selRival ? (
                <>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                    <h2 style={{margin:0,fontSize:24,fontWeight:800}}>🎯 Rivals</h2>
                    <button onClick={()=>setShowAddRival(v=>!v)}
                      style={{marginLeft:"auto",background:showAddRival?C.bgCard:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
                        color:showAddRival?C.textMuted:"#fff",
                        border:showAddRival?`1px solid ${C.border}`:"none",
                        borderRadius:9,padding:"7px 16px",cursor:"pointer",fontWeight:800,fontSize:12}}>
                      {showAddRival ? "✕ ยกเลิก" : "+ เพิ่มทีมคู่แข่งใหม่"}
                    </button>
                  </div>
                  <p style={{margin:"0 0 16px",color:C.textMuted,fontSize:13}}>คลิกเพื่อดูประวัติการดราฟต์และสถิติเจาะลึก</p>

                  {showAddRival && (
                    <div style={{display:"flex",gap:10,marginBottom:20,background:C.bgPanel,
                      padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
                      <input type="text" placeholder="ชื่อทีมคู่แข่ง... เช่น Alpha Wolves" value={newRivalName}
                        onChange={e=>setNewRivalName(e.target.value)}
                        onKeyDown={e=>{
                          if (e.key==="Enter" && newRivalName.trim()) {
                            const name = newRivalName.trim();
                            dispatchApp({type:"ADD_RIVAL", payload:name});
                            dispatchUI({type:"SET_PAGE", payload:"roster"});
                            dispatchUI({type:"SET_ROSTER_TAB", payload:"enemy"});
                            dispatchUI({type:"SET_SEL_ENEMY_TEAM", payload:name});
                            setNewRivalName(""); setShowAddRival(false);
                          }
                        }}
                        autoFocus
                        style={{...iStyle,flex:1}}/>
                      <button onClick={()=>{
                          if (!newRivalName.trim()) return;
                          const name = newRivalName.trim();
                          dispatchApp({type:"ADD_RIVAL", payload:name});
                          dispatchUI({type:"SET_PAGE", payload:"roster"});
                          dispatchUI({type:"SET_ROSTER_TAB", payload:"enemy"});
                          dispatchUI({type:"SET_SEL_ENEMY_TEAM", payload:name});
                          setNewRivalName(""); setShowAddRival(false);
                        }}
                        style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                          padding:"0 22px",fontWeight:700,cursor:"pointer"}}>
                        + สร้างทีม
                      </button>
                    </div>
                  )}

                  {rivals.length===0
                    ?<div style={{textAlign:"center",padding:60,background:C.bgPanel,borderRadius:14,color:C.textMuted}}>
                        ยังไม่มีคู่แข่ง — กด "+ เพิ่มทีมคู่แข่งใหม่" หรือบันทึกแมตช์เพื่อเพิ่มคู่แข่ง
                      </div>
                    :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
                        {rivals.map(rv=>{
                          const rm=matches.filter(m=>m.rivalName===rv.name);
                          const rGames=rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                          const rw=rGames.filter(g=>g.result==="WIN").length;
                          const rwrate=rGames.length?Math.round(rw/rGames.length*100):0;
                          return (
                            <div key={rv.id}
                              onClick={()=>dispatchUI({type:"SET_SEL_RIVAL",payload:rv.name})}
                              style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,cursor:"pointer"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                <div>
                                  <div style={{fontWeight:800,fontSize:18,color:C.primaryLight}}>{rv.name}</div>
                                  <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{rm.length} session · {rGames.length} เกม</div>
                                </div>
                                <div style={{textAlign:"right"}}>
                                  <div style={{fontSize:22,fontWeight:800,color:rwrate>=50?C.win:C.lose}}>
                                    {rGames.length?`${rwrate}%`:"-"}
                                  </div>
                                  <div style={{fontSize:11,color:C.textMuted}}>{rw}W {rGames.length-rw}L</div>
                                </div>
                              </div>
                              <div style={{height:3,background:C.bgBase,borderRadius:99}}>
                                <div style={{height:3,borderRadius:99,width:`${rwrate}%`,background:rwrate>=50?C.win:C.lose}}/>
                              </div>
                              <div style={{marginTop:12,fontSize:12,color:C.primaryLight,textAlign:"center",
                                background:C.bgBase,padding:"6px",borderRadius:8,border:`1px solid ${C.border}`}}>
                                ดูประวัติการดราฟต์ ➔
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </>
              ) : (()=>{
                  const rm     = matches.filter(m=>m.rivalName===selRival);
                  const rGames = rm.flatMap(m=>Array.isArray(m.games)&&m.games.length?m.games:[m]);
                  const rw     = rGames.filter(g=>g.result==="WIN").length;
                  const rwrate = rGames.length?Math.round(rw/rGames.length*100):0;
                  const eHeroSt={};
                  rGames.forEach(g=>{
                    (g.enemyPicks||[]).forEach(s=>{if(s.hero?.name){
                      if(!eHeroSt[s.hero.name])eHeroSt[s.hero.name]={picks:0,wins:0};
                      eHeroSt[s.hero.name].picks++;
                      if(g.result!=="WIN")eHeroSt[s.hero.name].wins++;
                    }});
                  });
                  const eHeroArr=Object.entries(eHeroSt)
                    .map(([h,s])=>({hero:h,picks:s.picks,wr:Math.round(s.wins/s.picks*100)}))
                    .sort((a,b)=>b.picks-a.picks);
                  const eBanCt={};
                  rGames.forEach(g=>(g.enemyBans||[]).forEach(h=>{
                    if(h?.name)eBanCt[h.name]=(eBanCt[h.name]||0)+1;
                  }));
                  const eTop10Bans=Object.entries(eBanCt).sort((a,b)=>b[1]-a[1]).slice(0,8);
                  const eBlueG=rGames.filter(g=>g.ourSide==="red");
                  const eRedG =rGames.filter(g=>g.ourSide==="blue");
                  const eBlueW=eBlueG.filter(g=>g.result==="LOSE").length;
                  const eRedW =eRedG.filter(g=>g.result==="LOSE").length;
                  const eBlueWR=eBlueG.length?Math.round(eBlueW/eBlueG.length*100):0;
                  const eRedWR =eRedG.length ?Math.round(eRedW/eRedG.length*100):0;
                  return (
                    <>
                      <button onClick={()=>dispatchUI({type:"SET_SEL_RIVAL",payload:null})}
                        style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:14,marginBottom:16,padding:0}}>
                        ← กลับ Rivals
                      </button>
                      <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                          <div>
                            <h2 style={{margin:0,fontSize:26,fontWeight:800,color:C.primaryLight}}>{selRival}</h2>
                            <p style={{margin:"3px 0 0",color:C.textMuted,fontSize:12}}>{rm.length} session · {rGames.length} เกม</p>
                          </div>
                          <div style={{display:"flex",gap:12,alignItems:"center"}}>
                            {[{v:rw,l:"WINS",c:C.win},{v:rGames.length-rw,l:"LOSSES",c:C.lose}].map(x=>(
                              <div key={x.l} style={{textAlign:"center",background:C.bgBase,padding:"8px 16px",borderRadius:10}}>
                                <div style={{fontSize:20,fontWeight:800,color:x.c}}>{x.v}</div>
                                <div style={{fontSize:10,color:C.textMuted}}>{x.l}</div>
                              </div>
                            ))}
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:28,fontWeight:800,color:rwrate>=50?C.win:C.lose}}>
                                {rGames.length?`${rwrate}%`:"-"}
                              </div>
                              <div style={{fontSize:11,color:C.textMuted}}>Win Rate</div>
                            </div>
                          </div>
                        </div>
                        {rGames.length>0&&(
                          <div style={{marginTop:12,height:4,background:"#1e1640",borderRadius:99}}>
                            <div style={{height:4,borderRadius:99,width:`${rwrate}%`,background:rwrate>=50?C.win:C.lose}}/>
                          </div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:10,padding:4,
                        marginBottom:18,width:"fit-content",border:`1px solid ${C.border}`}}>
                        {[
                          {id:"history",  label:"📋 ประวัติ Sessions"},
                          {id:"overview", label:"📊 Rival Overview"},
                          {id:"scout",    label:"🔍 Scout Log"},
                        ].map(t=>(
                          <button key={t.id}
                            onClick={()=>dispatchUI({type:"SET_RIVAL_VIEW",payload:t.id})}
                            style={{background:rivalView===t.id?C.primary:"transparent",
                              border:"none",color:rivalView===t.id?"#fff":C.textMuted,
                              borderRadius:7,padding:"7px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      {rivalView==="scout" && (
                        <ScoutLogPage
                          rivalName={selRival}
                          scoutMatches={scoutMatches}
                          rivals={rivals}
                          enemyRosters={enemyRosters}
                          onSaveScout={data=>dispatchApp({type:"SAVE_SCOUT",payload:data})}
                          onDeleteScout={id=>dispatchApp({type:"DELETE_SCOUT",payload:id})}
                          onBack={()=>dispatchUI({type:"SET_RIVAL_VIEW",payload:"history"})}
                        />
                      )}
                      {rivalView==="history" && rm.map(m=>(
                        <MatchCardWithStats key={m.id} m={m} onUpdateStats={handleUpdateStats} playerPhotos={app.playerPhotos}/>
                      ))}
                      {rivalView==="overview" && (
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:16}}>
                            {[
                              {icon:"🔵",label:"Blue Side (คู่แข่ง)",val:`${eBlueWR}%`,col:C.blue,sub:`${eBlueG.length} เกม · ${eBlueW}W`},
                              {icon:"🔴",label:"Red Side (คู่แข่ง)", val:`${eRedWR}%`, col:C.red, sub:`${eRedG.length} เกม · ${eRedW}W`},
                              {icon:"🎮",label:"เกมทั้งหมด",val:rGames.length,col:C.primaryLight,sub:`${rm.length} sessions`},
                              {icon:"🏆",label:"Win Rate (เราชนะ)",val:`${rwrate}%`,col:rwrate>=50?C.win:C.lose,sub:`${rw}W ${rGames.length-rw}L`},
                            ].map(c=>(
                              <div key={c.label} style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                                <div style={{fontSize:10,color:C.textMuted,fontWeight:700,marginBottom:6}}>{c.icon} {c.label}</div>
                                <div style={{fontSize:26,fontWeight:800,color:c.col,lineHeight:1}}>{c.val}</div>
                                <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>{c.sub}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                              <div style={{fontWeight:700,fontSize:13,color:C.ban,marginBottom:12}}>🚫 Hero ที่คู่แข่งชอบแบน</div>
                              {eTop10Bans.length===0
                                ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
                                :eTop10Bans.map(([h,cnt],i)=>(
                                  <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                    padding:"7px 10px",background:C.bgCard,borderRadius:7,marginBottom:5}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{color:C.textMuted,fontSize:10,width:16}}>#{i+1}</span>
                                      <span style={{fontWeight:700,fontSize:13}}>{h}</span>
                                    </div>
                                    <span style={{fontSize:11,color:C.ban,fontWeight:700,background:C.ban+"20",
                                      padding:"1px 7px",borderRadius:4}}>{cnt}x</span>
                                  </div>
                                ))
                              }
                            </div>
                            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
                              <div style={{fontWeight:700,fontSize:13,color:C.lose,marginBottom:12}}>⚔️ Hero ที่คู่แข่งชอบเลือก</div>
                              {eHeroArr.length===0
                                ?<div style={{color:C.textMuted,textAlign:"center",padding:"20px 0",fontSize:12}}>ยังไม่มีข้อมูล</div>
                                :<table style={{width:"100%",borderCollapse:"collapse"}}>
                                  <thead>
                                    <tr style={{borderBottom:`2px solid ${C.border}`,color:C.textMuted,fontSize:10}}>
                                      <th style={{padding:"6px 8px",textAlign:"left"}}>Hero</th>
                                      <th style={{padding:"6px 8px",textAlign:"center"}}>Pick</th>
                                      <th style={{padding:"6px 8px",textAlign:"center"}}>Win%</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {eHeroArr.slice(0,8).map((s,i)=>(
                                      <tr key={s.hero} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?"transparent":C.bgCard}}>
                                        <td style={{padding:"6px 8px",fontWeight:700,fontSize:12}}>{s.hero}</td>
                                        <td style={{padding:"6px 8px",textAlign:"center",color:C.primaryLight,fontWeight:700}}>{s.picks}</td>
                                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                                          <span style={{display:"inline-block",padding:"1px 7px",borderRadius:5,fontWeight:700,fontSize:11,
                                            background:s.wr>=50?C.win+"20":C.lose+"20",
                                            color:s.wr>=50?C.win:C.lose}}>{s.wr}%</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              }
                            </div>
                          </div>
                          <RivalStatsSection selRival={selRival} rGames={rGames} enemyRosters={enemyRosters}/>
                        </div>
                      )}
                    </>
                  );
                })()
              }
            </div>
          )}

          {/* ═══ NOTES ═══ */}
          {page==="notes" && (
            <CoachNotesHub allGames={allGames} rivals={rivals}/>
          )}

          {/* ═══ VIDEO LIBRARY ═══ */}
          {page==="video" && <VideoLibrary/>}

          {/* ═══ HERO IMAGES ═══ */}
          {page==="heroimg" && (
            <HeroImageManager
              heroPhotos={app.heroPhotos || {}}
              onSetPhoto={(heroName, dataUrl) => dispatchApp({type:"SET_HERO_PHOTO", payload:{heroName, dataUrl}})}
              onSetPhotosBulk={(updates) => dispatchApp({type:"SET_HERO_PHOTOS_BULK", payload:updates})}
              onRemovePhoto={(heroName) => dispatchApp({type:"REMOVE_HERO_PHOTO", payload:heroName})}
              onSetRole={(heroName, role) => dispatchApp({type:"SET_ROLE_OVERRIDE", payload:{heroName, role}})}
              onAddHero={({ name, role, photo }) => {
                dispatchApp({type:"ADD_CUSTOM_HERO", payload:{ name, role }});
                if (photo) dispatchApp({type:"SET_HERO_PHOTO", payload:{ heroName:name, dataUrl:photo }});
              }}
            />
          )}

          {/* ═══ ROSTER ═══ */}
          {page==="roster" && (
            <div style={{maxWidth:960}}>
              {selPlayer ? (
                <PlayerProfile
                  player={selPlayer}
                  isEnemy={selPlayerEnemy}
                  allGames={allGames}
                  onBack={()=>dispatchUI({type:"CLEAR_SEL_PLAYER"})}
                  photoUrl={app.playerPhotos?.[selPlayerEnemy ? `enemy:${selEnemyTeam}:${selPlayer}` : `our:${selPlayer}`]}
                />
              ) : (
                <>
                  <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>👥 Roster</h2>
                  <p style={{margin:"0 0 16px",color:C.textMuted,fontSize:13}}>คลิกที่ผู้เล่นเพื่อดู Player Profile</p>
                  <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:10,padding:4,
                    marginBottom:20,width:"fit-content",border:`1px solid ${C.border}`}}>
                    {[{id:"our",label:"🛡️ ทีมเรา"},{id:"enemy",label:"⚔️ คู่แข่ง"}].map(t=>(
                      <button key={t.id}
                        onClick={()=>dispatchUI({type:"SET_ROSTER_TAB",payload:t.id})}
                        style={{background:rosterTab===t.id?C.primary:"transparent",
                          border:"none",color:rosterTab===t.id?"#fff":C.textMuted,
                          borderRadius:7,padding:"7px 22px",cursor:"pointer",fontWeight:700,fontSize:13}}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {rosterTab==="our" && (
                    <>
                      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16,background:C.bgPanel,
                        padding:16,borderRadius:14,border:`1px solid ${C.border}`}}>
                        <PhotoPicker value={newPlayerPhoto} onChange={(v)=>setNewPlayerPhoto(v)} size={56} team="our"/>
                        <input type="text" placeholder="ชื่อผู้เล่นใหม่..." value={newName}
                          onChange={e=>dispatchUI({type:"SET_NEW_NAME",payload:e.target.value})}
                          onKeyDown={e=>e.key==="Enter"&&handleAddPlayer()}
                          style={{...iStyle,flex:1}}/>
                        <button onClick={handleAddPlayer}
                          style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                            padding:"0 22px",fontWeight:700,cursor:"pointer",alignSelf:"stretch"}}>+ เพิ่ม</button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        {roster.map(player=>{
                          let pg=0,pw=0; const ph={};
                          allGames.forEach(g=>{
                            const s=(g.ourPicks||[]).find(d=>d.player===player);
                            if(s){pg++;if(g.result==="WIN")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                          });
                          const pwr=pg?Math.round(pw/pg*100):0;
                          const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                          const photoKey = `our:${player}`;
                          return (
                            <div key={player}
                              onClick={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:false}})}
                              style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
                                padding:"14px 20px",display:"flex",alignItems:"center",
                                justifyContent:"space-between",cursor:"pointer"}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                              <div style={{display:"flex",alignItems:"center",gap:14}}>
                                <PlayerAvatar name={player} photoUrl={app.playerPhotos?.[photoKey]} size={48} team="our"/>
                                <div>
                                  <div style={{fontWeight:800,fontSize:16}}>{player}</div>
                                  {top ? (
                                    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                                      <span style={{fontSize:11,color:C.textMuted}}>Main:</span>
                                      <HeroChip name={top[0]} size={18} fontSize={11}/>
                                      <span style={{fontSize:10,color:C.textMuted}}>({top[1]} เกม)</span>
                                    </div>
                                  ) : (
                                    <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>ยังไม่มีข้อมูล</div>
                                  )}
                                </div>
                              </div>
                              <div style={{display:"flex",gap:20,alignItems:"center"}}>
                                <div style={{textAlign:"center"}}>
                                  <div style={{fontSize:18,fontWeight:800}}>{pg}</div>
                                  <div style={{fontSize:10,color:C.textMuted}}>GAMES</div>
                                </div>
                                <div style={{textAlign:"center",minWidth:52}}>
                                  <div style={{fontSize:18,fontWeight:800,color:pwr>=50?C.win:C.lose}}>
                                    {pg?`${pwr}%`:"-"}</div>
                                  <div style={{fontSize:10,color:C.textMuted}}>{pw}W-{pg-pw}L</div>
                                </div>
                                <span style={{fontSize:12,color:C.primaryLight}}>ดู Profile →</span>
                                <button
                                  onClick={e=>{e.stopPropagation();handleRemovePlayer(player);}}
                                  style={{background:C.lose+"20",color:C.lose,border:"none",
                                    width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:14}}>🗑️</button>
                              </div>
                            </div>
                          );
                        })}
                        {roster.length===0&&(
                          <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                            ยังไม่มีผู้เล่น
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {rosterTab==="enemy" && (
                    <>
                      {!selEnemyTeam ? (
                        <>
                          <p style={{fontSize:12,color:C.textMuted,marginBottom:14}}>
                            เลือกทีมคู่แข่งเพื่อจัดการ Roster และดู Player Profile
                          </p>
                          {rivals.length===0&&(
                            <div style={{textAlign:"center",color:C.textMuted,padding:40,background:C.bgPanel,borderRadius:12}}>
                              ยังไม่มีทีมคู่แข่ง — บันทึกแมตช์ก่อนนะครับ
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                            {rivals.map(rv=>{
                              const ep=enemyRosters[rv.name]||[];
                              const rGames=allGames.filter(g=>g.rivalName===rv.name);
                              const rw=rGames.filter(g=>g.result==="WIN").length;
                              const rwr=rGames.length?Math.round(rw/rGames.length*100):0;
                              return (
                                <div key={rv.id}
                                  onClick={()=>dispatchUI({type:"SET_SEL_ENEMY_TEAM",payload:rv.name})}
                                  style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",cursor:"pointer"}}
                                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.lose}
                                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                                  <div style={{fontWeight:800,fontSize:16,color:C.primaryLight,marginBottom:4}}>{rv.name}</div>
                                  <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>
                                    {ep.length} ผู้เล่น · {rGames.length} เกม · WR {rGames.length?`${rwr}%`:"-"}
                                  </div>
                                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                    {ep.slice(0,5).map(p=>(
                                      <span key={p} style={{background:C.lose+"20",color:C.lose,fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:700}}>{p}</span>
                                    ))}
                                    {ep.length>5&&<span style={{fontSize:10,color:C.textMuted}}>+{ep.length-5}</span>}
                                    {ep.length===0&&<span style={{fontSize:10,color:"#3a3a5c"}}>ยังไม่มีผู้เล่น</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>dispatchUI({type:"SET_SEL_ENEMY_TEAM",payload:null})}
                            style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13,marginBottom:14,padding:0}}>
                            ← กลับ
                          </button>
                          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                            <h3 style={{margin:0,fontSize:18,fontWeight:800,color:C.lose}}>{selEnemyTeam}</h3>
                            <span style={{fontSize:11,color:C.textMuted}}>⚔️ Enemy Roster</span>
                          </div>
                          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16,background:C.bgPanel,
                            padding:14,borderRadius:12,border:`1px solid ${C.border}`}}>
                            <PhotoPicker value={newEnemyPlayerPhoto} onChange={(v)=>setNewEnemyPlayerPhoto(v)} size={50} team="enemy"/>
                            <input type="text" placeholder="ชื่อผู้เล่นคู่แข่ง..." value={newEnemyName}
                              onChange={e=>dispatchUI({type:"SET_NEW_ENEMY_NAME",payload:e.target.value})}
                              onKeyDown={e=>e.key==="Enter"&&handleAddEnemyPlayer(selEnemyTeam)}
                              style={{...iStyle,flex:1}}/>
                            <button onClick={()=>handleAddEnemyPlayer(selEnemyTeam)}
                              style={{background:C.lose,color:"#fff",border:"none",borderRadius:8,padding:"0 18px",fontWeight:700,cursor:"pointer",alignSelf:"stretch"}}>
                              + เพิ่ม
                            </button>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:10}}>
                            {(enemyRosters[selEnemyTeam]||[]).map(player=>{
                              let pg=0,pw=0; const ph={};
                              allGames.filter(g=>g.rivalName===selEnemyTeam).forEach(g=>{
                                const s=(g.enemyPicks||[]).find(d=>d.player===player);
                                if(s){pg++;if(g.result==="LOSE")pw++;if(s.hero?.name)ph[s.hero.name]=(ph[s.hero.name]||0)+1;}
                              });
                              const pwr=pg?Math.round(pw/pg*100):0;
                              const top=Object.entries(ph).sort((a,b)=>b[1]-a[1])[0];
                              const photoKey = `enemy:${selEnemyTeam}:${player}`;
                              return (
                                <div key={player}
                                  onClick={()=>dispatchUI({type:"SET_SEL_PLAYER",payload:{name:player,isEnemy:true}})}
                                  style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,
                                    padding:"14px 20px",display:"flex",alignItems:"center",
                                    justifyContent:"space-between",cursor:"pointer"}}
                                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.lose}
                                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                                    <PlayerAvatar name={player} photoUrl={app.playerPhotos?.[photoKey]} size={48} team="enemy"/>
                                    <div>
                                      <div style={{fontWeight:800,fontSize:16}}>{player}</div>
                                      {top ? (
                                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                                          <span style={{fontSize:11,color:C.textMuted}}>Main:</span>
                                          <HeroChip name={top[0]} size={18} fontSize={11} accentCol={C.lose}/>
                                          <span style={{fontSize:10,color:C.textMuted}}>({top[1]} เกม)</span>
                                        </div>
                                      ) : (
                                        <div style={{fontSize:12,color:C.textMuted,marginTop:3}}>ยังไม่มีข้อมูล</div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{display:"flex",gap:20,alignItems:"center"}}>
                                    <div style={{textAlign:"center"}}>
                                      <div style={{fontSize:18,fontWeight:800}}>{pg}</div>
                                      <div style={{fontSize:10,color:C.textMuted}}>GAMES</div>
                                    </div>
                                    <div style={{textAlign:"center",minWidth:52}}>
                                      <div style={{fontSize:18,fontWeight:800,color:pwr>=50?C.lose:C.win}}>
                                        {pg?`${pwr}%`:"-"}</div>
                                      <div style={{fontSize:10,color:C.textMuted}}>{pw}W-{pg-pw}L</div>
                                    </div>
                                    <span style={{fontSize:12,color:C.lose}}>ดู Profile →</span>
                                    <button
                                      onClick={e=>{e.stopPropagation();handleRemoveEnemyPlayer(selEnemyTeam,player);}}
                                      style={{background:C.lose+"20",color:C.lose,border:"none",
                                        width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:14}}>🗑️</button>
                                  </div>
                                </div>
                              );
                            })}
                            {(enemyRosters[selEnemyTeam]||[]).length===0&&(
                              <div style={{textAlign:"center",color:C.textMuted,padding:30,background:C.bgPanel,borderRadius:12}}>
                                ยังไม่มีผู้เล่น — เพิ่มชื่อด้านบนได้เลย
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </HeroPhotosContext.Provider>
  );
}

// ═══════════════════════════════════════════
//  DRAFT PAGE — refactored to use draftReducer
// ═══════════════════════════════════════════
function DraftPageR({ draft, dispatch, roster, rivals, enemyRosters, onFinishSession, allGames, scoutMatches }) {
  const { stage, boType, rivalName, ourSide, currentGame, completedGames,
          step, blueBans, redBans, bluePicks, redPicks,
          roleFilter, search, meta } = draft;

  const bo = BO_OPTIONS.find(b=>b.label===boType) || BO_OPTIONS[2];
  const currentEnemyRoster = enemyRosters[rivalName] || [];

  const globalLockedOur = new Set(
    completedGames.flatMap(g=>(g.ourPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );
  const globalLockedEnemy = new Set(
    completedGames.flatMap(g=>(g.enemyPicks||[]).filter(s=>s.hero).map(s=>s.hero.name))
  );

  const cur        = step < DRAFT_ORDER.length ? DRAFT_ORDER[step] : null;
  const phase      = !cur ? "DONE" : cur.action==="ban" ? "BAN" : "PICK";
  const phaseColor = phase==="BAN" ? C.ban : C.win;

  const usedThisGame = new Set([
    ...blueBans.filter(Boolean).map(h=>h.name),
    ...redBans.filter(Boolean).map(h=>h.name),
    ...bluePicks.filter(h=>h.hero).map(h=>h.hero.name),
    ...redPicks.filter(h=>h.hero).map(h=>h.hero.name),
  ]);

  function isGlobalLocked(heroName) {
    if (!cur || cur.action==="ban") return false;
    return cur.team===ourSide ? globalLockedOur.has(heroName) : globalLockedEnemy.has(heroName);
  }

  function teamLabel(t) {
    return t===ourSide ? `${t==="blue"?"🔵":"🔴"} ทีมเรา` : `${t==="blue"?"🔵":"🔴"} คู่แข่ง`;
  }

  function selectHero(hero) {
    if (!cur || usedThisGame.has(hero.name) || isGlobalLocked(hero.name)) return;
    dispatch({ type:"SELECT_HERO", payload:{ hero, team:cur.team, action:cur.action, slot:cur.slot } });
  }

  function handleGameDone() {
    const ourPicksData   = ourSide==="blue" ? bluePicks : redPicks;
    const enemyPicksData = ourSide==="blue" ? redPicks  : bluePicks;
    const ourBansData    = ourSide==="blue" ? blueBans  : redBans;
    const enemyBansData  = ourSide==="blue" ? redBans   : blueBans;
    const finishedGame = {
      ourSide, result:meta.result,
      ourScore:meta.ourScore, enemyScore:meta.enemyScore,
      duration:meta.duration, note:meta.note,
      ourBans:ourBansData, enemyBans:enemyBansData,
      ourPicks:ourPicksData, enemyPicks:enemyPicksData,
      gameStats:{ our:{}, enemy:{} },
      gameNo: currentGame,
    };

    // If this was the last game in the BO series, save the whole match
    // immediately instead of relying on the user to notice and press the
    // separate "Finish" button — that button doesn't even exist once the
    // reducer's "done" stage is reached, leaving the match unsaved.
    if (currentGame >= bo.total) {
      onFinishSession([...completedGames, finishedGame]);
      return;
    }

    dispatch({ type:"GAME_DONE", payload: finishedGame });
  }

  const filtered = HERO_DATA.filter(h =>
    (roleFilter==="All" || h.role===roleFilter) &&
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  const phaseLabel = !cur ? "✅ Draft เสร็จ"
    : cur.action==="ban" ? `🚫 BAN — ${teamLabel(cur.team)}`
    : `⚔️ PICK — ${teamLabel(cur.team)}`;

  // ── SETUP ──
  if (stage==="setup") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase}}>
      <div style={{width:500,background:C.bgPanel,borderRadius:20,padding:36,
        border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:36,marginBottom:6}}>⚔️</div>
          <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เริ่ม Draft Session</h2>
        </div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ทีมคู่แข่ง</div>
          {rivals.length>0 ? (
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <select
                value={rivals.find(r=>r.name===rivalName) ? rivalName : "__custom__"}
                onChange={e=>{
                  if (e.target.value==="__custom__") dispatch({type:"SETUP_SET_RIVAL",payload:""});
                  else dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value});
                }}
                style={iStyle}>
                <option value="__custom__">— พิมพ์ชื่อทีมใหม่ —</option>
                {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {(!rivalName || !rivals.find(r=>r.name===rivalName)) && (
                <input value={rivalName}
                  onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
                  placeholder="พิมพ์ชื่อทีมใหม่..." style={iStyle}/>
              )}
            </div>
          ) : (
            <input value={rivalName}
              onChange={e=>dispatch({type:"SETUP_SET_RIVAL",payload:e.target.value})}
              placeholder="เช่น Alpha Wolves" style={iStyle}/>
          )}
          {rivalName && currentEnemyRoster.length>0 && (
            <div style={{marginTop:8,padding:"8px 12px",background:C.lose+"10",
              border:`1px solid ${C.lose}30`,borderRadius:8}}>
              <div style={{fontSize:10,color:C.lose,fontWeight:700,marginBottom:4}}>
                ⚔️ Roster: {currentEnemyRoster.length} คน
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {currentEnemyRoster.map(p=>(
                  <span key={p} style={{background:C.lose+"20",color:C.lose,fontSize:10,
                    padding:"2px 8px",borderRadius:99,fontWeight:700}}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:10,fontWeight:700}}>รูปแบบ BO</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
            {BO_OPTIONS.map(b=>(
              <button key={b.label}
                onClick={()=>dispatch({type:"SETUP_SET_BO",payload:b.label})}
                style={{background:boType===b.label?C.primary+"30":"transparent",
                  border:`2px solid ${boType===b.label?C.primary:C.border}`,
                  color:boType===b.label?C.primaryLight:C.textMuted,
                  borderRadius:10,padding:"10px 4px",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:900,fontSize:15}}>{b.label}</div>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={()=>{
            if(!rivalName.trim()){alert("กรุณากรอกชื่อทีมคู่แข่ง");return;}
            dispatch({type:"SETUP_NEXT"});
          }}
          style={{width:"100%",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
            color:"#fff",border:"none",borderRadius:10,padding:"13px",fontWeight:800,fontSize:15,cursor:"pointer"}}>
          ถัดไป: เลือกฝั่ง Game 1 →
        </button>
      </div>
    </div>
  );

  // ── CHOOSE SIDE ──
  if (stage==="chooseSide") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",background:C.bgBase,position:"relative"}}>
      {completedGames.length>0&&(
        <button onClick={()=>onFinishSession(completedGames)} style={{
          position:"absolute",top:20,right:24,
          background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
          borderRadius:8,padding:"6px 16px",cursor:"pointer",fontWeight:700,fontSize:13}}>
          ✅ Finish ({completedGames.length} เกม)
        </button>
      )}
      <button onClick={()=>dispatch({type:"BACK_TO_SETUP"})} style={{
        position:"absolute",top:20,left:24,
        background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:13}}>
        ← กลับ Setup
      </button>
      <div style={{textAlign:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:C.primaryLight,fontWeight:700,letterSpacing:1,marginBottom:4}}>
          {boType} · vs {rivalName}
        </div>
        <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:16}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <h2 style={{margin:0,fontSize:20,fontWeight:800}}>เลือกฝั่ง — Game {currentGame}</h2>
        <p style={{margin:"6px 0 0",color:C.textMuted,fontSize:12}}>ทีมเราเล่นฝั่งไหนในเกมนี้?</p>
        {(globalLockedOur.size>0||globalLockedEnemy.size>0)&&(
          <div style={{marginTop:16,background:C.bgPanel,border:`1px solid ${C.border}`,
            borderRadius:12,padding:"12px 20px",maxWidth:440,textAlign:"left"}}>
            <div style={{fontSize:11,color:C.textMuted,fontWeight:700,marginBottom:4}}>
              🔒 Global Lock สำหรับ Game {currentGame}
            </div>
            {globalLockedOur.size>0&&<div style={{fontSize:11,color:C.win}}>
              🛡️ <b>ทีมเรา</b> ห้าม Pick: {[...globalLockedOur].join(", ")}
            </div>}
            {globalLockedEnemy.size>0&&<div style={{fontSize:11,color:C.lose}}>
              ⚔️ <b>คู่แข่ง</b> ห้าม Pick: {[...globalLockedEnemy].join(", ")}
            </div>}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:20,marginTop:20}}>
        {[
          {side:"blue",color:C.blue,emoji:"🔵",label:"Blue Side",hint:"Ban ก่อน"},
          {side:"red", color:C.red, emoji:"🔴",label:"Red Side", hint:"Ban ทีหลัง"},
        ].map(opt=>(
          <button key={opt.side}
            onClick={()=>dispatch({type:"CHOOSE_SIDE",payload:opt.side})}
            style={{background:"transparent",border:`2px solid ${opt.color}`,
              borderRadius:16,padding:"24px 40px",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",gap:8}}
            onMouseEnter={e=>e.currentTarget.style.background=opt.color+"18"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <span style={{fontSize:40}}>{opt.emoji}</span>
            <span style={{fontWeight:900,fontSize:16,color:opt.color}}>{opt.label}</span>
            <span style={{fontSize:10,color:C.textMuted}}>{opt.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── PLAYING ──
  if (stage==="playing") return (
    <div style={{padding:"10px 16px",overflowY:"auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontWeight:800,fontSize:14,color:C.primaryLight}}>{boType} vs {rivalName}</span>
        <div style={{display:"flex",gap:5}}>
          {Array.from({length:bo.total},(_,i)=>(
            <div key={i} style={{width:24,height:24,borderRadius:"50%",display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,
              background:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win+"30":C.lose+"30"
                :i===currentGame-1?C.primary+"30":"transparent",
              border:`2px solid ${i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.border}`,
              color:i<completedGames.length
                ?completedGames[i].result==="WIN"?C.win:C.lose
                :i===currentGame-1?C.primary:C.textMuted}}>
              {i<completedGames.length?(completedGames[i].result==="WIN"?"W":"L"):i+1}
            </div>
          ))}
        </div>
        <span style={{fontSize:11,padding:"2px 10px",borderRadius:99,fontWeight:700,
          background:ourSide==="blue"?C.blue+"20":C.red+"20",
          color:ourSide==="blue"?C.blue:C.red}}>
          {ourSide==="blue"?"🔵 Blue":"🔴 Red"} Side
        </span>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={()=>{if(window.confirm("จบ session นี้เลยไหม?"))onFinishSession(completedGames);}}
            style={{background:"transparent",border:`1px solid ${C.win}60`,color:C.win,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12,fontWeight:700}}>
            ✅ Finish
          </button>
          <button onClick={()=>{if(window.confirm("ยกเลิก session นี้?"))dispatch({type:"RESET"});}}
            style={{background:"transparent",border:`1px solid ${C.lose}40`,color:C.lose,
              borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:12}}>
            ✕ ยกเลิก
          </button>
        </div>
      </div>

      {/* board */}
      <div style={{border:`2px solid ${C.border}`,borderRadius:14,overflow:"hidden",marginBottom:8}}>
        <div style={{background:"#0d0b1e",padding:"8px 16px",display:"flex",alignItems:"center",
          gap:10,borderBottom:`1px solid ${C.border}`,flexWrap:"wrap"}}>
          <span style={{fontWeight:900,color:C.primaryLight,fontSize:14}}>{boType} — Game {currentGame}</span>
          <div style={{padding:"3px 12px",borderRadius:99,fontWeight:700,fontSize:11,
            background:phaseColor+"22",color:phaseColor,border:`1px solid ${phaseColor}50`}}>
            {phaseLabel}
          </div>
          <span style={{fontSize:10,padding:"2px 10px",borderRadius:99,fontWeight:700,
            background:ourSide==="blue"?C.blue+"20":C.red+"20",
            color:ourSide==="blue"?C.blue:C.red}}>
            {ourSide==="blue"?"🔵 Blue":"🔴 Red"}
          </span>
          {globalLockedOur.size>0&&(
            <div style={{fontSize:10,color:C.win,background:C.win+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.win}30`}}>
              🛡️ {[...globalLockedOur].join(", ")}
            </div>
          )}
          {globalLockedEnemy.size>0&&(
            <div style={{fontSize:10,color:C.lose,background:C.lose+"15",padding:"2px 10px",
              borderRadius:99,border:`1px solid ${C.lose}30`}}>
              ⚔️ {[...globalLockedEnemy].join(", ")}
            </div>
          )}
          <div style={{flex:1}}/>
          <button onClick={()=>dispatch({type:"UNDO"})} disabled={step===0}
            style={{background:C.bgCard,border:`1px solid ${C.border}`,
              color:step===0?"#3a3a5c":C.textMuted,borderRadius:7,padding:"4px 12px",
              cursor:step===0?"not-allowed":"pointer",fontSize:11,fontWeight:700}}>
            ↩ Undo
          </button>
        </div>

        <div style={{display:"flex",height:500}}>
          <TeamPanelR side="blue" isOurTeam={ourSide==="blue"}
            bans={blueBans} picks={bluePicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"blue",idx:i,playerName:v}})}
          />
          {/* center hero grid */}
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"10px 12px",overflowY:"auto",background:C.bgBase}}>
            <PhaseTracker step={step}/>
            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search}
                onChange={e=>dispatch({type:"SET_SEARCH",payload:e.target.value})}
                placeholder="🔍 Hero..."
                style={{...iStyle,width:140,padding:"5px 10px",fontSize:12}}/>
              {ROLES_FILTER.map(r=>(
                <button key={r} onClick={()=>dispatch({type:"SET_ROLE_FILTER",payload:r})} style={{
                  background:roleFilter===r?(ROLE_COLOR[r]||C.primary):"#14112a",
                  border:`1px solid ${roleFilter===r?(ROLE_COLOR[r]||C.primary):C.border}`,
                  color:roleFilter===r?"#fff":C.textMuted,
                  borderRadius:99,padding:"3px 9px",fontSize:10,cursor:"pointer",fontWeight:700}}>{r}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(66px,1fr))",gap:4,flex:1}}>
              {filtered.map(hero=>{
                const usedHere = usedThisGame.has(hero.name);
                const glLocked = isGlobalLocked(hero.name);
                const disabled = usedHere || glLocked;
                const isBanned = [...blueBans,...redBans].some(h=>h?.name===hero.name);
                const glBadgeColor = cur?.action==="pick"?(cur.team===ourSide?C.win:C.lose):C.primary;
                return (
                  <div key={hero.name}
                    onClick={()=>selectHero(hero)}
                    title={usedHere?"ใช้แล้ว":glLocked?"Global Lock":""}
                    style={{opacity:disabled?0.2:1,cursor:disabled?"not-allowed":"pointer",
                      transition:"transform .1s",position:"relative"}}
                    onMouseEnter={e=>{if(!disabled)e.currentTarget.style.transform="scale(1.08)";}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
                    <HeroCard hero={hero} size={66} banned={isBanned}/>
                    {glLocked&&!usedHere&&(
                      <div style={{position:"absolute",top:2,left:2,background:glBadgeColor,
                        color:"#fff",fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:4}}>GL</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:6,display:"flex",gap:5,flexWrap:"wrap"}}>
              {DRAFT_ORDER.slice(step+1,step+4).map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:C.bgPanel,
                  borderRadius:6,padding:"3px 8px",border:`1px solid ${C.border}`}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:s.team==="blue"?C.blue:C.red}}/>
                  <span style={{fontSize:9,color:s.action==="ban"?C.ban:C.win,fontWeight:700}}>
                    {s.action==="ban"?"BAN":"PICK"}
                  </span>
                  <span style={{fontSize:9,color:s.team===ourSide?C.primaryLight:C.textMuted}}>
                    {s.team===ourSide?"เรา":"คู่แข่ง"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <TeamPanelR side="red" isOurTeam={ourSide==="red"}
            bans={redBans} picks={redPicks} cur={cur}
            roster={roster} enemyRoster={currentEnemyRoster}
            onPlayerChange={(i,v)=>dispatch({type:"SET_PLAYER",payload:{team:"red",idx:i,playerName:v}})}
          />
        </div>

        {/* meta bar */}
        <div style={{background:"#0d0b1e",borderTop:`1px solid ${C.border}`,padding:"10px 16px",
          display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          {[
            {label:"ผล",key:"result",type:"select",opts:["WIN","LOSE"],w:88},
            {label:"คิลเรา",key:"ourScore",type:"number",placeholder:"0",w:75},
            {label:"คิลศัตรู",key:"enemyScore",type:"number",placeholder:"0",w:75},
            {label:"เวลา(นาที)",key:"duration",type:"number",placeholder:"18",w:88},
          ].map(f=>(
            <div key={f.key}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>{f.label}</div>
              {f.type==="select"
                ?<select value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12,fontWeight:700,
                      color:meta[f.key]==="WIN"?C.win:C.lose}}>
                    {f.opts.map(o=><option key={o}>{o}</option>)}
                  </select>
                :<input type={f.type} placeholder={f.placeholder} value={meta[f.key]}
                    onChange={e=>dispatch({type:"SET_META",payload:{[f.key]:e.target.value}})}
                    style={{...iStyle,width:f.w,padding:"5px 8px",fontSize:12}}/>
              }
            </div>
          ))}
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:C.textMuted,marginBottom:3}}>Coach Notes</div>
            <input placeholder="วิเคราะห์เกมนี้..." value={meta.note}
              onChange={e=>dispatch({type:"SET_META",payload:{note:e.target.value}})}
              style={{...iStyle,padding:"5px 10px",fontSize:12}}/>
          </div>
          <button onClick={handleGameDone}
            style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
              color:"#fff",border:"none",borderRadius:8,padding:"8px 22px",
              cursor:"pointer",fontWeight:800,fontSize:13,whiteSpace:"nowrap"}}>
            ✅ บันทึก Game {currentGame}
          </button>
        </div>
      </div>
    </div>
  );

  // ── DONE ──
  const ourWins = completedGames.filter(g=>g.result==="WIN").length;
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 60px)",gap:16,background:C.bgBase}}>
      <div style={{fontSize:52}}>{ourWins>completedGames.length/2?"🏆":"😔"}</div>
      <h2 style={{margin:0,fontSize:22,fontWeight:800}}>{boType} เสร็จสิ้น: vs {rivalName}</h2>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        {completedGames.map((g,i)=>(
          <span key={i} style={{padding:"5px 16px",borderRadius:99,fontWeight:800,
            background:g.result==="WIN"?C.win+"20":C.lose+"20",
            color:g.result==="WIN"?C.win:C.lose}}>
            G{i+1} {g.result}
          </span>
        ))}
      </div>
      <p style={{color:C.textMuted,fontSize:13,margin:0}}>บันทึกลง Match Log เรียบร้อย!</p>
      <button onClick={()=>dispatch({type:"RESET"})}
        style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,
          color:"#fff",border:"none",borderRadius:10,padding:"12px 32px",
          fontWeight:800,fontSize:15,cursor:"pointer",marginTop:8}}>
        ⚔️ เริ่ม Session ใหม่
      </button>
    </div>
  );
}

// TeamPanel renamed to TeamPanelR (same logic, already stateless)
function TeamPanelR({ side, isOurTeam, bans, picks, cur, roster, enemyRoster=[], onPlayerChange }) {
  const color       = side==="blue" ? C.blue : C.red;
  const isActive    = cur?.team===side;
  const isBanPhase  = cur?.action==="ban";
  const isPickPhase = cur?.action==="pick";
  const usedPlayers = new Set(picks.map(s=>s.player).filter(Boolean));

  return (
    <div style={{width:190,background:"#0e0b1e",
      borderRight:side==="blue"?`1px solid ${C.border}`:"none",
      borderLeft: side==="red" ?`1px solid ${C.border}`:"none",
      padding:"12px 10px",display:"flex",flexDirection:"column",gap:10,
      boxShadow:isActive?`inset 0 0 0 2px ${color}50`:"none",
      transition:"box-shadow .2s",overflowY:"auto"}}>
      <div style={{textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
          <span style={{fontWeight:900,fontSize:14,color,letterSpacing:1}}>
            {side==="blue"?"BLUE":"RED"}
          </span>
        </div>
        <div style={{marginTop:4}}>
          <span style={{fontSize:10,fontWeight:800,padding:"2px 10px",borderRadius:99,
            background:isOurTeam?C.win+"25":C.lose+"20",color:isOurTeam?C.win:C.lose,
            border:`1px solid ${isOurTeam?C.win+"60":C.lose+"50"}`}}>
            {isOurTeam?"🛡️ ทีมเรา":"⚔️ คู่แข่ง"}
          </span>
        </div>
        {isActive&&(
          <div style={{fontSize:10,color,background:color+"20",borderRadius:99,
            padding:"2px 8px",marginTop:4,fontWeight:700,display:"inline-block"}}>
            {isBanPhase?"🚫 กำลัง BAN":"⚔️ กำลัง PICK"}
          </div>
        )}
      </div>
      <div>
        <div style={{fontSize:10,color:C.ban,fontWeight:700,marginBottom:5,letterSpacing:1}}>— BAN —</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {bans.map((hero,i)=>{
            const isCur=isActive&&isBanPhase&&cur?.slot===i&&!hero;
            return (
              <div key={i} style={{borderRadius:8,overflow:"hidden",
                border:isCur?`2px solid ${C.ban}`:`2px solid ${C.border}`,
                background:C.bgPanel,height:60,display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:isCur?`0 0 10px ${C.ban}70`:"none"}}>
                {hero
                  ?<HeroCard hero={hero} size={56} banned showName={false}/>
                  :<span style={{fontSize:isCur?18:14,color:isCur?C.ban:"#2a1f4e"}}>{isCur?"🚫":"○"}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{height:1,background:C.border}}/>
      <div style={{flex:1}}>
        <div style={{fontSize:10,color,fontWeight:700,marginBottom:5,letterSpacing:1}}>— PICKS —</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {picks.map((slot,i)=>{
            const isCur=isActive&&isPickPhase&&cur?.slot===i&&!slot.hero;
            const availableRoster = isOurTeam ? roster : enemyRoster;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,
                background:isCur?color+"12":C.bgPanel,borderRadius:10,padding:"4px 7px",
                border:isCur?`2px solid ${color}`:`2px solid ${C.border}`,
                boxShadow:isCur?`0 0 10px ${color}50`:"none",
                minHeight:55,transition:"all .2s"}}>
                {slot.hero ? (
                  <div style={{display:"flex",flexDirection:"column",gap:3,width:"100%"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <HeroCard hero={slot.hero} size={40} showName={false}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:800,lineHeight:1.2}}>{slot.hero.name}</div>
                        <div style={{fontSize:10,color:ROLE_COLOR[slot.hero.role],fontWeight:700}}>{slot.role}</div>
                      </div>
                    </div>
                    <select value={slot.player||""} onChange={e=>onPlayerChange(i,e.target.value)}
                      style={{...iStyle,fontSize:11,padding:"3px 6px",
                        color:slot.player?(isOurTeam?C.primaryLight:C.lose):C.textMuted}}>
                      <option value="">— เลือกผู้เล่น —</option>
                      {availableRoster.map(p=>(
                        <option key={p} value={p} disabled={usedPlayers.has(p)&&slot.player!==p}>
                          {p}{usedPlayers.has(p)&&slot.player!==p?" ✓":""}
                        </option>
                      ))}
                      {availableRoster.length===0&&(
                        <option disabled value="">ไม่มี Roster — เพิ่มใน Roster</option>
                      )}
                    </select>
                  </div>
                ) : (
                  <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
                    <div style={{width:40,height:40,borderRadius:8,flexShrink:0,
                      border:`2px dashed ${isCur?color:C.border}`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <span style={{fontSize:18,color:isCur?color:"#2a2550"}}>{isCur?"✛":"+"}</span>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:isCur?color:"#3a3a5c",fontWeight:700}}>{slot.role}</div>
                      <div style={{fontSize:10,color:"#2a2550"}}>{isCur?"เลือก Hero":"รอ Pick"}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
