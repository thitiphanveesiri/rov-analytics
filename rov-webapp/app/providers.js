"use client";
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("Service worker registration failed (non-fatal):", err);
      });
    }
  }, []);
  return null;
}

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      {children}
    </SessionProvider>
  );
}
