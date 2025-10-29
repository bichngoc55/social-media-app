import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

// Extend Socket interface to include userId
declare module "socket.io" {
  interface Socket {
    userId?: string;
  }
}

// Declare global types
declare global {
  var io: Server;
  var userSockets: Map<string, string>;
}

const prisma = new PrismaClient();

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.APP_PORT || "3000");

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const userSockets = new Map<string, string>();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  // Database connection
  try {
    await prisma.$connect();
  } catch (err) {
    console.error("Database connection error:", err);
  }

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${port}`,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`👤 User connected: ${socket.id}`);

    socket.on("join", (userId: string) => {
      if (userId) {
        userSockets.set(userId, socket.id);
        socket.userId = userId;
      }
    });

    socket.on("disconnect", () => {
      if (socket.userId) {
        userSockets.delete(socket.userId);
      }
    });
  });

  // Make io accessible globally
  global.io = io;
  global.userSockets = userSockets;

  httpServer
    .once("error", (err: Error) => {
      console.error("Server error:", err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`Server ready on http://${hostname}:${port}`);
    });
});
