"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  FormEvent,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { User, Message } from "@/lib/types";
import { deriveKeyFromRoomId, encryptMessage, decryptMessage } from "@/lib/crypto";

/* ── Helpers ─────────────────────────────────────────────── */

const AVATAR_COLORS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ── Component ───────────────────────────────────────────── */

export default function ChatRoom() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roomId = params.roomId as string;
  const username = searchParams.get("username") || "";

  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(
    new Map()
  );
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const cryptoKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    deriveKeyFromRoomId(roomId).then(key => {
      setCryptoKey(key);
      cryptoKeyRef.current = key;
    });
  }, [roomId]);

  /* ── Redirect if no username ─────────────────────────── */

  useEffect(() => {
    if (!username) {
      router.replace("/");
    }
  }, [username, router]);

  /* ── Socket connection ───────────────────────────────── */

  useEffect(() => {
    if (!username || !roomId) return;

    const socket = getSocket();
    socket.connect();

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "join-room",
        { roomId, username },
        async (payload: { users: User[]; messages: Message[] }) => {
          setUsers(payload.users);
          const decryptedMsgs = await Promise.all(
            payload.messages.map(async (m) => {
              if (m.type === "system" || !cryptoKeyRef.current) return m;
              const dec = await decryptMessage(m.content, cryptoKeyRef.current);
              return { ...m, content: dec };
            })
          );
          setMessages(decryptedMsgs);
        }
      );
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on(
      "user-joined",
      async (data: { user: User; users: User[]; message: Message }) => {
        setUsers(data.users);
        let msg = data.message;
        if (msg.type === "user" && cryptoKeyRef.current) {
          msg = { ...msg, content: await decryptMessage(msg.content, cryptoKeyRef.current) };
        }
        setMessages((prev) => [...prev, msg]);
      }
    );

    socket.on(
      "user-left",
      async (data: { user: User; users: User[]; message: Message }) => {
        setUsers(data.users);
        let msg = data.message;
        if (msg.type === "user" && cryptoKeyRef.current) {
          msg = { ...msg, content: await decryptMessage(msg.content, cryptoKeyRef.current) };
        }
        setMessages((prev) => [...prev, msg]);
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(data.user.id);
          return next;
        });
      }
    );

    socket.on("new-message", async (msg: Message) => {
      let finalMsg = msg;
      if (finalMsg.type === "user" && cryptoKeyRef.current) {
        finalMsg = { ...finalMsg, content: await decryptMessage(finalMsg.content, cryptoKeyRef.current) };
      }
      setMessages((prev) => [...prev, finalMsg]);
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(finalMsg.userId);
        return next;
      });
    });

    socket.on(
      "user-typing",
      (data: { userId: string; username: string }) => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(data.userId, data.username);
          return next;
        });
      }
    );

    socket.on("user-stop-typing", (data: { userId: string }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    });

    return () => {
      disconnectSocket();
      setConnected(false);
    };
  }, [roomId, username]);

  /* ── Auto-scroll ─────────────────────────────────────── */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Typing indicator ────────────────────────────────── */

  const handleTyping = useCallback(() => {
    const socket = getSocket();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("typing", { roomId });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stop-typing", { roomId });
    }, 2000);
  }, [roomId]);

  /* ── Send message ────────────────────────────────────── */

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !connected || !cryptoKey) return;

    const socket = getSocket();
    const encryptedContent = await encryptMessage(content, cryptoKey);
    socket.emit("send-message", { roomId, content: encryptedContent });

    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("stop-typing", { roomId });
    }

    setInput("");
  }

  /* ── Copy room ID ────────────────────────────────────── */

  function handleCopy() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    });
  }

  /* ── Render helpers ──────────────────────────────────── */

  const socketId = typeof window !== "undefined" ? getSocket().id : "";

  const typingText = (() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return `${names[0]} and ${names.length - 1} others are typing`;
  })();

  if (!username) return null;

  return (
    <div className="chat-page">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-room-label">Room</div>
          <div className="sidebar-room-id">
            <code>{roomId}</code>
            <button
              className="btn-copy"
              onClick={handleCopy}
              id="copy-room-id"
            >
              {copyLabel}
            </button>
          </div>
        </div>

        <div className="sidebar-users-label">
          Online — {users.length}
        </div>

        <div className="user-list">
          {users.map((u) => (
            <div key={u.id} className="user-item">
              <div
                className="user-avatar"
                style={{ background: getAvatarColor(u.username) }}
              >
                {getInitials(u.username)}
              </div>
              <span className="user-name">
                {u.username}
                {u.id === socketId && (
                  <span className="user-you">(you)</span>
                )}
              </span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            className="btn-secondary"
            style={{ width: "100%" }}
            onClick={() => router.push("/")}
            id="leave-room"
          >
            ← Leave Room
          </button>
        </div>
      </aside>

      {/* ── Main Chat ────────────────────────────────────── */}
      <main className="chat-main">
        <header className="chat-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
              id="sidebar-toggle"
            >
              ☰
            </button>
            <div>
              <div className="chat-header-title">#{roomId} {cryptoKey && <span style={{ color: "var(--accent-cyan)", fontSize: "0.8rem", marginLeft: "8px" }}>🔒 E2EE</span>}</div>
              <div className="chat-header-users">
                <span className="online-dot" />
                {users.length} online
              </div>
            </div>
          </div>
          {!connected && (
            <span
              style={{
                fontSize: "0.8rem",
                color: "hsl(0, 80%, 60%)",
                fontWeight: 500,
              }}
            >
              Reconnecting…
            </span>
          )}
        </header>

        {/* Messages */}
        <div className="messages-container" id="messages-container">
          {messages.length === 0 ? (
            <div className="empty-messages">
              <div className="empty-messages-icon">💭</div>
              <div className="empty-messages-text">
                No messages yet. Say something!
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              if (msg.type === "system") {
                return (
                  <div key={msg.id} className="system-message">
                    <span className="system-message-text">{msg.content}</span>
                  </div>
                );
              }

              const isOwn = msg.userId === socketId;
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const isConsecutive =
                prevMsg &&
                prevMsg.type === "user" &&
                prevMsg.userId === msg.userId &&
                msg.timestamp - prevMsg.timestamp < 60000;

              return (
                <div
                  key={msg.id}
                  className={`message-row ${isOwn ? "is-own" : ""} ${
                    isConsecutive ? "is-consecutive" : ""
                  }`}
                >
                  <div
                    className="message-avatar"
                    style={{
                      background: getAvatarColor(msg.username),
                    }}
                  >
                    {getInitials(msg.username)}
                  </div>
                  <div className="message-body">
                    <div className="message-meta">
                      <span className="message-author">{msg.username}</span>
                      <span className="message-time">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="message-bubble">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator */}
        <div className="typing-indicator">
          {typingText && (
            <>
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
              {typingText}
            </>
          )}
        </div>

        {/* Input bar */}
        <form className="message-input-bar" onSubmit={handleSend}>
          <input
            type="text"
            className="input-field"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
            }}
            maxLength={1000}
            autoComplete="off"
            disabled={!connected}
            id="message-input"
          />
          <button
            type="submit"
            className="btn-send"
            disabled={!input.trim() || !connected}
            id="send-button"
            aria-label="Send message"
          >
            ➤
          </button>
        </form>
      </main>
    </div>
  );
}
