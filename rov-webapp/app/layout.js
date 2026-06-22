import Providers from "./providers";

export const metadata = {
  title: "RoV Pro Team Analytics",
  description: "Draft tracking, scouting & coaching analytics for RoV esports teams",
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
