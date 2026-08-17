"use client";
// lib/toast.js
// ── Extracted from components/RovApp.js ──
// Moved out of RovApp.js into its own module so every component that
// calls useToast() can actually import it. Previously ToastContext /
// ToastProvider / useToast were plain local functions declared inside
// RovApp.js and never exported — that worked fine for code living in
// RovApp.js itself (SchedulePage, LogoUploader, etc., which are all
// defined in the same file and can see the local functions directly),
// but any component EXTRACTED into its own file (AdminPanel.js being the
// concrete case that hit this) has no way to reach them: importing
// useToast from "@/components/shared/RovApp" doesn't work because
// RovApp.js's default export is the page component, not this helper, and
// nothing re-exports it. AdminPanel.js was calling useToast() with no
// import at all, which is a ReferenceError the moment the component
// mounts (page.crashes for every admin, every time).
//
// Fix: this file is the single source of truth for the toast system now.
// RovApp.js imports ToastProvider/useToast from here instead of defining
// them locally, and any other extracted component (AdminPanel.js, and
// anything split out of RovApp.js in the future) can import useToast the
// same way.
import { useState, useCallback, createContext, useContext } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((msg, type="info", duration=3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const colors = {
    success: { bg:"#00b894", text:"#fff" },
    error:   { bg:"#fd79a8", text:"#fff" },
    info:    { bg:"#6C5CE7", text:"#fff" },
    warning: { bg:"#fdcb6e", text:"#1a1a2e" },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,
        display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background:c.bg, color:c.text,
              padding:"10px 18px", borderRadius:10,
              fontWeight:700, fontSize:13,
              boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
              animation:"slideIn 0.2s ease",
              maxWidth:320,
            }}>
              {t.type==="success"?"✅ ":t.type==="error"?"❌ ":t.type==="warning"?"⚠️ ":"ℹ️ "}
              {t.msg}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:none;opacity:1}}`}</style>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
