"use client";
// components/shared/Analytics.js
// ── Extracted from components/RovApp.js ──
// Draft Patterns / Win Rate by Role / Patch Timeline tabs — fetches from
// /api/analytics/* endpoints (server-side, computed from the normalized
// Match/Game/Pick tables synced from TeamData.matches). Self-contained:
// only AnalyticsPage is used outside this file, the rest (useFetchJSON,
// the 3 tabs) are internal implementation detail.

import { useState, useEffect } from "react";
import { C } from "@/lib/theme";
import { ROLE_COLOR } from "@/lib/heroes";
import { HeroChip } from "@/components/shared/HeroChip";

//  ANALYTICS — Draft Patterns / Win Rate by Role / Patch Timeline
//  (ดึงจาก endpoint /api/analytics/* ที่คำนวณฝั่ง server จากตาราง
//   Match/Game/Pick ที่ sync มาจาก TeamData.matches)
// ═══════════════════════════════════════════
function useFetchJSON(url, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("โหลดข้อมูลไม่สำเร็จ"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

function AnalyticsLoadingOrError({ loading, error }) {
  if (loading) return <div style={{textAlign:"center",padding:30,color:C.textMuted,fontSize:12}}>กำลังโหลด...</div>;
  if (error)   return <div style={{textAlign:"center",padding:30,color:C.lose,fontSize:12}}>{error}</div>;
  return null;
}

function DraftPatternsTab({ rivals }) {
  const [rival, setRival] = useState("");
  const { data, loading, error } = useFetchJSON(
    `/api/analytics/draft-patterns${rival ? `?rival=${encodeURIComponent(rival)}` : ""}`,
    [rival]
  );

  return (
    <div>
      <select value={rival} onChange={e=>setRival(e.target.value)}
        style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
          borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none",marginBottom:16}}>
        <option value="">ทุกทีมคู่แข่ง (ภาพรวม)</option>
        {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
      </select>

      <AnalyticsLoadingOrError loading={loading} error={error}/>

      {data && (
        <>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
            จาก {data.sampleSize} เกมที่มีข้อมูล{rival?` กับ ${rival}`:""}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
              <div style={{fontWeight:800,fontSize:13,color:C.ban,marginBottom:10}}>🚫 Top Bans</div>
              {data.topBans.length===0 ? (
                <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
              ) : data.topBans.map((b,i)=>(
                <div key={b.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:7,marginBottom:2}}>
                  <HeroChip name={b.hero} size={24} accentCol={C.ban} fontSize={12}/>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:10,color:C.textMuted}}>{b.banCount} ครั้ง</span>
                    <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:5,
                      background:C.ban+"20",color:C.ban}}>{b.banRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
              <div style={{fontWeight:800,fontSize:13,color:C.lose,marginBottom:10}}>🦸 Top Picks (win rate ของเราตอนเจอ)</div>
              {data.topPicks.length===0 ? (
                <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
              ) : data.topPicks.map((p,i)=>(
                <div key={p.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:7,marginBottom:2}}>
                  <HeroChip name={p.hero} size={24} accentCol={C.lose} fontSize={12}/>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:10,color:C.textMuted}}>{p.pickCount} ครั้ง ({p.pickRate}%)</span>
                    {p.ourWinRateWhenPicked!=null && (
                      <span style={{fontSize:11,fontWeight:700,padding:"1px 8px",borderRadius:5,
                        background:p.ourWinRateWhenPicked>=50?C.lose+"20":C.win+"20",
                        color:p.ourWinRateWhenPicked>=50?C.lose:C.win}}>
                        เราชนะ {p.ourWinRateWhenPicked}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
              <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:10}}>
                ⏱️ First-Pick Tendency (แบน/เลือกไว ๆ ในเกม)
              </div>
              {data.firstPickTendency.length===0 ? (
                <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
              ) : data.firstPickTendency.map((f,i)=>(
                <div key={f.hero} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"6px 8px",background:i%2===0?"transparent":C.bgCard,borderRadius:7,marginBottom:2}}>
                  <HeroChip name={f.hero} size={24} fontSize={12}/>
                  <div style={{display:"flex",gap:6,fontSize:10,color:C.textMuted}}>
                    {f.earlyBans>0  && <span>🚫×{f.earlyBans}</span>}
                    {f.earlyPicks>0 && <span>🦸×{f.earlyPicks}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WinRateByRoleTab({ rivals, roster }) {
  const [rival, setRival]   = useState("");
  const [player, setPlayer] = useState("");
  const qs = new URLSearchParams();
  if (rival)  qs.set("rival", rival);
  if (player) qs.set("player", player);
  const { data, loading, error } = useFetchJSON(
    `/api/analytics/winrate-by-role${qs.toString()?`?${qs.toString()}`:""}`,
    [rival, player]
  );

  return (
    <div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
        <select value={rival} onChange={e=>setRival(e.target.value)}
          style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
            borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none"}}>
          <option value="">ทุกทีมคู่แข่ง</option>
          {rivals.map(r=><option key={r.id} value={r.name}>{r.name}</option>)}
        </select>
        <select value={player} onChange={e=>setPlayer(e.target.value)}
          style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
            borderRadius:8,padding:"7px 12px",fontSize:13,outline:"none"}}>
          <option value="">ทุกคนในทีม</option>
          {roster.map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <AnalyticsLoadingOrError loading={loading} error={error}/>

      {data && (
        <>
          <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>จาก {data.totalGames} เกม</div>
          <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:12}}>🎭 Win Rate ตาม Role</div>
            {data.roleBreakdown.length===0 ? (
              <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
            ) : data.roleBreakdown.map(r=>(
              <div key={r.role} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                  <span style={{fontWeight:700,color:ROLE_COLOR[r.role]||C.textMain}}>{r.role}</span>
                  <span style={{color:C.textMuted}}>{r.games} เกม — <b style={{color:r.winRate>=50?C.win:C.lose}}>{r.winRate}%</b></span>
                </div>
                <div style={{height:8,background:C.bgCard,borderRadius:99,overflow:"hidden"}}>
                  <div style={{width:`${r.winRate}%`,height:"100%",
                    background:r.winRate>=50?C.win:C.lose,borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>

          <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
            <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:10}}>🦸 Win Rate ตาม Hero (แยกตาม Role)</div>
            {data.heroBreakdown.length===0 ? (
              <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูล</div>
            ) : (
              <div style={{overflowX:"auto"}} className="h-scroll">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:420}}>
                  <thead>
                    <tr style={{color:C.textMuted,fontSize:10,textAlign:"left"}}>
                      <th style={{padding:"4px 8px"}}>Role</th>
                      <th style={{padding:"4px 8px"}}>Hero</th>
                      <th style={{padding:"4px 8px",textAlign:"center"}}>เกม</th>
                      <th style={{padding:"4px 8px",textAlign:"center"}}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.heroBreakdown.map((h,i)=>(
                      <tr key={`${h.role}-${h.hero}`} style={{background:i%2===0?"transparent":C.bgCard}}>
                        <td style={{padding:"6px 8px",color:ROLE_COLOR[h.role]||C.textMuted,fontWeight:700}}>{h.role}</td>
                        <td style={{padding:"6px 8px"}}><HeroChip name={h.hero} size={22} fontSize={11}/></td>
                        <td style={{padding:"6px 8px",textAlign:"center",color:C.textMuted}}>{h.games}</td>
                        <td style={{padding:"6px 8px",textAlign:"center"}}>
                          <span style={{fontWeight:700,padding:"1px 8px",borderRadius:5,
                            background:h.winRate>=50?C.win+"20":C.lose+"20",color:h.winRate>=50?C.win:C.lose}}>
                            {h.winRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PatchTimelineTab({ isAdmin }) {
  const { data, loading, error } = useFetchJSON("/api/analytics/patch-timeline", []);
  const [versions, setVersions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/admin/patch-versions").then(r=>r.ok?r.json():[]).then(setVersions).catch(()=>{});
  }, [refreshKey]);

  async function addVersion() {
    if (!version.trim() || !effectiveFrom) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/patch-versions", {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ version: version.trim(), notes: notes.trim(), effectiveFrom }),
      });
      if (!res.ok) throw new Error();
      setVersion(""); setNotes(""); setEffectiveFrom(""); setShowForm(false);
      setRefreshKey(k=>k+1);
    } catch { alert("บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  async function deleteVersion(id) {
    if (!window.confirm("ลบ patch version นี้?")) return;
    await fetch(`/api/admin/patch-versions?id=${id}`, { method:"DELETE" }).catch(()=>{});
    setRefreshKey(k=>k+1);
  }

  return (
    <div>
      <AnalyticsLoadingOrError loading={loading} error={error}/>

      {data && (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18,marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:13,color:C.primaryLight,marginBottom:4}}>📈 Win Rate ตาม Patch</div>
          {!data.hasPatchHistory && (
            <div style={{fontSize:11,color:"#feca57",marginBottom:12}}>
              ⚠️ ยังไม่ได้ log patch version ไว้ — ทุกเกมจะถูกนับรวมเป็น "unknown" ก่อน
            </div>
          )}
          {data.timeline.length===0 ? (
            <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"12px 0"}}>ยังไม่มีข้อมูลเกม</div>
          ) : data.timeline.map(t=>(
            <div key={t.version} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{fontWeight:700}}>{t.version}</span>
                <span style={{color:C.textMuted}}>{t.games} เกม — <b style={{color:t.winRate>=50?C.win:C.lose}}>{t.winRate}%</b></span>
              </div>
              <div style={{height:8,background:C.bgCard,borderRadius:99,overflow:"hidden"}}>
                <div style={{width:`${t.winRate}%`,height:"100%",
                  background:t.winRate>=50?C.win:C.lose,borderRadius:99}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div style={{background:C.bgPanel,border:`1px solid ${C.border}`,borderRadius:14,padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontWeight:800,fontSize:13,color:C.primaryLight}}>🗂️ Log Patch Version (Admin)</div>
            <button onClick={()=>setShowForm(v=>!v)}
              style={{background:showForm?C.border:C.primary,color:"#fff",border:"none",borderRadius:8,
                padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700}}>
              {showForm?"✕ ยกเลิก":"+ เพิ่ม"}
            </button>
          </div>

          {showForm && (
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14,alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Version</div>
                <input value={version} onChange={e=>setVersion(e.target.value)} placeholder="1.52"
                  style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                    borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none",width:100}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>มีผลตั้งแต่วันที่</div>
                <input type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}
                  style={{background:C.bgCard,border:`1px solid ${C.border}`,color:C.textMain,
                    borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none"}}/>
              </div>
              <div style={{flex:1,minWidth:160}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>โน้ต (ไม่บังคับ)</div>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="สรุป patch notes..."
                  style={{width:"100%",boxSizing:"border-box",background:C.bgCard,border:`1px solid ${C.border}`,
                    color:C.textMain,borderRadius:7,padding:"6px 10px",fontSize:12,outline:"none"}}/>
              </div>
              <button onClick={addVersion} disabled={!version.trim()||!effectiveFrom||saving}
                style={{background:C.primary,color:"#fff",border:"none",borderRadius:8,
                  padding:"7px 16px",cursor:"pointer",fontSize:12,fontWeight:700,
                  opacity:(!version.trim()||!effectiveFrom||saving)?0.5:1}}>
                {saving?"กำลังบันทึก...":"✅ บันทึก"}
              </button>
            </div>
          )}

          {versions.length===0 ? (
            <div style={{color:C.textMuted,fontSize:12,textAlign:"center",padding:"8px 0"}}>ยังไม่มี patch version ที่ log ไว้</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {versions.map(v=>(
                <div key={v.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",
                  background:C.bgCard,borderRadius:7}}>
                  <span style={{fontWeight:700,fontSize:12}}>{v.version}</span>
                  <span style={{fontSize:11,color:C.textMuted}}>
                    ตั้งแต่ {new Date(v.effectiveFrom).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"})}
                  </span>
                  {v.notes && <span style={{fontSize:11,color:C.textMuted,flex:1}}>{v.notes}</span>}
                  <button onClick={()=>deleteVersion(v.id)} style={{background:"transparent",border:"none",
                    color:C.lose,cursor:"pointer",fontSize:13}}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalyticsPage({ rivals, roster, isAdmin }) {
  const [tab, setTab] = useState("draft"); // draft | role | patch
  const TABS = [
    {id:"draft", icon:"🎯", label:"Draft Patterns"},
    {id:"role",  icon:"🎭", label:"Win Rate by Role"},
    {id:"patch", icon:"📈", label:"Patch Timeline"},
  ];

  return (
    <div style={{padding:"0 24px 40px",maxWidth:1000,margin:"0 auto"}}>
      <h2 style={{margin:"0 0 6px",fontSize:24,fontWeight:800}}>📈 Analytics</h2>
      <p style={{margin:"0 0 16px",color:C.textMuted,fontSize:13}}>
        วิเคราะห์เชิงลึกจากข้อมูลแมตช์ทั้งหมด (คำนวณฝั่ง server)
      </p>
      <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{background:tab===t.id?C.primary+"30":"transparent",
              border:`1px solid ${tab===t.id?C.primary:C.border}`,
              color:tab===t.id?C.primaryLight:C.textMuted,borderRadius:99,
              padding:"7px 16px",cursor:"pointer",fontSize:13,fontWeight:700}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab==="draft" && <DraftPatternsTab rivals={rivals}/>}
      {tab==="role"  && <WinRateByRoleTab rivals={rivals} roster={roster}/>}
      {tab==="patch" && <PatchTimelineTab isAdmin={isAdmin}/>}
    </div>
  );
}

