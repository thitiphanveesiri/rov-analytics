"use client";
import { matchTime } from "@/lib/matchTime";
import { C } from "@/lib/theme";
import { HERO_DATA, ROLES_PICK } from "@/lib/heroes";
import { HeroAvatar } from "@/components/shared/HeroImageManager";
import { HeroChip } from "@/components/shared/HeroChip";
import { useEffect, useState } from "react";
import { BANS_PER_TEAM, DRAFT_ORDER } from "@/components/draft/constants";


// ═══════════════════════════════════════════
//  DRAFT PAGE — refactored to use draftReducer
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  MOCK DRAFT TRAINER — ฝึกซ้อม draft กับ AI ที่จำลอง
//  พฤติกรรม pick/ban ของคู่แข่งจากข้อมูลจริง (ไม่นับเป็นแมตช์จริง)
// ═══════════════════════════════════════════
// ── ความน่าเชื่อถือของข้อมูลลดลงครึ่งหนึ่งทุกๆ 60 วัน กัน meta เก่า/patch เก่า
//    มาครอบงำการทำนายพฤติกรรมปัจจุบันของคู่แข่ง ──
const RECENCY_HALF_LIFE_DAYS = 60;
// ต่ำกว่านี้ถือว่าข้อมูลทีมคู่แข่ง "บาง" — แสดงคำเตือนในหน้า setup
const MIN_RELIABLE_SAMPLES = 10;
function recencyWeight(idMs) {
  if (!idMs) return 1;
  const ageDays = Math.max(0, (Date.now() - idMs) / (1000*60*60*24));
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

// เก็บความถี่ ban/pick แยกตามตำแหน่ง (slot) — ถ่วงน้ำหนักตามความใหม่ของข้อมูล
// rivalFilter = null → เก็บภาพรวม "meta" จากทุกทีม (ทั้งเราและคู่แข่งทุกคน)
// rivalFilter = "ชื่อทีม" → เก็บเฉพาะพฤติกรรมของทีมนั้นทีมเดียว
function collectFrequencies(allGames, scoutMatches, rivalFilter) {
  const bans  = Array.from({length: BANS_PER_TEAM}, () => new Map());
  const picks = Array.from({length: ROLES_PICK.length}, () => new Map());
  const add = (map, name, w) => { if (name && map) map.set(name, (map.get(name)||0) + w); };

  allGames.forEach(g=>{
    const w = recencyWeight(g._playedAt ?? g._matchId);
    if (!rivalFilter) {
      // meta ภาพรวม: นับทั้งฝั่งเราและฝั่งคู่แข่งทุกทีมที่เคยเจอ
      (g.ourBans||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
      (g.ourPicks||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
    }
    if (!rivalFilter || g.rivalName===rivalFilter) {
      (g.enemyBans||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
      (g.enemyPicks||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
    }
  });

  (scoutMatches||[]).forEach(sm=>{
    const w = recencyWeight(matchTime(sm));
    const isA = sm.teamA===rivalFilter, isB = sm.teamB===rivalFilter;
    if (rivalFilter && !isA && !isB) return;
    (sm.games||[]).forEach(g=>{
      if (!rivalFilter) {
        // meta ภาพรวม: นับทั้ง 2 ฝั่งของ scout log
        [["bansA","picksA"],["bansB","picksB"]].forEach(([bk,pk])=>{
          (g[bk]||[]).forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
          (g[pk]||[]).forEach((s,i)=>add(picks[i], s?.hero?.name, w));
        });
      } else {
        const gb = isA ? (g.bansA||[])  : (g.bansB||[]);
        const gp = isA ? (g.picksA||[]) : (g.picksB||[]);
        gb.forEach((b,i)=>add(bans[i], b?.name || (typeof b==="string"?b:null), w));
        gp.forEach((s,i)=>add(picks[i], s?.hero?.name, w));
      }
    });
  });

  return { bans, picks };
}

// นับจำนวนเกม "ดิบ" (ไม่ถ่วงน้ำหนัก) ที่มีข้อมูลของทีมนี้ — ใช้โชว์ความน่าเชื่อถือให้โค้ชเห็น
function countRivalSamples(rivalName, allGames, scoutMatches) {
  const fromMatches = allGames.filter(g=>g.rivalName===rivalName).length;
  const fromScout = (scoutMatches||[]).reduce((sum,sm)=>{
    if (sm.teamA===rivalName || sm.teamB===rivalName) return sum + (sm.games||[]).length;
    return sum;
  }, 0);
  return { fromMatches, fromScout, total: fromMatches + fromScout };
}

const TIER_BONUS = { "S+":5, "S":3, "A":1, "B":0, "C":0 };
const RIVAL_DATA_MULTIPLIER   = 4; // ให้น้ำหนักข้อมูล "เฉพาะทีมนี้" มากกว่าภาพรวม meta ทั่วไป
const COUNTER_DATA_MULTIPLIER = 5; // "เขาชอบตอบโต้ตัวนี้เวลาเราหยิบตัวนั้น" คือข้อมูลจำเพาะที่สุด ให้น้ำหนักสูงสุด

// ── สร้างสถิติ "counter-response": เมื่อเราหยิบฮีโร่ X ไปแล้ว คู่แข่งมักเลือก/แบนฮีโร่ Y
//    ตอบโต้บ่อยแค่ไหน — รีคอนสตรัคลำดับ draft แบบเต็มจาก DRAFT_ORDER + ourSide ของแต่ละเกมจริง
//    (ใช้เฉพาะแมตช์จริงของเราเท่านั้น เพราะ scout log ไม่ได้บันทึกฝั่ง blue/red ไว้แน่ชัดพอจะ
//    รีคอนสตรัคลำดับเป๊ะๆ ได้ — ถ้าเดาผิดจะให้ข้อมูลที่ผิดยิ่งกว่าไม่มีข้อมูล)
function collectCounterResponses(allGames, rivalFilter) {
  const banResponses  = new Map(); // ourHero -> Map(enemyHero -> weight)
  const pickResponses = new Map();

  allGames.forEach(g=>{
    if (rivalFilter && g.rivalName !== rivalFilter) return;
    if (!g.ourSide) return; // ข้อมูลเก่าที่ไม่ได้เก็บฝั่งไว้ ข้ามไปกันข้อมูลผิด
    const w = recencyWeight(g._playedAt ?? g._matchId);

    const sequence = DRAFT_ORDER.map(step=>{
      const isOur = step.team === g.ourSide;
      const hero = step.action==="ban"
        ? (isOur ? g.ourBans : g.enemyBans)?.[step.slot]?.name || null
        : (isOur ? g.ourPicks : g.enemyPicks)?.[step.slot]?.hero?.name || null;
      return { isOur, action: step.action, hero };
    });

    const revealedOurPicks = [];
    sequence.forEach(({ isOur, action, hero }) => {
      if (!isOur && hero) {
        const targetMap = action==="ban" ? banResponses : pickResponses;
        revealedOurPicks.forEach(ourHero=>{
          if (!targetMap.has(ourHero)) targetMap.set(ourHero, new Map());
          const m = targetMap.get(ourHero);
          m.set(hero, (m.get(hero)||0) + w);
        });
      }
      if (isOur && action==="pick" && hero) revealedOurPicks.push(hero);
    });
  });

  return { banResponses, pickResponses };
}

// รวม counter-response ของ "ฮีโร่ที่เรา reveal ไปแล้วในดราฟต์ปัจจุบัน" เข้าด้วยกัน
// พร้อมจำไว้ว่าฮีโร่เราตัวไหนเป็นตัว "กระตุ้น" การตอบโต้นั้นมากที่สุด (ไว้โชว์เหตุผล)
function buildCounterBonus(responseTable, revealedOurHeroes) {
  const combined = new Map();
  const triggeredBy = new Map(); // enemyHero -> { ourHero, weight }
  revealedOurHeroes.forEach(ourHero=>{
    const m = responseTable.get(ourHero);
    if (!m) return;
    m.forEach((w,enemyHero)=>{
      combined.set(enemyHero, (combined.get(enemyHero)||0) + w);
      const best = triggeredBy.get(enemyHero);
      if (!best || w > best.weight) triggeredBy.set(enemyHero, { ourHero, weight: w });
    });
  });
  return { combined, triggeredBy };
}

// รวม 4 ชั้นข้อมูลเข้าด้วยกัน แล้วสุ่มแบบถ่วงน้ำหนัก พร้อมบอกว่าผลลัพธ์มาจากชั้นไหน
// (เพื่อโชว์เหตุผลให้โค้ชเห็น ไม่ใช่ black box)
function weightedChoiceWithSource(rivalMap, globalMap, counterMap, counterTriggers, heroTiers, type, exclude) {
  const combined = new Map();
  (rivalMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w*RIVAL_DATA_MULTIPLIER); });
  (globalMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w); });
  (counterMap||new Map()).forEach((w,h)=>{ if(!exclude.has(h)) combined.set(h, (combined.get(h)||0) + w*COUNTER_DATA_MULTIPLIER); });
  if (type==="picks" && heroTiers) {
    Object.entries(heroTiers).forEach(([hero,tier])=>{
      if (exclude.has(hero)) return;
      const bonus = TIER_BONUS[tier] || 0;
      if (bonus) combined.set(hero, (combined.get(hero)||0) + bonus);
    });
  }

  const entries = [...combined.entries()];
  if (!entries.length) {
    return { hero: randomHeroExcluding(exclude), source: "random" };
  }
  const total = entries.reduce((s,[,c])=>s+c, 0);
  let r = Math.random() * total;
  let picked = entries[entries.length-1][0];
  for (const [h,c] of entries) { r -= c; if (r<=0) { picked = h; break; } }

  if (counterMap?.has(picked) && counterMap.get(picked)>0) {
    const trigger = counterTriggers?.get(picked);
    return { hero: picked, source: "counter", trigger };
  }
  const source = (rivalMap?.has(picked) && rivalMap.get(picked)>0) ? "rival"
               : (globalMap?.has(picked) && globalMap.get(picked)>0) ? "global"
               : "tier";
  return { hero: picked, source };
}

function randomHeroExcluding(exclude) {
  const pool = HERO_DATA.filter(h=>!exclude.has(h.name));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)].name;
}

const SOURCE_LABEL = {
  counter:{ icon:"🔁", text:"counter-pick ที่คู่แข่งชอบตอบโต้" },
  rival:  { icon:"🎯", text:"ข้อมูลเฉพาะทีมนี้" },
  global: { icon:"🌐", text:"ภาพรวม meta ทั่วไป" },
  tier:   { icon:"⭐", text:"Tier List ที่โค้ชตั้งไว้" },
  random: { icon:"🎲", text:"สุ่ม (ไม่มีข้อมูลอ้างอิง)" },
};

export function MockDraftTrainer({ rivals, allGames, scoutMatches, heroTiers, onExit }) {
  const [phase, setPhase]         = useState("setup"); // setup | drafting | done
  const [rivalName, setRivalName] = useState(rivals[0]?.name || "");
  const [ourSide, setOurSide]     = useState("blue");
  const [freq, setFreq]           = useState(null); // { rival:{bans,picks}, global:{bans,picks} }
  const [state, setState]         = useState(null);
  const [thinking, setThinking]   = useState(false);
  const [search, setSearch]       = useState("");
  const [lastSource, setLastSource] = useState(null); // { hero, source } — เหตุผลของการเลือกล่าสุด

  const sampleCounts = rivalName ? countRivalSamples(rivalName, allGames, scoutMatches) : {fromMatches:0,fromScout:0,total:0};
  const hasData = sampleCounts.total > 0;

  function start() {
    setFreq({
      rival:   collectFrequencies(allGames, scoutMatches, rivalName),
      global:  collectFrequencies(allGames, scoutMatches, null),
      counter: collectCounterResponses(allGames, rivalName),
    });
    setLastSource(null);
    setState({
      step: 0,
      blueBans: Array(BANS_PER_TEAM).fill(null), redBans: Array(BANS_PER_TEAM).fill(null),
      bluePicks: ROLES_PICK.map(r=>({role:r,hero:null})),
      redPicks:  ROLES_PICK.map(r=>({role:r,hero:null})),
    });
    setPhase("drafting");
  }

  const cur = state && state.step < DRAFT_ORDER.length ? DRAFT_ORDER[state.step] : null;
  const enemySide = ourSide==="blue" ? "red" : "blue";
  const isOurTurn = cur && cur.team===ourSide;
  const isDone = state && state.step >= DRAFT_ORDER.length;

  const usedNames = state ? new Set([
    ...state.blueBans.filter(Boolean).map(h=>h.name),
    ...state.redBans.filter(Boolean).map(h=>h.name),
    ...state.bluePicks.filter(p=>p.hero).map(p=>p.hero.name),
    ...state.redPicks.filter(p=>p.hero).map(p=>p.hero.name),
  ]) : new Set();

  function placeHero(name) {
    if (!cur || !name) return;
    setState(prev=>{
      const next = { ...prev, step: prev.step+1 };
      const heroObj = { name };
      if (cur.action==="ban") {
        if (cur.team==="blue") { next.blueBans=[...prev.blueBans]; next.blueBans[cur.slot]=heroObj; }
        else { next.redBans=[...prev.redBans]; next.redBans[cur.slot]=heroObj; }
      } else {
        if (cur.team==="blue") { next.bluePicks=[...prev.bluePicks]; next.bluePicks[cur.slot]={...prev.bluePicks[cur.slot],hero:heroObj}; }
        else { next.redPicks=[...prev.redPicks]; next.redPicks[cur.slot]={...prev.redPicks[cur.slot],hero:heroObj}; }
      }
      return next;
    });
  }

  // ── ให้ "คู่แข่งจำลอง" เดินเองอัตโนมัติ โดยผสม 3 ชั้นข้อมูล:
  //    1) พฤติกรรมเฉพาะทีมนี้ (น้ำหนักสูงสุด) 2) ภาพรวม meta ปัจจุบัน 3) Tier List ที่โค้ชตั้งไว้ ──
  useEffect(() => {
    if (phase!=="drafting" || !cur || isOurTurn || thinking) return;
    setThinking(true);
    const t = setTimeout(() => {
      const type = cur.action==="ban" ? "bans" : "picks";
      const rivalMap  = freq?.rival?.[type]?.[cur.slot];
      const globalMap = freq?.global?.[type]?.[cur.slot];

      const ourPicksArr = ourSide==="blue" ? state.bluePicks : state.redPicks;
      const revealedOurHeroes = ourPicksArr.filter(p=>p.hero).map(p=>p.hero.name);
      const counterTable = cur.action==="ban" ? freq?.counter?.banResponses : freq?.counter?.pickResponses;
      const { combined: counterMap, triggeredBy } = buildCounterBonus(counterTable || new Map(), revealedOurHeroes);

      const result = weightedChoiceWithSource(rivalMap, globalMap, counterMap, triggeredBy, heroTiers, type, usedNames);
      setLastSource(result);
      placeHero(result.hero);
      setThinking(false);
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state?.step]);

  if (phase==="setup") return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",
      minHeight:"calc(100vh - 56px)",background:C.bgBase,padding:16}}>
      <div style={{width:440,maxWidth:"100%",background:C.bgPanel,borderRadius:20,padding:30,
        border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:34,marginBottom:6}}>🧠</div>
          <h2 style={{margin:0,fontSize:19,fontWeight:800}}>ฝึกซ้อม Draft (Mock)</h2>
          <p style={{margin:"6px 0 0",fontSize:12,color:C.textMuted}}>
            ระบบจะจำลองคู่แข่งเลือก/แบนฮีโร่ตามแพทเทิร์นจริงที่เคยเจอมา — ไม่นับเป็นแมตช์จริง
          </p>
          <p style={{margin:"6px 0 0",fontSize:11,color:C.textMuted,opacity:0.8}}>
            รวมถึง "counter-pick" ที่คู่แข่งเคยตอบโต้เวลาเราหยิบฮีโร่บางตัว (จากแมตช์จริงเท่านั้น)
          </p>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ฝึกซ้อมกับทีมไหน</div>
          <select value={rivalName} onChange={e=>setRivalName(e.target.value)}
            style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
              color:C.textMain,borderRadius:8,padding:"9px 12px",fontSize:13,outline:"none"}}>
            <option value="">— เลือกทีมคู่แข่ง —</option>
            {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
          </select>
          {rivalName && !hasData && (
            <div style={{marginTop:8,fontSize:11,color:"#feca57"}}>
              ⚠️ ยังไม่มีข้อมูลแมตช์/scout ของทีมนี้เลย — จะใช้ภาพรวม meta ทั่วไปกับ Tier List แทน
            </div>
          )}
          {rivalName && hasData && (
            sampleCounts.total < MIN_RELIABLE_SAMPLES ? (
              // ข้อมูลบาง: ความถี่ ban/pick จากไม่กี่เกมแทบเป็นเสียงรบกวน — เตือนชัดๆ ให้โค้ชไม่เชื่อ AI เกินจริง
              <div style={{marginTop:8,padding:"8px 12px",background:"#feca5712",
                border:"1px solid #feca5750",borderRadius:8,fontSize:11,color:"#feca57"}}>
                ⚠️ มีข้อมูลแค่ {sampleCounts.total} เกม ({sampleCounts.fromMatches} จากแมตช์จริง, {sampleCounts.fromScout} จาก scout log)
                — น้อยกว่า {MIN_RELIABLE_SAMPLES} เกม พฤติกรรมที่ AI จำลองอาจไม่ตรงกับทีมนี้จริง ใช้เป็นแค่แนวทาง
                (ถ้าข้อมูลทีมนี้ไม่พอ ระบบจะผสมภาพรวม meta และ Tier List เข้ามาด้วย)
              </div>
            ) : (
            <div style={{marginTop:8,padding:"8px 12px",background:C.primary+"10",
              border:`1px solid ${C.primary}30`,borderRadius:8,fontSize:11,color:C.primaryLight}}>
              ✅ มีข้อมูล {sampleCounts.total} เกม ({sampleCounts.fromMatches} จากแมตช์จริง, {sampleCounts.fromScout} จาก scout log)
              — ยิ่งเยอะ AI ยิ่งแม่นยำขึ้น (ข้อมูลเก่ากว่า 60 วันจะถูกลดน้ำหนักลงเรื่อยๆ)
            </div>
            )
          )}
        </div>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:12,color:C.textMuted,marginBottom:6,fontWeight:700}}>ทีมเรา</div>
          <div style={{display:"flex",gap:8}}>
            {[{v:"blue",l:"🔵 ฝั่งน้ำเงิน"},{v:"red",l:"🔴 ฝั่งแดง"}].map(o=>(
              <button key={o.v} onClick={()=>setOurSide(o.v)}
                style={{flex:1,background:ourSide===o.v?C.primary+"30":"transparent",
                  border:`1px solid ${ourSide===o.v?C.primary:C.border}`,
                  color:ourSide===o.v?C.primaryLight:C.textMuted,borderRadius:9,
                  padding:"9px 0",cursor:"pointer",fontSize:12,fontWeight:700}}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onExit} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMuted,borderRadius:9,padding:"11px 0",cursor:"pointer",fontWeight:700,fontSize:13}}>
            ← กลับ
          </button>
          <button onClick={start} disabled={!rivalName}
            style={{flex:2,background:rivalName?C.primary:C.border,color:"#fff",border:"none",borderRadius:9,
              padding:"11px 0",cursor:rivalName?"pointer":"default",fontWeight:800,fontSize:13}}>
            🚀 เริ่มฝึกซ้อม
          </button>
        </div>
      </div>
    </div>
  );

  const filteredHeroes = HERO_DATA.filter(h=>
    !usedNames.has(h.name) && h.name.toLowerCase().includes(search.toLowerCase())
  );

  const BoardSide = ({ side, label, col }) => {
    const bansArr  = side==="blue" ? state.blueBans  : state.redBans;
    const picksArr = side==="blue" ? state.bluePicks : state.redPicks;
    return (
      <div style={{flex:1,minWidth:260}}>
        <div style={{fontWeight:800,fontSize:12,color:col,marginBottom:8}}>
          {label} {side===ourSide?"(เรา)":"(จำลอง)"}
        </div>
        <div style={{display:"flex",gap:5,marginBottom:10}}>
          {bansArr.map((b,i)=>(
            <div key={i} style={{width:34,height:34,borderRadius:8,overflow:"hidden",
              border:`1px solid ${C.border}`,opacity:b?1:0.4,filter:b?"grayscale(60%)":"none",
              display:"flex",alignItems:"center",justifyContent:"center",background:C.bgCard,fontSize:9}}>
              {b ? <HeroAvatar name={b.name} team={side===ourSide?"our":"enemy"} size={34}/> : "🚫"}
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {picksArr.map((p,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,background:C.bgCard,
              borderRadius:8,padding:"5px 8px",border:`1px solid ${C.border}`}}>
              <span style={{fontSize:9,color:C.textMuted,width:52,flexShrink:0}}>{p.role}</span>
              {p.hero ? <HeroChip name={p.hero.name} size={24} fontSize={11}/> :
                <span style={{fontSize:11,color:C.textMuted}}>—</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{padding:"16px 24px 40px",maxWidth:920,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div>
          <h2 style={{margin:0,fontSize:18,fontWeight:800}}>🧠 ฝึกซ้อม Draft vs {rivalName}</h2>
          <p style={{margin:"2px 0 0",fontSize:11,color:C.textMuted}}>โหมดฝึกซ้อม — ไม่นับเป็นแมตช์จริง</p>
        </div>
        <button onClick={onExit} style={{background:"transparent",border:`1px solid ${C.border}`,
          color:C.textMuted,borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
          ✕ ออกจากโหมดฝึกซ้อม
        </button>
      </div>

      {!isDone ? (
        <>
          <div style={{textAlign:"center",marginBottom:14,padding:"10px 0",
            background: isOurTurn ? C.primary+"15" : "#feca5715",
            border:`1px solid ${isOurTurn?C.primary:"#feca57"}40`, borderRadius:10}}>
            {isOurTurn ? (
              <span style={{fontSize:13,fontWeight:800,color:C.primaryLight}}>
                🎯 ตาคุณ — {cur.action==="ban"?"เลือกฮีโร่ที่จะ Ban":"เลือกฮีโร่ที่จะ Pick"} ({ROLES_PICK[cur.slot]||""})
              </span>
            ) : (
              <span style={{fontSize:13,fontWeight:700,color:"#feca57"}}>
                🤖 คู่แข่งจำลองกำลังเลือก{cur?.action==="ban"?"ฮีโร่ที่จะแบน":"ฮีโร่"}...
              </span>
            )}
            {lastSource && !thinking && (
              <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>
                ↳ เลือก <b style={{color:C.textMain}}>{lastSource.hero}</b> จาก {SOURCE_LABEL[lastSource.source].icon} {SOURCE_LABEL[lastSource.source].text}
                {lastSource.source==="counter" && lastSource.trigger && (
                  <> — เพราะเราหยิบ <b style={{color:C.textMain}}>{lastSource.trigger.ourHero}</b> ไปก่อนหน้านี้</>
                )}
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
            <BoardSide side="blue" label="🔵 ฝั่งน้ำเงิน" col="#4a9eff"/>
            <BoardSide side="red"  label="🔴 ฝั่งแดง"     col="#ff6b6b"/>
          </div>

          {isOurTurn && (
            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:14}}>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 ค้นหา Hero..." autoFocus
                style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                  color:C.textMain,borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",marginBottom:10}}/>
              <div style={{maxHeight:280,overflowY:"auto",display:"grid",
                gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:6}}>
                {filteredHeroes.map(h=>(
                  <button key={h.name} onClick={()=>placeHero(h.name)}
                    style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                      borderRadius:8,padding:"8px 4px",cursor:"pointer",fontSize:10,fontWeight:700,
                      display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <HeroAvatar name={h.name} team="our" size={32}/>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",textAlign:"center"}}>
                      {h.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{textAlign:"center",padding:"30px 0"}}>
          <div style={{fontSize:36,marginBottom:10}}>🏁</div>
          <h3 style={{margin:"0 0 16px",fontSize:17,fontWeight:800,color:C.primaryLight}}>จบการฝึกซ้อมแล้ว!</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",marginBottom:20}}>
            <BoardSide side="blue" label="🔵 ฝั่งน้ำเงิน" col="#4a9eff"/>
            <BoardSide side="red"  label="🔴 ฝั่งแดง"     col="#ff6b6b"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={()=>setPhase("setup")} style={{background:C.primary,color:"#fff",border:"none",
              borderRadius:9,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>
              🔄 ฝึกใหม่
            </button>
            <button onClick={onExit} style={{background:"transparent",border:`1px solid ${C.border}`,
              color:C.textMuted,borderRadius:9,padding:"10px 24px",cursor:"pointer",fontWeight:700,fontSize:13}}>
              ออกจากโหมดฝึกซ้อม
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
