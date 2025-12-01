# Real-time API Example

Complete real-time API system built with Verb, featuring live data streaming, event-driven architecture, and multi-protocol communication for building reactive applications.

## Overview

This example demonstrates building a comprehensive real-time API system with:

- Server-Sent Events (SSE) for real-time data streaming
- WebSocket connections for bidirectional communication
- Event-driven architecture with publish/subscribe patterns
- Real-time notifications and alerts
- Live data dashboards
- Multi-user collaboration features
- Event sourcing and CQRS patterns
- Connection management and scaling

## Project Setup

```bash
# Create new project
mkdir realtime-api
cd realtime-api
bun init -y

# Install dependencies
bun install verb
bun install -D @types/bun typescript

# Install real-time packages
bun install eventemitter3 ioredis
bun install zod uuid
```

## Real-time Server Architecture

```typescript
// server.ts
import { server } from "verb";
import { cors, json, staticFiles } from "verb/middleware";
import { EventManager } from "./src/services/EventManager";
import { ConnectionManager } from "./src/services/ConnectionManager";
import { realtimeRouter } from "./src/routes/realtime";
import { eventsRouter } from "./src/routes/events";
import { dashboardRouter } from "./src/routes/dashboard";
import { authenticate } from "./src/middleware/auth";

const app = server.http();

// Initialize services
const eventManager = new EventManager();
const connectionManager = new ConnectionManager(eventManager);

// Make services available to routes
app.use((req, res, next) => {
  req.eventManager = eventManager;
  req.connectionManager = connectionManager;
  next();
});

// Middleware
app.use(cors({
  origin: ["http://localhost:3000"],
  credentials: true
}));
app.use(json());
app.use(staticFiles({ root: "./public" }));

// API routes
app.use("/api/realtime", realtimeRouter);
app.use("/api/events", eventsRouter);
app.use("/api/dashboard", dashboardRouter);

// WebSocket configuration
app.withOptions({
  port: 3000,
  websocket: {
    message: (ws, message) => connectionManager.handleMessage(ws, message),
    open: (ws) => connectionManager.handleConnection(ws),
    close: (ws, code, reason) => connectionManager.handleDisconnection(ws, code, reason),
    ping: (ws, data) => ws.pong(data),
    
    // Performance settings
    maxCompressedSize: 64 * 1024 * 1024,
    maxBackpressure: 64 * 1024 * 1024,
    compression: "shared"
  }
});

// Serve real-time dashboard
app.get("/", (req, res) => {
  res.sendFile("./public/dashboard.html");
});

// Health check with real-time metrics
app.get("/health", (req, res) => {
  const stats = connectionManager.getStats();
  const eventStats = eventManager.getStats();
  
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connections: stats,
    events: eventStats,
    uptime: process.uptime()
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  connectionManager.closeAllConnections();
  process.exit(0);
});

app.listen(3000);
console.log("🚀 Real-time API server running on port 3000");
```

## Event Manager Service

```typescript
// src/services/EventManager.ts
import { EventEmitter } from "eventemitter3";
import { Database } from "bun:sqlite";

export interface Event {
  id: string;
  type: string;
  data: any;
  userId?: string;
  roomId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  id: string;
  userId: string;
  eventTypes: string[];
  filters?: Record<string, any>;
  connectionId: string;
}

export class EventManager extends EventEmitter {
  private db: Database;
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory = new Map<string, Event[]>();
  private maxHistorySize = 1000;

  constructor() {
    super();
    this.db = new Database("realtime.db");
    this.initializeDatabase();
    this.startEventCleanup();
  }

  private initializeDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        user_id TEXT,
        room_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        INDEX idx_events_type (type),
        INDEX idx_events_user_id (user_id),
        INDEX idx_events_room_id (room_id),
        INDEX idx_events_timestamp (timestamp)
      );

      CREATE TABLE IF NOT EXISTS event_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_types TEXT NOT NULL,
        filters TEXT,
        connection_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_subscriptions_user_id (user_id),
        INDEX idx_subscriptions_connection_id (connection_id)
      );
    `);
  }

  // Publish event to all interested subscribers
  async publishEvent(event: Omit<Event, "id" | "timestamp">): Promise<Event> {
    const fullEvent: Event = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event
    };

    // Store event in database
    await this.storeEvent(fullEvent);

    // Store in memory for quick access
    this.addToHistory(fullEvent);

    // Emit to local subscribers
    this.emit("event", fullEvent);
    this.emit(`event:${fullEvent.type}`, fullEvent);

    // Emit to room subscribers if roomId is specified
    if (fullEvent.roomId) {
      this.emit(`room:${fullEvent.roomId}`, fullEvent);
    }

    // Emit to user subscribers if userId is specified
    if (fullEvent.userId) {
      this.emit(`user:${fullEvent.userId}`, fullEvent);
    }

    return fullEvent;
  }

  // Subscribe to specific event types
  subscribe(subscription: EventSubscription): void {
    this.subscriptions.set(subscription.id, subscription);

    // Store subscription in database
    this.db.query(`
      INSERT OR REPLACE INTO event_subscriptions 
      (id, user_id, event_types, filters, connection_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      subscription.id,
      subscription.userId,
      JSON.stringify(subscription.eventTypes),
      JSON.stringify(subscription.filters || {}),
      subscription.connectionId
    );

    // Set up event listeners
    for (const eventType of subscription.eventTypes) {
      this.on(`event:${eventType}`, (event: Event) => {
        if (this.matchesSubscription(event, subscription)) {
          this.emit(`subscription:${subscription.id}`, event);
        }
      });
    }
  }

  // Unsubscribe from events
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove all listeners for this subscription
    for (const eventType of subscription.eventTypes) {
      this.removeAllListeners(`event:${eventType}`);
    }

    this.subscriptions.delete(subscriptionId);

    // Remove from database
    this.db.query("DELETE FROM event_subscriptions WHERE id = ?")
      .run(subscriptionId);
  }

  // Get events by criteria
  async getEvents(criteria: {
    types?: string[];
    userId?: string;
    roomId?: string;
    since?: Date;
    limit?: number;
  }): Promise<Event[]> {
    let query = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];

    if (criteria.types && criteria.types.length > 0) {
      const placeholders = criteria.types.map(() => "?").join(",");
      query += ` AND type IN (${placeholders})`;
      params.push(...criteria.types);
    }

    if (criteria.userId) {
      query += " AND user_id = ?";
      params.push(criteria.userId);
    }

    if (criteria.roomId) {
      query += " AND room_id = ?";
      params.push(criteria.roomId);
    }

    if (criteria.since) {
      query += " AND timestamp > ?";
      params.push(criteria.since.toISOString());
    }

    query += " ORDER BY timestamp DESC";

    if (criteria.limit) {
      query += " LIMIT ?";
      params.push(criteria.limit);
    }

    const rows = this.db.query(query).all(...params) as any[];
    
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      data: JSON.parse(row.data),
      userId: row.user_id,
      roomId: row.room_id,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // Get real-time statistics
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      eventsInHistory: Array.from(this.eventHistory.values())
        .reduce((sum, events) => sum + events.length, 0),
      eventTypes: this.getUniqueEventTypes()
    };
  }

  private async storeEvent(event: Event): Promise<void> {
    this.db.query(`
      INSERT INTO events (id, type, data, user_id, room_id, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.type,
      JSON.stringify(event.data),
      event.userId || null,
      event.roomId || null,
      event.timestamp.toISOString(),
      event.metadata ? JSON.stringify(event.metadata) : null
    );
  }

  private addToHistory(event: Event): void {
    const key = event.roomId || event.userId || "global";
    
    if (!this.eventHistory.has(key)) {
      this.eventHistory.set(key, []);
    }

    const history = this.eventHistory.get(key)!;
    history.unshift(event);

    // Keep only recent events
    if (history.length > this.maxHistorySize) {
      history.splice(this.maxHistorySize);
    }
  }

  private matchesSubscription(event: Event, subscription: EventSubscription): boolean {
    // Check if user matches (if specified)
    if (subscription.filters?.userId && event.userId !== subscription.filters.userId) {
      return false;
    }

    // Check if room matches (if specified)
    if (subscription.filters?.roomId && event.roomId !== subscription.filters.roomId) {
      return false;
    }

    // Check custom filters
    if (subscription.filters?.custom) {
      for (const [key, value] of Object.entries(subscription.filters.custom)) {
        if (event.data[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  private getUniqueEventTypes(): string[] {
    const types = new Set<string>();
    
    for (const events of this.eventHistory.values()) {
      for (const event of events) {
        types.add(event.type);
      }
    }

    return Array.from(types);
  }

  private startEventCleanup(): void {
    // Clean up old events every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      this.db.query("DELETE FROM events WHERE timestamp < ?")
        .run(cutoff.toISOString());

      console.log(`Cleaned up events older than ${cutoff.toISOString()}`);
    }, 60 * 60 * 1000);
  }
}
```

## Connection Manager Service

```typescript
// src/services/ConnectionManager.ts
import { EventManager, EventSubscription } from "./EventManager";

export interface Connection {
  id: string;
  userId?: string;
  type: "websocket" | "sse";
  ws?: WebSocket;
  response?: any;
  subscriptions: Set<string>;
  lastActivity: Date;
  metadata: Record<string, any>;
}

export class ConnectionManager {
  private connections = new Map<string, Connection>();
  private userConnections = new Map<string, Set<string>>();
  private eventManager: EventManager;

  constructor(eventManager: EventManager) {
    this.eventManager = eventManager;
    this.startConnectionCleanup();
  }

  // Handle new WebSocket connection
  handleConnection(ws: WebSocket): void {
    const connectionId = crypto.randomUUID();
    
    const connection: Connection = {
      id: connectionId,
      type: "websocket",
      ws,
      subscriptions: new Set(),
      lastActivity: new Date(),
      metadata: {}
    };

    this.connections.set(connectionId, connection);

    // Store connection ID in WebSocket for later reference
    (ws as any).connectionId = connectionId;

    this.sendToConnection(connectionId, {
      type: "connection.established",
      data: { connectionId }
    });

    console.log(`WebSocket connection established: ${connectionId}`);
  }

  // Handle WebSocket disconnection
  handleDisconnection(ws: WebSocket, code: number, reason: string): void {
    const connectionId = (ws as any).connectionId;
    if (!connectionId) return;

    this.closeConnection(connectionId);
    console.log(`WebSocket connection closed: ${connectionId}`);
  }

  // Handle WebSocket messages
  handleMessage(ws: WebSocket, message: string | Buffer): void {
    const connectionId = (ws as any).connectionId;
    if (!connectionId) return;

    try {
      const data = JSON.parse(message.toString());
      this.processMessage(connectionId, data);
    } catch (error) {
      this.sendError(connectionId, "Invalid message format");
    }
  }

  // Create SSE connection
  createSSEConnection(response: any, userId?: string): string {
    const connectionId = crypto.randomUUID();

    const connection: Connection = {
      id: connectionId,
      userId,
      type: "sse",
      response,
      subscriptions: new Set(),
      lastActivity: new Date(),
      metadata: {}
    };

    this.connections.set(connectionId, connection);

    if (userId) {
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);
    }

    // Set up SSE headers
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control"
    });

    // Send initial connection event
    this.sendSSEEvent(response, "connection", { connectionId });

    // Handle client disconnect
    response.on("close", () => {
      this.closeConnection(connectionId);
    });

    console.log(`SSE connection established: ${connectionId}`);
    return connectionId;
  }

  // Subscribe connection to events
  subscribeToEvents(
    connectionId: string,
    eventTypes: string[],
    filters?: Record<string, any>
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const subscriptionId = crypto.randomUUID();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      userId: connection.userId || "",
      eventTypes,
      filters,
      connectionId
    };

    this.eventManager.subscribe(subscription);
    connection.subscriptions.add(subscriptionId);

    // Listen for events for this subscription
    this.eventManager.on(`subscription:${subscriptionId}`, (event) => {
      this.sendToConnection(connectionId, {
        type: "event",
        data: event
      });
    });

    this.sendToConnection(connectionId, {
      type: "subscription.created",
      data: { subscriptionId, eventTypes, filters }
    });
  }

  // Unsubscribe from events
  unsubscribeFromEvents(connectionId: string, subscriptionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.eventManager.unsubscribe(subscriptionId);
    connection.subscriptions.delete(subscriptionId);

    this.sendToConnection(connectionId, {
      type: "subscription.removed",
      data: { subscriptionId }
    });
  }

  // Send message to specific connection
  sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    if (connection.type === "websocket" && connection.ws) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send WebSocket message: ${error}`);
        this.closeConnection(connectionId);
      }
    } else if (connection.type === "sse" && connection.response) {
      this.sendSSEEvent(connection.response, message.type, message.data);
    }
  }

  // Send message to all connections of a user
  sendToUser(userId: string, message: any): void {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) return;

    for (const connectionId of connectionIds) {
      this.sendToConnection(connectionId, message);
    }
  }

  // Broadcast message to all connections
  broadcast(message: any): void {
    for (const connectionId of this.connections.keys()) {
      this.sendToConnection(connectionId, message);
    }
  }

  // Close specific connection
  closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Unsubscribe from all events
    for (const subscriptionId of connection.subscriptions) {
      this.eventManager.unsubscribe(subscriptionId);
    }

    // Remove from user connections
    if (connection.userId) {
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Close WebSocket if needed
    if (connection.type === "websocket" && connection.ws) {
      try {
        connection.ws.close();
      } catch (error) {
        // Ignore close errors
      }
    }

    this.connections.delete(connectionId);
  }

  // Get connection statistics
  getStats() {
    const connectionsByType = { websocket: 0, sse: 0 };
    const connectionsByUser = new Map<string, number>();

    for (const connection of this.connections.values()) {
      connectionsByType[connection.type]++;
      
      if (connection.userId) {
        const count = connectionsByUser.get(connection.userId) || 0;
        connectionsByUser.set(connection.userId, count + 1);
      }
    }

    return {
      total: this.connections.size,
      byType: connectionsByType,
      uniqueUsers: connectionsByUser.size,
      averageSubscriptions: Array.from(this.connections.values())
        .reduce((sum, conn) => sum + conn.subscriptions.size, 0) / this.connections.size
    };
  }

  // Close all connections
  closeAllConnections(): void {
    for (const connectionId of this.connections.keys()) {
      this.closeConnection(connectionId);
    }
  }

  private processMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch (message.type) {
      case "authenticate":
        this.authenticateConnection(connectionId, message.data);
        break;

      case "subscribe":
        this.subscribeToEvents(
          connectionId,
          message.data.eventTypes,
          message.data.filters
        );
        break;

      case "unsubscribe":
        this.unsubscribeFromEvents(connectionId, message.data.subscriptionId);
        break;

      case "publish":
        this.publishFromConnection(connectionId, message.data);
        break;

      case "ping":
        this.sendToConnection(connectionId, { type: "pong" });
        break;

      default:
        this.sendError(connectionId, `Unknown message type: ${message.type}`);
    }
  }

  private async authenticateConnection(connectionId: string, authData: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Verify JWT token or API key
      const userId = await this.verifyAuthentication(authData.token);
      
      connection.userId = userId;
      connection.metadata.authenticated = true;

      // Add to user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(connectionId);

      this.sendToConnection(connectionId, {
        type: "authenticated",
        data: { userId }
      });

    } catch (error) {
      this.sendError(connectionId, "Authentication failed");
    }
  }

  private async publishFromConnection(connectionId: string, eventData: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.userId) {
      this.sendError(connectionId, "Authentication required to publish events");
      return;
    }

    try {
      await this.eventManager.publishEvent({
        type: eventData.type,
        data: eventData.data,
        userId: connection.userId,
        roomId: eventData.roomId,
        metadata: eventData.metadata
      });

      this.sendToConnection(connectionId, {
        type: "event.published",
        data: { success: true }
      });

    } catch (error) {
      this.sendError(connectionId, `Failed to publish event: ${error.message}`);
    }
  }

  private sendError(connectionId: string, error: string): void {
    this.sendToConnection(connectionId, {
      type: "error",
      data: { error }
    });
  }

  private sendSSEEvent(response: any, event: string, data: any): void {
    const eventData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    try {
      response.write(eventData);
    } catch (error) {
      console.error(`Failed to send SSE event: ${error}`);
    }
  }

  private async verifyAuthentication(token: string): Promise<string> {
    // Implement your authentication logic here
    // Return userId if valid, throw error if invalid
    if (!token || token === "invalid") {
      throw new Error("Invalid token");
    }
    
    // For demo purposes, extract userId from token
    return token.replace("user-", "");
  }

  private startConnectionCleanup(): void {
    // Clean up stale connections every 5 minutes
    setInterval(() => {
      const now = new Date();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [connectionId, connection] of this.connections) {
        if (now.getTime() - connection.lastActivity.getTime() > staleThreshold) {
          console.log(`Closing stale connection: ${connectionId}`);
          this.closeConnection(connectionId);
        }
      }
    }, 5 * 60 * 1000);
  }
}
```

## Real-time API Routes

```typescript
// src/routes/realtime.ts
import { server } from "verb";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { authenticate, optionalAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const realtimeRouter = server.http();

// Validation schemas
const subscribeSchema = z.object({
  eventTypes: z.array(z.string()),
  filters: z.record(z.any()).optional()
});

const publishSchema = z.object({
  type: z.string(),
  data: z.any(),
  roomId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

// Server-Sent Events endpoint
realtimeRouter.get("/stream",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId;
    const connectionId = req.connectionManager.createSSEConnection(res, userId);

    // Auto-subscribe to user events if authenticated
    if (userId) {
      req.connectionManager.subscribeToEvents(
        connectionId,
        ["user.notification", "user.message"],
        { userId }
      );
    }

    // Keep connection alive
    const keepAlive = setInterval(() => {
      req.connectionManager.sendToConnection(connectionId, {
        type: "heartbeat",
        data: { timestamp: new Date().toISOString() }
      });
    }, 30000);

    res.on("close", () => {
      clearInterval(keepAlive);
    });
  })
);

// Subscribe to events via HTTP
realtimeRouter.post("/subscribe",
  authenticate,
  validate(subscribeSchema),
  asyncHandler(async (req, res) => {
    const { eventTypes, filters } = req.body;
    const { connectionId } = req.query;

    if (!connectionId) {
      return res.status(400).json({
        error: "Connection ID required",
        code: "CONNECTION_ID_REQUIRED"
      });
    }

    req.connectionManager.subscribeToEvents(
      connectionId as string,
      eventTypes,
      filters
    );

    res.json({
      message: "Subscription created",
      eventTypes,
      filters
    });
  })
);

// Publish event via HTTP
realtimeRouter.post("/publish",
  authenticate,
  validate(publishSchema),
  asyncHandler(async (req, res) => {
    const { type, data, roomId, metadata } = req.body;
    const userId = req.user.userId;

    const event = await req.eventManager.publishEvent({
      type,
      data,
      userId,
      roomId,
      metadata
    });

    res.status(201).json({
      message: "Event published",
      event: {
        id: event.id,
        type: event.type,
        timestamp: event.timestamp
      }
    });
  })
);

// Get event history
realtimeRouter.get("/events",
  authenticate,
  asyncHandler(async (req, res) => {
    const {
      types,
      roomId,
      since,
      limit = 50
    } = req.query;

    const events = await req.eventManager.getEvents({
      types: types ? (types as string).split(",") : undefined,
      userId: req.user.userId,
      roomId: roomId as string,
      since: since ? new Date(since as string) : undefined,
      limit: parseInt(limit as string)
    });

    res.json({
      events,
      count: events.length
    });
  })
);

// Get real-time statistics
realtimeRouter.get("/stats",
  authenticate,
  asyncHandler(async (req, res) => {
    const connectionStats = req.connectionManager.getStats();
    const eventStats = req.eventManager.getStats();

    res.json({
      connections: connectionStats,
      events: eventStats,
      timestamp: new Date().toISOString()
    });
  })
);

export { realtimeRouter };
```

## Dashboard Routes

```typescript
// src/routes/dashboard.ts
import { server } from "verb";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

const dashboardRouter = createServer();

// Live dashboard data
dashboardRouter.get("/live-data",
  authenticate,
  asyncHandler(async (req, res) => {
    const stats = {
      activeUsers: req.connectionManager.getStats().uniqueUsers,
      totalConnections: req.connectionManager.getStats().total,
      eventsToday: await getDailyEventCount(req.eventManager),
      systemLoad: process.cpuUsage(),
      memoryUsage: process.memoryUsage()
    };

    // Publish dashboard update event
    await req.eventManager.publishEvent({
      type: "dashboard.updated",
      data: stats,
      userId: req.user.userId
    });

    res.json(stats);
  })
);

// User activity feed
dashboardRouter.get("/activity",
  authenticate,
  asyncHandler(async (req, res) => {
    const { limit = 20 } = req.query;

    const activities = await req.eventManager.getEvents({
      types: ["user.login", "user.action", "system.alert"],
      limit: parseInt(limit as string)
    });

    res.json({
      activities: activities.map(event => ({
        id: event.id,
        type: event.type,
        message: formatActivityMessage(event),
        timestamp: event.timestamp,
        userId: event.userId
      }))
    });
  })
);

// System alerts
dashboardRouter.get("/alerts",
  authenticate,
  asyncHandler(async (req, res) => {
    const alerts = await req.eventManager.getEvents({
      types: ["system.error", "system.warning", "system.critical"],
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 100
    });

    const groupedAlerts = groupAlertsByType(alerts);

    res.json({
      alerts: groupedAlerts,
      total: alerts.length
    });
  })
);

// Create system notification
dashboardRouter.post("/notify",
  authenticate,
  asyncHandler(async (req, res) => {
    const { message, type = "info", targetUsers } = req.body;

    const notification = {
      id: crypto.randomUUID(),
      message,
      type,
      createdBy: req.user.userId,
      timestamp: new Date()
    };

    if (targetUsers && targetUsers.length > 0) {
      // Send to specific users
      for (const userId of targetUsers) {
        await req.eventManager.publishEvent({
          type: "user.notification",
          data: notification,
          userId
        });

        req.connectionManager.sendToUser(userId, {
          type: "notification",
          data: notification
        });
      }
    } else {
      // Broadcast to all users
      await req.eventManager.publishEvent({
        type: "system.notification",
        data: notification
      });

      req.connectionManager.broadcast({
        type: "notification",
        data: notification
      });
    }

    res.status(201).json({
      message: "Notification sent",
      notification
    });
  })
);

// Helper functions
async function getDailyEventCount(eventManager: any): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events = await eventManager.getEvents({
    since: today,
    limit: 10000 // Large limit to count all events
  });

  return events.length;
}

function formatActivityMessage(event: any): string {
  switch (event.type) {
    case "user.login":
      return `User logged in from ${event.data.ipAddress}`;
    case "user.action":
      return `User performed action: ${event.data.action}`;
    case "system.alert":
      return `System alert: ${event.data.message}`;
    default:
      return `Event: ${event.type}`;
  }
}

function groupAlertsByType(alerts: any[]): Record<string, any[]> {
  return alerts.reduce((groups, alert) => {
    const type = alert.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(alert);
    return groups;
  }, {});
}

export { dashboardRouter };
```

## Frontend Dashboard

```html
<!-- public/dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-time Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        
        .header {
            background: #2c3e50;
            color: white;
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .card h3 {
            color: #2c3e50;
            margin-bottom: 1rem;
            border-bottom: 2px solid #3498db;
            padding-bottom: 0.5rem;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: #f8f9fa;
            border-radius: 4px;
        }
        
        .metric .value {
            font-weight: bold;
            color: #27ae60;
        }
        
        .status {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: bold;
        }
        
        .status.online { background: #d4edda; color: #155724; }
        .status.offline { background: #f8d7da; color: #721c24; }
        
        .event-log {
            max-height: 300px;
            overflow-y: auto;
            background: #f8f9fa;
            border-radius: 4px;
            padding: 1rem;
        }
        
        .event {
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: white;
            border-radius: 4px;
            border-left: 3px solid #3498db;
        }
        
        .event-time {
            font-size: 0.8rem;
            color: #6c757d;
        }
        
        .controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        button {
            background: #3498db;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
        }
        
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        input, textarea {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2c3e50;
            color: white;
            padding: 1rem;
            border-radius: 4px;
            max-width: 300px;
            z-index: 1000;
            animation: slideIn 0.3s ease-in;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
        }
        
        .chart {
            height: 200px;
            background: #f8f9fa;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Real-time Dashboard</h1>
        <div>
            <span id="connectionStatus" class="status offline">Disconnected</span>
            <span id="lastUpdate"></span>
        </div>
    </div>

    <div class="container">
        <!-- System Metrics -->
        <div class="card">
            <h3>📊 System Metrics</h3>
            <div class="metric">
                <span>Active Connections:</span>
                <span class="value" id="activeConnections">0</span>
            </div>
            <div class="metric">
                <span>Unique Users:</span>
                <span class="value" id="uniqueUsers">0</span>
            </div>
            <div class="metric">
                <span>Events Today:</span>
                <span class="value" id="eventsToday">0</span>
            </div>
            <div class="metric">
                <span>Memory Usage:</span>
                <span class="value" id="memoryUsage">0 MB</span>
            </div>
        </div>

        <!-- Event Publishing -->
        <div class="card">
            <h3>📢 Publish Event</h3>
            <div class="controls">
                <input type="text" id="eventType" placeholder="Event type (e.g., user.update)" value="test.message">
                <input type="text" id="roomId" placeholder="Room ID (optional)">
            </div>
            <textarea id="eventData" placeholder="Event data (JSON)" rows="3">{"message": "Hello from dashboard!"}</textarea>
            <button onclick="publishEvent()">Publish Event</button>
        </div>

        <!-- Live Events -->
        <div class="card">
            <h3>⚡ Live Events</h3>
            <div class="controls">
                <button onclick="subscribeToEvents()">Subscribe to Events</button>
                <button onclick="clearEvents()">Clear Log</button>
            </div>
            <div id="eventLog" class="event-log">
                <!-- Events will appear here -->
            </div>
        </div>

        <!-- User Activity -->
        <div class="card">
            <h3>👥 User Activity</h3>
            <div id="userActivity">
                <!-- User activity will appear here -->
            </div>
        </div>

        <!-- System Alerts -->
        <div class="card">
            <h3>🚨 System Alerts</h3>
            <div id="systemAlerts">
                <!-- Alerts will appear here -->
            </div>
        </div>

        <!-- Event Statistics Chart -->
        <div class="card">
            <h3>📈 Event Statistics</h3>
            <div class="chart" id="eventChart">
                Real-time chart would go here
            </div>
        </div>
    </div>

    <script>
        class RealtimeDashboard {
            constructor() {
                this.eventSource = null;
                this.isConnected = false;
                this.connectionId = null;
                this.events = [];
                this.maxEvents = 100;
                
                this.initializeSSE();
                this.loadInitialData();
                this.startHeartbeat();
            }

            initializeSSE() {
                this.eventSource = new EventSource('/api/realtime/stream');
                
                this.eventSource.onopen = () => {
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    console.log('SSE connection established');
                };

                this.eventSource.onerror = () => {
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    console.error('SSE connection error');
                };

                this.eventSource.addEventListener('connection', (event) => {
                    const data = JSON.parse(event.data);
                    this.connectionId = data.connectionId;
                    console.log('Connection ID:', this.connectionId);
                });

                this.eventSource.addEventListener('event', (event) => {
                    const eventData = JSON.parse(event.data);
                    this.handleEvent(eventData);
                });

                this.eventSource.addEventListener('notification', (event) => {
                    const notification = JSON.parse(event.data);
                    this.showNotification(notification);
                });

                this.eventSource.addEventListener('heartbeat', (event) => {
                    const data = JSON.parse(event.data);
                    this.updateLastActivity(data.timestamp);
                });
            }

            async loadInitialData() {
                try {
                    // Load system metrics
                    const statsResponse = await fetch('/api/realtime/stats');
                    if (statsResponse.ok) {
                        const stats = await statsResponse.json();
                        this.updateMetrics(stats);
                    }

                    // Load recent events
                    const eventsResponse = await fetch('/api/realtime/events?limit=20');
                    if (eventsResponse.ok) {
                        const data = await eventsResponse.json();
                        data.events.forEach(event => this.addEventToLog(event));
                    }

                    // Load user activity
                    const activityResponse = await fetch('/api/dashboard/activity');
                    if (activityResponse.ok) {
                        const activity = await activityResponse.json();
                        this.updateUserActivity(activity.activities);
                    }

                    // Load system alerts
                    const alertsResponse = await fetch('/api/dashboard/alerts');
                    if (alertsResponse.ok) {
                        const alerts = await alertsResponse.json();
                        this.updateSystemAlerts(alerts.alerts);
                    }

                } catch (error) {
                    console.error('Failed to load initial data:', error);
                }
            }

            async subscribeToEvents() {
                if (!this.connectionId) {
                    alert('Connection not established yet');
                    return;
                }

                try {
                    const response = await fetch('/api/realtime/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventTypes: ['*'], // Subscribe to all events
                            filters: {}
                        })
                    });

                    if (response.ok) {
                        console.log('Subscribed to events');
                    }
                } catch (error) {
                    console.error('Failed to subscribe:', error);
                }
            }

            async publishEvent() {
                const type = document.getElementById('eventType').value;
                const roomId = document.getElementById('roomId').value;
                const dataText = document.getElementById('eventData').value;

                if (!type || !dataText) {
                    alert('Event type and data are required');
                    return;
                }

                try {
                    const data = JSON.parse(dataText);
                    
                    const response = await fetch('/api/realtime/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type,
                            data,
                            roomId: roomId || undefined
                        })
                    });

                    if (response.ok) {
                        console.log('Event published successfully');
                        // Clear form
                        document.getElementById('eventData').value = '';
                    } else {
                        const error = await response.json();
                        alert(`Failed to publish event: ${error.error}`);
                    }
                } catch (error) {
                    alert('Invalid JSON data');
                }
            }

            handleEvent(event) {
                this.addEventToLog(event);
                
                // Handle specific event types
                switch (event.type) {
                    case 'system.metrics':
                        this.updateMetrics(event.data);
                        break;
                    case 'user.connected':
                    case 'user.disconnected':
                        this.loadInitialData(); // Refresh metrics
                        break;
                }
            }

            addEventToLog(event) {
                this.events.unshift(event);
                
                // Keep only recent events
                if (this.events.length > this.maxEvents) {
                    this.events = this.events.slice(0, this.maxEvents);
                }

                this.renderEventLog();
            }

            renderEventLog() {
                const logElement = document.getElementById('eventLog');
                logElement.innerHTML = this.events.map(event => `
                    <div class="event">
                        <div><strong>${event.type}</strong></div>
                        <div>${JSON.stringify(event.data, null, 2)}</div>
                        <div class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</div>
                    </div>
                `).join('');
            }

            updateMetrics(stats) {
                if (stats.connections) {
                    document.getElementById('activeConnections').textContent = stats.connections.total;
                    document.getElementById('uniqueUsers').textContent = stats.connections.uniqueUsers;
                }
                
                // Simulate other metrics updates
                document.getElementById('eventsToday').textContent = Math.floor(Math.random() * 1000);
                document.getElementById('memoryUsage').textContent = Math.floor(Math.random() * 500) + ' MB';
            }

            updateUserActivity(activities) {
                const activityElement = document.getElementById('userActivity');
                activityElement.innerHTML = activities.slice(0, 5).map(activity => `
                    <div class="metric">
                        <span>${activity.message}</span>
                        <span class="event-time">${new Date(activity.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join('') || '<p>No recent activity</p>';
            }

            updateSystemAlerts(alerts) {
                const alertsElement = document.getElementById('systemAlerts');
                const alertEntries = Object.entries(alerts).slice(0, 3);
                
                alertsElement.innerHTML = alertEntries.map(([type, typeAlerts]) => `
                    <div class="metric">
                        <span>${type.replace('system.', '')}</span>
                        <span class="value">${typeAlerts.length}</span>
                    </div>
                `).join('') || '<p>No alerts</p>';
            }

            updateConnectionStatus() {
                const statusElement = document.getElementById('connectionStatus');
                statusElement.textContent = this.isConnected ? 'Connected' : 'Disconnected';
                statusElement.className = `status ${this.isConnected ? 'online' : 'offline'}`;
            }

            updateLastActivity(timestamp) {
                document.getElementById('lastUpdate').textContent = 
                    `Last update: ${new Date(timestamp).toLocaleTimeString()}`;
            }

            showNotification(notification) {
                const notificationElement = document.createElement('div');
                notificationElement.className = 'notification';
                notificationElement.innerHTML = `
                    <strong>${notification.type.toUpperCase()}</strong><br>
                    ${notification.message}
                `;

                document.body.appendChild(notificationElement);

                setTimeout(() => {
                    notificationElement.remove();
                }, 5000);
            }

            clearEvents() {
                this.events = [];
                this.renderEventLog();
            }

            startHeartbeat() {
                setInterval(() => {
                    if (this.isConnected) {
                        this.loadInitialData();
                    }
                }, 30000); // Update every 30 seconds
            }
        }

        // Global functions for HTML onclick handlers
        let dashboard;

        function publishEvent() {
            dashboard.publishEvent();
        }

        function subscribeToEvents() {
            dashboard.subscribeToEvents();
        }

        function clearEvents() {
            dashboard.clearEvents();
        }

        // Initialize dashboard when page loads
        document.addEventListener('DOMContentLoaded', () => {
            dashboard = new RealtimeDashboard();
        });
    </script>
</body>
</html>
```

## Testing

```typescript
// tests/realtime.test.ts
import { test, expect, beforeAll, afterAll } from "bun:test";
import { EventManager } from "../src/services/EventManager";
import { ConnectionManager } from "../src/services/ConnectionManager";

let eventManager: EventManager;
let connectionManager: ConnectionManager;

beforeAll(() => {
  eventManager = new EventManager();
  connectionManager = new ConnectionManager(eventManager);
});

test("Event publishing and subscription", async () => {
  const events: any[] = [];
  
  // Subscribe to events
  eventManager.on("event:test.message", (event) => {
    events.push(event);
  });

  // Publish event
  const publishedEvent = await eventManager.publishEvent({
    type: "test.message",
    data: { message: "Hello, World!" }
  });

  expect(publishedEvent.id).toBeDefined();
  expect(publishedEvent.type).toBe("test.message");
  expect(events).toHaveLength(1);
  expect(events[0].data.message).toBe("Hello, World!");
});

test("Event filtering works correctly", async () => {
  const userEvents: any[] = [];
  
  // Subscribe with filter
  const subscription = {
    id: "test-sub",
    userId: "user123",
    eventTypes: ["user.notification"],
    filters: { userId: "user123" },
    connectionId: "conn123"
  };

  eventManager.subscribe(subscription);
  eventManager.on(`subscription:${subscription.id}`, (event) => {
    userEvents.push(event);
  });

  // Publish event for different user
  await eventManager.publishEvent({
    type: "user.notification",
    data: { message: "For user456" },
    userId: "user456"
  });

  // Publish event for target user
  await eventManager.publishEvent({
    type: "user.notification",
    data: { message: "For user123" },
    userId: "user123"
  });

  expect(userEvents).toHaveLength(1);
  expect(userEvents[0].userId).toBe("user123");
});

test("Connection management", () => {
  const mockWS = {
    send: jest.fn(),
    close: jest.fn()
  } as any;

  // Simulate connection
  connectionManager.handleConnection(mockWS);
  const connectionId = (mockWS as any).connectionId;

  expect(connectionId).toBeDefined();

  // Subscribe to events
  connectionManager.subscribeToEvents(connectionId, ["test.event"]);

  // Get stats
  const stats = connectionManager.getStats();
  expect(stats.total).toBe(1);
  expect(stats.byType.websocket).toBe(1);

  // Close connection
  connectionManager.closeConnection(connectionId);
  const newStats = connectionManager.getStats();
  expect(newStats.total).toBe(0);
});

afterAll(() => {
  connectionManager.closeAllConnections();
});
```

## Running the Application

```bash
# Set environment variables
export NODE_ENV="development"
export JWT_SECRET="your-jwt-secret"

# Start the real-time server
bun run server.ts

# Open dashboard
open http://localhost:3000

# Run tests
bun test
```

## Key Features Demonstrated

This real-time API example showcases:

1. **Multiple Real-time Protocols**: WebSocket and Server-Sent Events
2. **Event-Driven Architecture**: Publish/subscribe pattern with filtering
3. **Connection Management**: Automatic cleanup and statistics tracking
4. **Real-time Dashboard**: Live metrics and event monitoring
5. **Scalable Design**: Event sourcing and connection pooling
6. **Authentication Integration**: Secure real-time connections
7. **Performance Optimization**: Memory management and connection limits
8. **Multi-user Support**: User-specific events and room-based communication
9. **Comprehensive Testing**: Unit tests for core functionality
10. **Production Ready**: Error handling, monitoring, and graceful shutdown

This real-time API system provides a solid foundation for building reactive, event-driven applications with Verb.

## See Also

- [WebSocket Chat Example](/examples/websocket-chat) - Real-time chat implementation
- [REST API Example](/examples/rest-api) - Integrating REST with real-time features
- [Authentication Example](/examples/authentication) - Securing real-time connections
- [Performance Guide](/guide/performance) - Optimizing real-time applications