"use client";
import { C } from "@/lib/theme";
import { DRAFT_ORDER, PHASE_SEGS } from "@/components/draft/constants";



// ═══════════════════════════════════════════
export function PhaseTracker({ step }) {
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
        <div style={{height:2,borderRadius:99,width:`${(step/DRAFT_ORDER.length)*100}%`,
          background:"linear-gradient(90deg,#ff4757,#6C5CE7,#00cec9)",transition:"width .3s"}}/>
      </div>
    </div>
  );
}
