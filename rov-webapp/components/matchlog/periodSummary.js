"use client";
import { matchTime } from "@/lib/matchTime";
import { C } from "@/lib/theme";
import { HeroChip } from "@/components/shared/HeroChip";
import { playedMinutes, minutesToDurationStr } from "@/lib/duration";
import { useEffect, useMemo, useRef, useState } from "react";


// ═══════════════════════════════════════════
//  WEEKLY / MONTHLY SUMMARY — สรุปผลซ้อม 7 วัน / 30 วันล่าสุด เทียบกับ
//  ช่วงก่อนหน้า (ไม่มี AI แค่คำนวณจากข้อมูลจริงล้วนๆ) — ทีมรวม + รายบุคคล
// ═══════════════════════════════════════════

function fmtKDA(k,d,a) {
  const ratio = d>0 ? (k+a)/d : (k+a>0 ? null : 0); // null = "Perfect" (ไม่เคยตาย แต่มี kill/assist)
  return { k, d, a, ratio, label: ratio===null ? "Perfect" : ratio.toFixed(2) };
}

// สรุปสถิติรายผู้เล่นจากลิสต์เกมที่ให้มา (ใช้ทั้งช่วงปัจจุบันและช่วงก่อนหน้า
// เพื่อคำนวณ delta ทีหลัง)
function summarizePlayers(games) {
  const byPlayer = {};

  games.forEach(g => {
    const picks = g.ourPicks || [];
    // เวลาเล่นจริงของเกมนี้ (หัก pauseDuration ออกแล้ว เหมือน avgGameDuration
    // ฝั่ง Overview — กันเวลาที่หยุดเกมมาปนสถิติ per-minute)
    const durMin = g.duration
      ? playedMinutes(g)
      : null;

    picks.forEach((p, idx) => {
      const player = (p.player||"").trim();
      const heroName = p.hero?.name;
      if (!player) return; // ช่องที่ยังไม่ได้กรอกชื่อผู้เล่น ข้ามไป

      if (!byPlayer[player]) byPlayer[player] = {
        games:0, wins:0, kills:0, deaths:0, assists:0,
        damage:0, gold:0, damageTaken:0, minutesWithStats:0,
        heroTally:{},
      };
      const rec = byPlayer[player];
      rec.games++;
      if (g.result==="WIN") rec.wins++;

      const stat = g.gameStats?.our?.[idx];
      if (stat) {
        rec.kills += stat.kills||0;
        rec.deaths += stat.deaths||0;
        rec.assists += stat.assists||0;
        rec.damage += stat.damage||0;
        rec.gold += stat.gold||0;
        rec.damageTaken += stat.damageTaken||0;
        if (durMin) rec.minutesWithStats += durMin;
      }

      if (heroName) {
        if (!rec.heroTally[heroName]) rec.heroTally[heroName] = {
          games:0, wins:0, kills:0, deaths:0, assists:0,
          damage:0, gold:0, damageTaken:0, minutesWithStats:0,
        };
        const ht = rec.heroTally[heroName];
        ht.games++;
        if (g.result==="WIN") ht.wins++;
        if (stat) {
          ht.kills += stat.kills||0;
          ht.deaths += stat.deaths||0;
          ht.assists += stat.assists||0;
          ht.damage += stat.damage||0;
          ht.gold += stat.gold||0;
          ht.damageTaken += stat.damageTaken||0;
          if (durMin) ht.minutesWithStats += durMin;
        }
      }
    });
  });

  const result = {};
  Object.entries(byPlayer).forEach(([player, rec]) => {
    const wr = rec.games ? Math.round(rec.wins/rec.games*100) : null;
    const kda = fmtKDA(
      +(rec.kills/rec.games).toFixed(1),
      +(rec.deaths/rec.games).toFixed(1),
      +(rec.assists/rec.games).toFixed(1)
    );
    const dpm = rec.minutesWithStats ? Math.round(rec.damage/rec.minutesWithStats) : null;
    const goldPerMin = rec.minutesWithStats ? Math.round(rec.gold/rec.minutesWithStats) : null;
    const avgDamageTaken = rec.games ? Math.round(rec.damageTaken/rec.games) : null;

    const topHeroes = Object.entries(rec.heroTally)
      .sort((a,b)=>b[1].games-a[1].games)
      .slice(0,3)
      .map(([name,v])=>({
        name, games:v.games, wins:v.wins,
        wr: Math.round(v.wins/v.games*100),
        kda: fmtKDA(
          +(v.kills/v.games).toFixed(1),
          +(v.deaths/v.games).toFixed(1),
          +(v.assists/v.games).toFixed(1)
        ),
        dpm: v.minutesWithStats ? Math.round(v.damage/v.minutesWithStats) : null,
        goldPerMin: v.minutesWithStats ? Math.round(v.gold/v.minutesWithStats) : null,
        avgDamageTaken: v.games ? Math.round(v.damageTaken/v.games) : null,
      }));

    // ฮีโร่ win rate สูงสุด — ต้องเล่นอย่างน้อยครึ่งหนึ่งของเกมทั้งหมดของ
    // ผู้เล่นคนนั้นในช่วงนี้ ถึงจะเข้าเกณฑ์ (กันฮีโร่ที่เล่นแค่เกมเดียวแล้ว
    // ชนะ ดันอันดับ win rate สูงลอยๆ ทั้งที่ยังไม่มีนัยสำคัญ)
    const threshold = Math.ceil(rec.games/2);
    const qualifyingHeroes = Object.entries(rec.heroTally)
      .filter(([,v]) => v.games >= threshold)
      .map(([name,v]) => ({ name, games:v.games, wr: Math.round(v.wins/v.games*100) }))
      .sort((a,b)=>b.wr-a.wr || b.games-a.games);
    const bestHero = qualifyingHeroes[0] || null;

    result[player] = { games: rec.games, wins: rec.wins, wr, kda, dpm, goldPerMin, avgDamageTaken, topHeroes, bestHero };
  });
  return result;
}

// ── date helpers for the week/month picker ──
function startOfWeekMon(d) {
  const date = new Date(d); date.setHours(0,0,0,0);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // ให้จันทร์เป็นวันแรกของสัปดาห์
  date.setDate(date.getDate() + diff);
  return date;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function addMonths(d, n) { const r = new Date(d.getFullYear(), d.getMonth()+n, 1); return r; }

// รับช่วงเวลาแบบระบุตรงๆ (ไม่ใช่ "ย้อนหลัง N วันจากตอนนี้" แบบเดิม) — เพื่อ
// ให้เลือกดูสัปดาห์/เดือนไหนก็ได้ ไม่ใช่แค่สัปดาห์/เดือนปัจจุบัน ช่วงก่อน
// หน้าคำนวณจากความยาวช่วงเดียวกันที่อยู่ก่อนหน้า rangeStart ทันที
function summarizePeriodByRange(matches, rangeStart, rangeEnd) {
  const periodStart = rangeStart.getTime();
  const periodEnd   = rangeEnd.getTime();
  const spanMs       = periodEnd - periodStart;
  const prevStart    = periodStart - spanMs;
  const prevEnd      = periodStart;

  const flatten = (ms) => ms.flatMap(m =>
    Array.isArray(m.games) && m.games.length > 0
      ? m.games.map(g => ({ ...g, _matchId: m.id, _playedAt: matchTime(m) }))
      : [{ ...m, _matchId: m.id, _playedAt: matchTime(m) }]
  );

  const inRange = (g, start, end) => g._playedAt >= start && g._playedAt < end;

  const allGames = flatten(matches);
  const current  = allGames.filter(g => inRange(g, periodStart, periodEnd));
  const previous = allGames.filter(g => inRange(g, prevStart, prevEnd));

  function stats(games) {
    const total = games.length;
    const wins  = games.filter(g=>g.result==="WIN").length;
    const wr    = total ? Math.round(wins/total*100) : null;
    const withDur = games.filter(g=>g.duration);
    const avgDuration = withDur.length
      ? withDur.reduce((s,g)=> s + playedMinutes(g), 0) / withDur.length
      : null;
    return { total, wins, losses: total-wins, wr, avgDuration };
  }

  const cur = stats(current), prev = stats(previous);

  const heroTally = {};
  current.forEach(g => {
    (g.ourPicks||[]).forEach(p => {
      const name = p.hero?.name;
      if (!name) return;
      if (!heroTally[name]) heroTally[name] = { picks:0, wins:0 };
      heroTally[name].picks++;
      if (g.result==="WIN") heroTally[name].wins++;
    });
  });
  const topHeroes = Object.entries(heroTally)
    .sort((a,b)=>b[1].picks-a[1].picks)
    .slice(0,3)
    .map(([name,v])=>({ name, games:v.picks, wr: Math.round(v.wins/v.picks*100) }));

  // ── Hero pick/ban breakdown for this period — ทีมเราเท่านั้น ──
  // Different from heroTally above (same underlying source, actually —
  // ourPicks only — but this version also tracks bans and the blue/red
  // side split) so the period card can show "X heroes picked, Y heroes
  // banned this week/month" with a full table (pick count, win rate,
  // blue count, red count), scoped entirely to OUR team's own picks/bans.
  // Enemy picks/bans are intentionally excluded — this is meant to answer
  // "what did we draft this week/month", not a scouting report on
  // whoever we happened to face.
  //
  // `g.ourSide` records which side WE played on for that specific game;
  // older matches that predate this field being tracked default to
  // treating "our" as blue — same convention already used elsewhere in
  // this file (see the isBlueOur pattern in matchGameToBlueRed) so this
  // stays consistent with how blue/red is derived everywhere else.
  const heroDraftStats = {};
  const heroBanStats = {};

  function bumpHeroPick(name, side, won) {
    if (!name) return;
    if (!heroDraftStats[name]) heroDraftStats[name] = { picks:0, wins:0, blue:0, red:0 };
    heroDraftStats[name].picks++;
    if (won) heroDraftStats[name].wins++;
    if (side === "blue") heroDraftStats[name].blue++;
    else heroDraftStats[name].red++;
  }

  // Bans don't have a win/loss of their own (a ban prevents the OTHER
  // team from playing that hero — it isn't "won" or "lost" the way a
  // pick is), so this only tracks how many times we banned each hero and
  // which side we were on when we did it — same shape as picks, minus
  // the win-rate column.
  function bumpHeroBan(name, side) {
    if (!name) return;
    if (!heroBanStats[name]) heroBanStats[name] = { bans:0, blue:0, red:0 };
    heroBanStats[name].bans++;
    if (side === "blue") heroBanStats[name].blue++;
    else heroBanStats[name].red++;
  }

  current.forEach(g => {
    const ourSideLabel = g.ourSide === "red" ? "red" : "blue"; // default blue if not recorded

    (g.ourPicks||[]).forEach(p => bumpHeroPick(p.hero?.name, ourSideLabel, g.result==="WIN"));
    (g.ourBans||[]).forEach(b => bumpHeroBan(b?.name || b, ourSideLabel));
  });

  const heroDraftList = Object.entries(heroDraftStats)
    .map(([name,v]) => ({ name, picks:v.picks, wr: v.picks ? Math.round(v.wins/v.picks*100) : 0, blue:v.blue, red:v.red }))
    .sort((a,b) => b.picks - a.picks);

  const heroBanList = Object.entries(heroBanStats)
    .map(([name,v]) => ({ name, bans:v.bans, blue:v.blue, red:v.red }))
    .sort((a,b) => b.bans - a.bans);

  const totalHeroesPicked = heroDraftList.length;
  const totalHeroesBanned = heroBanList.length;

  function teamCombatStats(games) {
    // รวมค่า damage/damageTaken/gold ของผู้เล่นทั้ง 5 คนต่อเกม แล้วเฉลี่ยเป็น
    // "ค่าเฉลี่ยทั้งทีมต่อเกม" — ต่างจากสถิติรายบุคคลที่แยกเป็นคนๆ ไป
    let dmgSum=0, dmgTakenSum=0, goldSum=0, gamesWithStats=0;
    games.forEach(g => {
      const our = g.gameStats?.our;
      if (!our) return;
      let gameDmg=0, gameDmgTaken=0, gameGold=0, hasAny=false;
      Object.values(our).forEach(s => {
        if (!s) return;
        gameDmg += s.damage||0;
        gameDmgTaken += s.damageTaken||0;
        gameGold += s.gold||0;
        hasAny = true;
      });
      if (hasAny) { dmgSum+=gameDmg; dmgTakenSum+=gameDmgTaken; goldSum+=gameGold; gamesWithStats++; }
    });
    return gamesWithStats ? {
      avgDamage: Math.round(dmgSum/gamesWithStats),
      avgDamageTaken: Math.round(dmgTakenSum/gamesWithStats),
      avgGold: Math.round(goldSum/gamesWithStats),
    } : { avgDamage:null, avgDamageTaken:null, avgGold:null };
  }
  const curTeamCombat = teamCombatStats(current);
  const prevTeamCombat = teamCombatStats(previous);
  const teamCombat = {
    ...curTeamCombat,
    avgDamageDelta: curTeamCombat.avgDamage!=null && prevTeamCombat.avgDamage!=null ? curTeamCombat.avgDamage-prevTeamCombat.avgDamage : null,
    avgDamageTakenDelta: curTeamCombat.avgDamageTaken!=null && prevTeamCombat.avgDamageTaken!=null ? curTeamCombat.avgDamageTaken-prevTeamCombat.avgDamageTaken : null,
    avgGoldDelta: curTeamCombat.avgGold!=null && prevTeamCombat.avgGold!=null ? curTeamCombat.avgGold-prevTeamCombat.avgGold : null,
  };

  const sorted = [...current].sort((a,b)=>b._playedAt-a._playedAt);
  let streak = 0, streakType = null;
  for (const g of sorted) {
    if (streakType===null) { streakType = g.result; streak = 1; }
    else if (g.result === streakType) streak++;
    else break;
  }

  // ── รายบุคคล + delta เทียบช่วงก่อนหน้า (จับคู่ตามชื่อผู้เล่นเดียวกัน) ──
  const curPlayers = summarizePlayers(current);
  const prevPlayers = summarizePlayers(previous);
  const players = Object.entries(curPlayers)
    .map(([name, p]) => {
      const prevP = prevPlayers[name];
      return {
        name, ...p,
        wrDelta: prevP?.wr!=null && p.wr!=null ? p.wr-prevP.wr : null,
        kdaDelta: prevP && p.kda.ratio!=null && prevP.kda.ratio!=null ? +(p.kda.ratio-prevP.kda.ratio).toFixed(2) : null,
        dpmDelta: prevP?.dpm!=null && p.dpm!=null ? p.dpm-prevP.dpm : null,
        goldPerMinDelta: prevP?.goldPerMin!=null && p.goldPerMin!=null ? p.goldPerMin-prevP.goldPerMin : null,
        avgDamageTakenDelta: prevP?.avgDamageTaken!=null && p.avgDamageTaken!=null ? p.avgDamageTaken-prevP.avgDamageTaken : null,
      };
    })
    .sort((a,b)=>b.games-a.games);

  return {
    ...cur,
    wrDelta: cur.wr!=null && prev.wr!=null ? cur.wr-prev.wr : null,
    avgDurationDelta: cur.avgDuration!=null && prev.avgDuration!=null ? cur.avgDuration-prev.avgDuration : null,
    topHeroes, teamCombat, streak, streakType, players,
    heroDraftList, heroBanList, totalHeroesPicked, totalHeroesBanned,
  };
}

function DeltaTag({ value, unit="", higherIsBetter=true, decimals=0 }) {
  if (value==null) return null;
  const good = higherIsBetter ? value>=0 : value<=0;
  const shown = Math.abs(value).toFixed(decimals);
  return (
    <span style={{fontSize:10,fontWeight:700,color: good?C.win:C.lose, marginLeft:6}}>
      {value>=0?"▲":"▼"}{shown}{unit}
    </span>
  );
}

function PlayerPeriodRow({ p }) {
  return (
    <div style={{background:C.card,borderRadius:10,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
        <div style={{fontWeight:800,fontSize:13}}>{p.name}</div>
        <div style={{fontSize:11,color:C.textMuted}}>
          {p.games} เกม · <span style={{color:p.wr>=50?C.win:C.lose,fontWeight:700}}>{p.wr}%</span>
          <DeltaTag value={p.wrDelta} unit="%"/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginTop:8}}>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>KDA</div>
          <div style={{fontSize:13,fontWeight:700}}>
            {p.kda.k}/{p.kda.d}/{p.kda.a}
            <span style={{fontSize:10,color:C.textMuted,marginLeft:4}}>({p.kda.label})</span>
          </div>
          <DeltaTag value={p.kdaDelta} decimals={2}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>DPM</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.dpm ?? "-"}</div>
          <DeltaTag value={p.dpmDelta}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>Gold/min</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.goldPerMin ?? "-"}</div>
          <DeltaTag value={p.goldPerMinDelta}/>
        </div>
        <div>
          <div style={{fontSize:9,color:C.textMuted}}>DMG Taken</div>
          <div style={{fontSize:13,fontWeight:700}}>{p.avgDamageTaken ?? "-"}</div>
          <DeltaTag value={p.avgDamageTakenDelta} higherIsBetter={false}/>
        </div>
      </div>

      {p.topHeroes.length>0 && (
        <div style={{marginTop:8}}>
          <div style={{fontSize:9,color:C.textMuted,marginBottom:6}}>ฮีโร่ที่เล่นบ่อยสุด</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {p.topHeroes.map(h=>(
              <div key={h.name} style={{background:C.bgPanel,borderRadius:8,padding:"8px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <HeroChip name={h.name} size={18} fontSize={11} textCol={h.wr>=50?C.win:C.lose}/>
                  <div style={{fontSize:10,color:C.textMuted}}>
                    {h.games} เกม · <span style={{color:h.wr>=50?C.win:C.lose,fontWeight:700}}>{h.wins}W-{h.games-h.wins}L ({h.wr}%)</span>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:6}}>
                  <div>
                    <div style={{fontSize:8,color:C.textMuted}}>KDA</div>
                    <div style={{fontSize:11,fontWeight:700}}>
                      {h.kda.k}/{h.kda.d}/{h.kda.a}
                      <span style={{fontSize:9,color:C.textMuted,marginLeft:3}}>({h.kda.label})</span>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:C.textMuted}}>DPM</div>
                    <div style={{fontSize:11,fontWeight:700}}>{h.dpm ?? "-"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:C.textMuted}}>Gold/min</div>
                    <div style={{fontSize:11,fontWeight:700}}>{h.goldPerMin ?? "-"}</div>
                  </div>
                  <div>
                    <div style={{fontSize:8,color:C.textMuted}}>DMG Taken</div>
                    <div style={{fontSize:11,fontWeight:700}}>{h.avgDamageTaken ?? "-"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.bestHero ? (
        <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>
          ⭐ ฮีโร่ win rate สูงสุด (เล่น ≥ครึ่งเกม): <b style={{color:C.textMain}}>{p.bestHero.name}</b> {p.bestHero.wr}% ({p.bestHero.games} เกม)
        </div>
      ) : (
        <div style={{marginTop:6,fontSize:11,color:C.textMuted}}>⭐ ยังไม่มีฮีโร่ที่เล่นถึงครึ่งของเกมทั้งหมดในช่วงนี้</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  CALENDAR POPUPS — เลือกสัปดาห์/เดือนที่ต้องการดูสถิติ
//  (ทำเป็น custom popup แทน <input type="week"/"month"> เพราะ input แบบ
//  native พวกนี้ Safari/มือถือหลายรุ่นไม่รองรับ หรือรองรับไม่ตรงกัน)
// ═══════════════════════════════════════════
const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const THAI_DAYS_SHORT = ["จ","อ","พ","พฤ","ศ","ส","อา"];

function WeekPickerPopup({ value, onSelect, onClose }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(value));
  const [hoverWeek, setHoverWeek] = useState(null);

  const gridStart = startOfWeekMon(viewMonth);
  const weeks = [];
  for (let w=0; w<6; w++) {
    const days = [];
    for (let d=0; d<7; d++) days.push(addDays(gridStart, w*7+d));
    weeks.push(days);
    if (days[6] >= addMonths(viewMonth,1) && w>=4) break; // ไม่ต้องโชว์แถวเกินจำเป็น
  }

  const selectedWeekStart = startOfWeekMon(value).getTime();

  return (
    <div style={{position:"absolute",top:"100%",left:0,marginTop:6,zIndex:300,
      background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",width:280}}
      onMouseLeave={()=>setHoverWeek(null)}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewMonth(addMonths(viewMonth,-1))}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>‹</button>
        <div style={{fontWeight:800,fontSize:13}}>{THAI_MONTHS_SHORT[viewMonth.getMonth()]} {viewMonth.getFullYear()+543}</div>
        <button onClick={()=>setViewMonth(addMonths(viewMonth,1))}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {THAI_DAYS_SHORT.map(d=>(
          <div key={d} style={{textAlign:"center",fontSize:10,color:C.textMuted,padding:"2px 0"}}>{d}</div>
        ))}
      </div>
      {weeks.map((days,wi) => {
        const weekStartMs = days[0].getTime();
        const isSelected = weekStartMs === selectedWeekStart;
        const isHovered = hoverWeek === wi;
        return (
          <div key={wi}
            onMouseEnter={()=>setHoverWeek(wi)}
            onClick={()=>{ onSelect(days[0]); onClose(); }}
            style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,cursor:"pointer",
              background: isSelected ? C.primary+"35" : isHovered ? C.primary+"18" : "transparent",
              borderRadius:6,marginBottom:1}}>
            {days.map((d,di)=>{
              const inMonth = d.getMonth()===viewMonth.getMonth();
              return (
                <div key={di} style={{textAlign:"center",fontSize:11,padding:"5px 0",
                  color: inMonth ? (isSelected?C.primaryLight:C.textMain) : C.textMuted+"80"}}>
                  {d.getDate()}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function MonthPickerPopup({ value, onSelect, onClose }) {
  const [viewYear, setViewYear] = useState(() => value.getFullYear());
  const selectedKey = `${value.getFullYear()}-${value.getMonth()}`;

  return (
    <div style={{position:"absolute",top:"100%",left:0,marginTop:6,zIndex:300,
      background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:12,padding:14,
      boxShadow:"0 8px 24px rgba(0,0,0,0.5)",width:260}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>setViewYear(y=>y-1)}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>‹</button>
        <div style={{fontWeight:800,fontSize:13}}>{viewYear+543}</div>
        <button onClick={()=>setViewYear(y=>y+1)}
          style={{background:"transparent",border:"none",color:C.textMuted,cursor:"pointer",fontSize:16,padding:4}}>›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
        {THAI_MONTHS_SHORT.map((m,mi)=>{
          const key = `${viewYear}-${mi}`;
          const isSelected = key === selectedKey;
          return (
            <button key={m} onClick={()=>{ onSelect(new Date(viewYear, mi, 1)); onClose(); }}
              style={{padding:"8px 0",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,
                border:`1px solid ${isSelected?C.primary:C.border}`,
                background:isSelected?C.primary+"35":"transparent",
                color:isSelected?C.primaryLight:C.textMain}}>
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DatePickerButton({ label, mode, value, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={wrapRef} style={{position:"relative"}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMuted,
          borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:11,fontWeight:700,
          display:"flex",alignItems:"center",gap:4}}>
        📅 {label}
      </button>
      {open && mode==="week" && (
        <WeekPickerPopup value={value} onSelect={onSelect} onClose={()=>setOpen(false)}/>
      )}
      {open && mode==="month" && (
        <MonthPickerPopup value={value} onSelect={onSelect} onClose={()=>setOpen(false)}/>
      )}
    </div>
  );
}

function PeriodSummaryCard({ title, dateRangeLabel, data, mode, pickerValue, onPickDate }) {
  const [showPlayers, setShowPlayers] = useState(false);
  const [showHeroDraft, setShowHeroDraft] = useState(false);
  const [pickBanView, setPickBanView] = useState("pick"); // "pick" | "ban"
  const wrColor = data.wr==null ? C.textMuted : data.wr>=50 ? C.win : C.lose;
  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,flex:1,minWidth:280}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{fontWeight:800,fontSize:14}}>{title}</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,color:C.textMuted}}>{dateRangeLabel}</div>
          <DatePickerButton label="เลือกช่วง" mode={mode} value={pickerValue} onSelect={onPickDate}/>
        </div>
      </div>

      {data.total===0 ? (
        <div style={{color:C.textMuted,fontSize:12,padding:"10px 0"}}>ยังไม่มีข้อมูลในช่วงนี้</div>
      ) : (
        <>
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:30,fontWeight:900,color:wrColor}}>{data.wr}%</span>
            <span style={{fontSize:12,color:C.textMuted}}>{data.wins}W-{data.losses}L ({data.total} เกม)</span>
            {data.wrDelta!=null && (
              <span style={{fontSize:12,fontWeight:700,color:data.wrDelta>=0?C.win:C.lose}}>
                {data.wrDelta>=0?"▲":"▼"} {Math.abs(data.wrDelta)}% เทียบช่วงก่อนหน้า
              </span>
            )}
          </div>

          {data.avgDuration!=null && (
            <div style={{fontSize:12,color:C.textMuted,marginBottom:4}}>
              ⏱️ เวลาเฉลี่ย/เกม: <b style={{color:C.textMain}}>{minutesToDurationStr(data.avgDuration).replace(".",":")}</b>
              <DeltaTag value={data.avgDurationDelta} unit=" นาที" higherIsBetter={false} decimals={1}/>
            </div>
          )}

          {data.streak>=2 && (
            <div style={{fontSize:12,marginTop:6,marginBottom:10,fontWeight:700,
              color: data.streakType==="WIN" ? C.win : C.lose}}>
              {data.streakType==="WIN" ? "🔥" : "⚠️"} {data.streakType==="WIN"?"ชนะ":"แพ้"}ติดต่อกัน {data.streak} เกม
            </div>
          )}

          {(data.teamCombat.avgDamage!=null || data.teamCombat.avgDamageTaken!=null) && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ภาพรวมทีม (เฉลี่ย/เกม)</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>DMG ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgDamage ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgDamageDelta}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>DMG Taken ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgDamageTaken ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgDamageTakenDelta} higherIsBetter={false}/>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMuted}}>Gold ทั้งทีม</div>
                  <div style={{fontSize:14,fontWeight:800}}>{data.teamCombat.avgGold ?? "-"}</div>
                  <DeltaTag value={data.teamCombat.avgGoldDelta}/>
                </div>
              </div>
            </div>
          )}

          {data.topHeroes.length>0 && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:5}}>ฮีโร่ที่เล่นบ่อยสุด (รวมทั้งทีม)</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {data.topHeroes.map(h=>(
                  <HeroChip key={h.name} name={h.name} size={20} fontSize={11}
                    textCol={h.wr>=50?C.win:C.lose}/>
                ))}
              </div>
            </div>
          )}

          {(data.totalHeroesPicked>0 || data.totalHeroesBanned>0) && (
            <div style={{marginTop:14}}>
              <button onClick={()=>setShowHeroDraft(v=>!v)}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                  borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,width:"100%"}}>
                {showHeroDraft
                  ? "▲ ซ่อนสถิติ Pick/Ban ฮีโร่ (ทีมเรา)"
                  : `▼ ดู Pick/Ban ฮีโร่ทีมเรา (${data.totalHeroesPicked} ถูกเลือก · ${data.totalHeroesBanned} ถูกแบน)`}
              </button>
              {showHeroDraft && (
                <div style={{marginTop:10}}>
                  {/* ── Pick / Ban switcher ── */}
                  <div style={{display:"flex",gap:4,background:C.bgBase,borderRadius:8,padding:3,
                    marginBottom:10,border:`1px solid ${C.border}`}}>
                    {[{id:"pick",label:`🎯 Pick (${data.totalHeroesPicked})`},{id:"ban",label:`🚫 Ban (${data.totalHeroesBanned})`}].map(t=>(
                      <button key={t.id} onClick={()=>setPickBanView(t.id)}
                        style={{flex:1,background:pickBanView===t.id?C.primary:"transparent",
                          border:"none",color:pickBanView===t.id?"#fff":C.textMuted,
                          borderRadius:6,padding:"6px 0",cursor:"pointer",fontWeight:700,fontSize:11}}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div style={{overflowX:"auto"}}>
                    {pickBanView==="pick" ? (
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead>
                          <tr style={{color:C.textMuted,textAlign:"left"}}>
                            <th style={{padding:"4px 6px",fontWeight:700}}>ฮีโร่ (ทีมเรา)</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>Pick</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>Win Rate</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>🔵 Blue</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>🔴 Red</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.heroDraftList.map(h=>(
                            <tr key={h.name} style={{borderTop:`1px solid ${C.border}`}}>
                              <td style={{padding:"5px 6px"}}><HeroChip name={h.name} size={18} fontSize={11}/></td>
                              <td style={{padding:"5px 6px",textAlign:"center",fontWeight:700}}>{h.picks}</td>
                              <td style={{padding:"5px 6px",textAlign:"center",fontWeight:700,
                                color:h.wr>=50?C.win:C.lose}}>{h.wr}%</td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.blue}}>{h.blue}</td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.red}}>{h.red}</td>
                            </tr>
                          ))}
                          {data.heroDraftList.length===0 && (
                            <tr><td colSpan={5} style={{padding:"12px 6px",textAlign:"center",color:"#3a3a5c"}}>ยังไม่มีข้อมูลการ Pick ในช่วงนี้</td></tr>
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                        <thead>
                          <tr style={{color:C.textMuted,textAlign:"left"}}>
                            <th style={{padding:"4px 6px",fontWeight:700}}>ฮีโร่ (ทีมเรา)</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>Ban</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>🔵 Blue</th>
                            <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>🔴 Red</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.heroBanList.map(h=>(
                            <tr key={h.name} style={{borderTop:`1px solid ${C.border}`}}>
                              <td style={{padding:"5px 6px"}}><HeroChip name={h.name} size={18} fontSize={11}/></td>
                              <td style={{padding:"5px 6px",textAlign:"center",fontWeight:700}}>{h.bans}</td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.blue}}>{h.blue}</td>
                              <td style={{padding:"5px 6px",textAlign:"center",color:C.red}}>{h.red}</td>
                            </tr>
                          ))}
                          {data.heroBanList.length===0 && (
                            <tr><td colSpan={4} style={{padding:"12px 6px",textAlign:"center",color:"#3a3a5c"}}>ยังไม่มีข้อมูลการ Ban ในช่วงนี้</td></tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {data.players.length>0 && (
            <div style={{marginTop:14}}>
              <button onClick={()=>setShowPlayers(v=>!v)}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.primaryLight,
                  borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700,width:"100%"}}>
                {showPlayers ? "▲ ซ่อนสถิติรายบุคคล" : `▼ ดูสถิติรายบุคคล (${data.players.length} คน)`}
              </button>
              {showPlayers && (
                <div style={{marginTop:10}}>
                  {data.players.map(p => <PlayerPeriodRow key={p.name} p={p}/>)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  RECENT ACTIVITY — ใครแก้อะไรเมื่อไหร่ (เห็นได้ทุกคนในทีม ไม่ใช่แค่
//  admin — ต่างจาก audit log เดิมที่มีแค่เรื่อง role/อนุมัติสมาชิก)
// ═══════════════════════════════════════════
export function RecentActivityWidget() {
  const [logs, setLogs] = useState(null); // null = loading
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/activity-log")
      .then(r => r.ok ? r.json() : [])
      .then(setLogs)
      .catch(() => setLogs([]));
  }, []);

  function timeAgo(iso) {
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return "เมื่อสักครู่";
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ชม.ที่แล้ว`;
    return new Date(iso).toLocaleDateString("th-TH", { day:"numeric", month:"short" });
  }

  if (logs === null || logs.length === 0) return null; // ไม่มีข้อมูล/กำลังโหลด — ไม่ต้องโชว์การ์ดเปล่าๆ

  return (
    <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:20}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{width:"100%",background:"transparent",border:"none",color:C.textMain,
          display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",padding:0}}>
        <span style={{fontWeight:800,fontSize:14}}>🕘 กิจกรรมล่าสุด</span>
        <span style={{fontSize:11,color:C.textMuted}}>{open ? "▲ ซ่อน" : `▼ ดู (${logs.length})`}</span>
      </button>
      {open && (
        <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
          {logs.map(log => (
            <div key={log.id} style={{fontSize:12,color:C.textMuted,display:"flex",gap:8,alignItems:"baseline"}}>
              <span style={{color:C.textMain,fontWeight:700,flexShrink:0}}>{log.userEmail.split("@")[0]}</span>
              <span style={{flex:1}}>{log.summary}</span>
              <span style={{flexShrink:0,fontSize:10}}>{timeAgo(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeeklyMonthlySummary({ matches }) {
  const [weekStart,  setWeekStart]  = useState(() => startOfWeekMon(new Date()));
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));

  const weekEnd  = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const monthEnd = useMemo(() => addMonths(monthStart, 1), [monthStart]);

  // memo บน `matches` + ช่วงที่เลือกเท่านั้น — RovAppInner (parent) re-render
  // บ่อยมากจาก state อื่นๆ ที่ไม่เกี่ยวกับแมตช์เลย ถ้าไม่ memo ไว้
  // summarizePeriodByRange (วน flatMap + aggregate ทุกเกม) จะรันซ้ำทุกครั้ง
  // โดยไม่จำเป็น
  const weekly  = useMemo(() => summarizePeriodByRange(matches||[], weekStart, weekEnd),   [matches, weekStart, weekEnd]);
  const monthly = useMemo(() => summarizePeriodByRange(matches||[], monthStart, monthEnd), [matches, monthStart, monthEnd]);

  const fmt = (d) => d.toLocaleDateString("th-TH",{day:"numeric",month:"short"});
  const weekLabel  = `${fmt(weekStart)} - ${fmt(addDays(weekEnd,-1))}`;
  const monthLabel = `${THAI_MONTHS_SHORT[monthStart.getMonth()]} ${monthStart.getFullYear()+543}`;

  return (
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
      <PeriodSummaryCard title="📅 รายสัปดาห์" dateRangeLabel={weekLabel} data={weekly}
        mode="week" pickerValue={weekStart} onPickDate={setWeekStart}/>
      <PeriodSummaryCard title="🗓️ รายเดือน" dateRangeLabel={monthLabel} data={monthly}
        mode="month" pickerValue={monthStart} onPickDate={setMonthStart}/>
    </div>
  );
}
