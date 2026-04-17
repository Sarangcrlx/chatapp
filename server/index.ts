import express from "express";
import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { RoomState, Message, User } from "./types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/* ────────────────────────────────────────────────────────────
   In-Memory Store
   ──────────────────────────────────────────────────────────── */

const MAX_MESSAGES_PER_ROOM = 200;

const rooms: Map<string, RoomState> = new Map();

function getOrCreateRoom(roomId: string): RoomState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { users: new Map(), messages: [] });
  }
  return rooms.get(roomId)!;
}

function addMessage(roomId: string, message: Message): void {
  const room = getOrCreateRoom(roomId);
  room.messages.push(message);
  // FIFO eviction to prevent unbounded growth
  if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
    room.messages = room.messages.slice(-MAX_MESSAGES_PER_ROOM);
  }
}

function removeUserFromAllRooms(
  socketId: string
): { roomId: string; user: User } | null {
  for (const [roomId, room] of rooms.entries()) {
    const user = room.users.get(socketId);
    if (user) {
      room.users.delete(socketId);
      // Clean up empty rooms
      if (room.users.size === 0 && room.messages.length === 0) {
        rooms.delete(roomId);
      }
      return { roomId, user };
    }
  }
  return null;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/* ────────────────────────────────────────────────────────────
   Boot
   ──────────────────────────────────────────────────────────── */

app.prepare().then(() => {
  const expressApp = express();
  const httpServer = createServer(expressApp);

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  /* ── Socket.IO event handling ─────────────────────────── */

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    /* Join a room */
    socket.on(
      "join-room",
      (
        data: { roomId: string; username: string },
        callback?: (payload: {
          users: User[];
          messages: Message[];
        }) => void
      ) => {
        const { roomId, username } = data;

        // Remove from any previous room first
        const prev = removeUserFromAllRooms(socket.id);
        if (prev) {
          socket.leave(prev.roomId);
          const leaveMsg: Message = {
            id: generateId(),
            userId: "system",
            username: "System",
            content: `${prev.user.username} left the room`,
            timestamp: Date.now(),
            type: "system",
          };
          addMessage(prev.roomId, leaveMsg);
          const prevRoom = rooms.get(prev.roomId);
          io.to(prev.roomId).emit("user-left", {
            user: prev.user,
            users: prevRoom ? Array.from(prevRoom.users.values()) : [],
            message: leaveMsg,
          });
        }

        // Join new room
        socket.join(roomId);
        const room = getOrCreateRoom(roomId);
        const user: User = {
          id: socket.id,
          username,
          joinedAt: Date.now(),
        };
        room.users.set(socket.id, user);

        // System message
        const joinMsg: Message = {
          id: generateId(),
          userId: "system",
          username: "System",
          content: `${username} joined the room`,
          timestamp: Date.now(),
          type: "system",
        };
        addMessage(roomId, joinMsg);

        // Send current state back to the joining user
        const usersArray = Array.from(room.users.values());
        if (typeof callback === "function") {
          callback({ users: usersArray, messages: room.messages });
        }

        // Broadcast to others
        socket.to(roomId).emit("user-joined", {
          user,
          users: usersArray,
          message: joinMsg,
        });

        console.log(
          `[room:${roomId}] ${username} joined (${room.users.size} users)`
        );
      }
    );

    /* Send a message */
    socket.on(
      "send-message",
      (data: { roomId: string; content: string }) => {
        const { roomId, content } = data;
        const room = rooms.get(roomId);
        if (!room) return;

        const user = room.users.get(socket.id);
        if (!user) return;

        const message: Message = {
          id: generateId(),
          userId: user.id,
          username: user.username,
          content: content.trim(),
          timestamp: Date.now(),
          type: "user",
        };

        addMessage(roomId, message);
        io.to(roomId).emit("new-message", message);
      }
    );

    /* User is typing */
    socket.on("typing", (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      socket
        .to(data.roomId)
        .emit("user-typing", { userId: user.id, username: user.username });
    });

    /* Stop typing */
    socket.on("stop-typing", (data: { roomId: string }) => {
      const room = rooms.get(data.roomId);
      if (!room) return;
      const user = room.users.get(socket.id);
      if (!user) return;
      socket
        .to(data.roomId)
        .emit("user-stop-typing", { userId: user.id });
    });

    /* Disconnect */
    socket.on("disconnect", () => {
      const result = removeUserFromAllRooms(socket.id);
      if (result) {
        const leaveMsg: Message = {
          id: generateId(),
          userId: "system",
          username: "System",
          content: `${result.user.username} left the room`,
          timestamp: Date.now(),
          type: "system",
        };
        addMessage(result.roomId, leaveMsg);
        const room = rooms.get(result.roomId);
        io.to(result.roomId).emit("user-left", {
          user: result.user,
          users: room ? Array.from(room.users.values()) : [],
          message: leaveMsg,
        });
        console.log(
          `[room:${result.roomId}] ${result.user.username} disconnected`
        );
      }
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });

  /* ── Next.js request handler ─────────────────────────── */

  expressApp.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`\n  🚀  Server ready at http://localhost:${port}\n`);
  });
});
