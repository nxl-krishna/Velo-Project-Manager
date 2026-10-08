const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const Redis = require("ioredis");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = process.env.PORT || 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    
    // Clients will join a room based on the projectId they are viewing
    socket.on("join-project", (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`[Socket] Client ${socket.id} joined project:${projectId}`);
    });

    socket.on("leave-project", (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  // Connect to Redis to listen for API-driven events
  if (process.env.REDIS_URL) {
    try {
      const redisSubscriber = new Redis(process.env.REDIS_URL);
      redisSubscriber.subscribe("project-events", (err) => {
        if (err) console.error("Failed to subscribe to project-events:", err);
        else console.log("[Socket] Subscribed to Redis channel: project-events");
      });

      redisSubscriber.on("message", (channel, message) => {
        if (channel === "project-events") {
          try {
            const event = JSON.parse(message);
            // event format: { projectId, type: "TASK_MOVED", data: { ... } }
            if (event.projectId) {
              io.to(`project:${event.projectId}`).emit("project-event", event);
            }
          } catch (e) {
            console.error("Failed to parse Redis message", e);
          }
        }
      });
    } catch (e) {
      console.warn("[Socket] Redis pub/sub disabled (no connection)");
    }
  }

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
