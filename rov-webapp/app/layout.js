import Providers from "./providers";
import "./globals.css";

export const metadata = {
  title: "RoV Pro Team Analytics",
  description: "Draft tracking, scouting & coaching analytics for RoV esports teams",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RoV Analytics",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12072a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body style={{ margin: 0, background: "#0a0a16" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
