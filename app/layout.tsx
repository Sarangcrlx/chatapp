import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatPulse — Real-Time Chat",
  description:
    "A real-time chat application powered by Socket.IO. Join rooms, chat instantly, and collaborate with anyone across the internet.",
  keywords: ["chat", "real-time", "websocket", "socket.io", "messaging"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
