"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function JoinPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  const canJoin = username.trim().length > 0 && roomId.trim().length > 0;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canJoin) return;
    const encoded = encodeURIComponent(username.trim());
    router.push(`/chat/${roomId.trim().toLowerCase()}?username=${encoded}`);
  }

  return (
    <div className="join-page">
      <div className="join-container glass-card">
        <span className="join-logo">💬</span>
        <h1 className="join-title">ChatPulse</h1>
        <p className="join-subtitle">
          Real-time messaging — no sign-up required
        </p>

        <form className="join-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username" className="input-label">
              Your Name
            </label>
            <input
              id="username"
              type="text"
              className="input-field"
              placeholder="Enter your display name"
              maxLength={24}
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="roomId" className="input-label">
              Room ID
            </label>
            <div className="room-id-row">
              <input
                id="roomId"
                type="text"
                className="input-field"
                placeholder="e.g. abc123"
                maxLength={20}
                autoComplete="off"
                value={roomId}
                onChange={(e) =>
                  setRoomId(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))
                }
              />
              <button
                type="button"
                className="btn-generate"
                title="Generate random room ID"
                onClick={() => setRoomId(generateRoomId())}
              >
                🎲
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={!canJoin}
            id="join-button"
          >
            Join Room →
          </button>
        </form>
      </div>
    </div>
  );
}
