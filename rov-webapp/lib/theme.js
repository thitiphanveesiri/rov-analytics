// lib/theme.js
// ── Extracted from components/RovApp.js ──
// Color palette + shared input style, used throughout the app (hundreds of
// call sites). Zero React dependency, zero cross-references to other
// extracted modules — same low-risk profile as lib/heroes.js and
// lib/duration.js, just moved verbatim.

export const C = {
  bgBase:"#0a0a16", bgPanel:"#14112a", bgCard:"#1a1535", border:"#1e1640",
  primary:"#6C5CE7", primaryLight:"#a29bfe",
  win:"#00cec9", lose:"#fd79a8", ban:"#ff4757",
  blue:"#2196f3", red:"#f44336",
  textMain:"#e8e8f0", textMuted:"#6b6b8a",
};

export const iStyle = {
  width:"100%", background:C.bgCard, border:`1px solid ${C.border}`,
  color:C.textMain, borderRadius:8, padding:"9px 12px", fontSize:14,
  boxSizing:"border-box", outline:"none",
};
