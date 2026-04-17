# 💬 ChatPulse — Real-Time Chat Application

A real-time chat application built with **Next.js 15 (App Router)** and **Socket.IO**. Messages are stored in-memory — no database required. Designed for demos, prototyping, and learning.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-white?logo=socket.io)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)

---

## ✨ Features

- **Real-time messaging** via WebSockets (Socket.IO)
- **Room-based chat** — join any room by ID
- **No sign-up** — just enter a display name
- **Online users list** — see who's in the room
- **Typing indicators** — see when others are typing
- **Message timestamps** — generated server-side
- **Copy room ID** — share the link with anyone
- **Responsive design** — works on desktop and mobile
- **Consecutive message grouping** — cleaner conversation view
- **Auto-scroll** — always see the latest message
- **Reconnection** — auto-reconnects on network issues

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              Custom Node.js Server                  │
│                                                     │
│   ┌──────────────┐     ┌──────────────────────┐     │
│   │   Express +   │     │   Socket.IO Server   │     │
│   │  Next.js SSR  │     │   (WebSocket layer)  │     │
│   └──────┬───────┘     └──────────┬───────────┘     │
│          │                        │                  │
│          │    ┌───────────────┐   │                  │
│          └────┤  In-Memory    ├───┘                  │
│               │  Store (Maps) │                      │
│               └───────────────┘                      │
└─────────────────────────────────────────────────────┘
         ▲                          ▲
         │ HTTP                     │ WebSocket
         ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Browser (React Client)                 │
│                                                     │
│   Join Page  ──→  Chat Room Page                    │
│   (username,       (messages, users,                │
│    room ID)         typing indicators)              │
└─────────────────────────────────────────────────────┘
```

**Key points:**
- A single Node.js process runs both Next.js and Socket.IO on the **same port**
- All data (rooms, users, messages) lives in JavaScript `Map` objects
- Messages are capped at **200 per room** (FIFO eviction) to prevent memory issues
- Data resets when the server restarts (expected behavior)

## 📁 Folder Structure

```
├── app/                        # Next.js frontend (App Router)
│   ├── layout.tsx              # Root layout + SEO metadata
│   ├── page.tsx                # Join/landing page
│   ├── globals.css             # Complete design system
│   └── chat/
│       └── [roomId]/
│           └── page.tsx        # Chat room page
├── lib/                        # Shared client utilities
│   ├── socket.ts               # Socket.IO client singleton
│   └── types.ts                # TypeScript types (client)
├── server/                     # Custom Node.js server
│   ├── index.ts                # Express + Next.js + Socket.IO
│   └── types.ts                # TypeScript types (server)
├── package.json
├── tsconfig.json               # Next.js TypeScript config
├── tsconfig.server.json        # Server TypeScript config
└── next.config.ts
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.18+ (recommended: 20+)
- **npm** 9+

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

### How to Use

1. Open `http://localhost:3000` in your browser
2. Enter a display name
3. Enter a room ID (or click 🎲 to generate one)
4. Click **Join Room**
5. Share the room ID with others — they can join from any device!
6. Start chatting in real-time

### Testing Locally with Multiple Users

Open multiple browser tabs at `http://localhost:3000`, each with a different username but the **same room ID**. You'll see real-time messaging across all tabs.

## 📦 Production Build

```bash
# Build for production
npm run build

# Start the production server
npm start
```

## 🌐 Deployment

> ⚠️ **Do NOT deploy to Vercel** — Vercel uses serverless functions that cannot maintain WebSocket connections.

### Deploy to Render (Free Tier)

1. Push your code to a **GitHub repository**

2. Go to [render.com](https://render.com) and create a new **Web Service**

3. Connect your GitHub repo

4. Configure the service:
   | Setting | Value |
   |---|---|
   | **Runtime** | Node |
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |

5. Render automatically sets the `PORT` environment variable — the server reads it.

6. Deploy! Your app will be live at `https://your-app.onrender.com`

> **Note:** On the free tier, Render spins down the service after 15 minutes of inactivity. The first request after a spin-down takes ~30 seconds.

### Deploy to Railway (Free Tier)

1. Push your code to a **GitHub repository**

2. Go to [railway.app](https://railway.app) and create a new project

3. Select **Deploy from GitHub repo** and connect your repo

4. Railway auto-detects Node.js. Configure if needed:
   | Setting | Value |
   |---|---|
   | **Build Command** | `npm install && npm run build` |
   | **Start Command** | `npm start` |

5. Railway assigns a public URL and sets the `PORT` env var automatically.

6. Deploy! Your app will be live at the assigned Railway URL.

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on. Auto-set by Render/Railway. |
| `NODE_ENV` | `development` | Set to `production` for production builds. |

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Vanilla CSS (glassmorphism, gradients, animations) |
| Real-time | Socket.IO 4 |
| Server | Express + custom Node.js server |
| Runtime | tsx (development), Node.js (production) |

## ⚠️ Important Notes

- **Messages are temporary** — all data is stored in-memory and lost on server restart
- **No authentication** — anyone with the room ID can join
- **Not production-ready** — this is a demo/learning project
- **200-message limit per room** — oldest messages are evicted to prevent memory growth
- **Single server instance** — does not support horizontal scaling

## 📝 License

This project is for educational and demonstration purposes.
