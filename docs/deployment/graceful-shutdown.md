# Graceful Shutdown

Implement graceful shutdown handling in your Verb applications to ensure clean termination and data integrity.

## Overview

Graceful shutdown ensures that:
- In-flight requests complete before termination
- Database connections are properly closed
- WebSocket connections are cleanly closed
- Background tasks finish or are safely interrupted
- Resources are released properly

## Basic Implementation

### Signal Handling

```typescript
// src/server.ts
import { server } from 'verb';
import { logger } from './utils/logger';

const app = server.http();

// Your routes and middleware
app.get('/health', async (req, res) => {
  return res.json({ status: 'ok' });
});

// Start server
const server = app.listen();
logger.info('Server started on port 3000');

// Graceful shutdown handling
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.info('Shutdown already in progress');
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  try {
    // Stop accepting new connections
    logger.info('Stopping server...');
    server.stop();
    
    // Wait for existing connections to close
    await waitForConnections();
    
    // Close database connections
    await closeDatabase();
    
    // Cleanup other resources
    await cleanup();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error as Error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', new Error(String(reason)));
  gracefulShutdown('unhandledRejection');
});
```

## Advanced Graceful Shutdown

### Connection Tracking

```typescript
// src/utils/connectionTracker.ts
export class ConnectionTracker {
  private connections = new Set<any>();
  private isShuttingDown = false;
  
  add(connection: any) {
    if (this.isShuttingDown) {
      connection.destroy();
      return;
    }
    
    this.connections.add(connection);
    
    connection.on('close', () => {
      this.connections.delete(connection);
    });
  }
  
  async shutdown(timeoutMs = 10000): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.connections.size === 0) {
      return;
    }
    
    console.log(`Waiting for ${this.connections.size} connections to close...`);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(`Timeout reached, forcefully closing ${this.connections.size} connections`);
        this.connections.forEach(conn => conn.destroy());
        resolve();
      }, timeoutMs);
      
      const checkConnections = () => {
        if (this.connections.size === 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnections, 100);
        }
      };
      
      checkConnections();
    });
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
}

export const connectionTracker = new ConnectionTracker();
```

### Enhanced Server with Shutdown

```typescript
// src/server/gracefulServer.ts
import { server } from 'verb';
import { connectionTracker } from '../utils/connectionTracker';
import { logger } from '../utils/logger';

export class GracefulServer {
  private app = server.http();
  private server: any;
  private isShuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;
  
  constructor() {
    this.setupRoutes();
    this.setupShutdownHandlers();
  }
  
  private setupRoutes() {
    // Add shutdown status to health check
    this.app.get('/health', async (req, res) => {
      if (this.isShuttingDown) {
        return res.status(503).json({
          status: 'shutting_down',
          connections: connectionTracker.getConnectionCount(),
        });
      }
      
      return res.json({
        status: 'ok',
        uptime: process.uptime(),
        connections: connectionTracker.getConnectionCount(),
      });
    });
    
    // Middleware to reject requests during shutdown
    this.app.use(async (req, res, next) => {
      if (this.isShuttingDown) {
        res.setHeader('Connection', 'close');
        return res.status(503).json({
          error: 'Server is shutting down',
          message: 'Please retry your request',
        });
      }
      next();
    });
  }
  
  private setupShutdownHandlers() {
    const shutdown = (signal: string) => {
      if (this.shutdownPromise) {
        return this.shutdownPromise;
      }
      
      this.shutdownPromise = this.gracefulShutdown(signal);
      return this.shutdownPromise;
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', new Error(String(reason)));
      shutdown('unhandledRejection');
    });
  }
  
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    logger.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      // Step 1: Stop accepting new connections
      logger.info('Stopping server...');
      if (this.server) {
        this.server.stop();
      }
      
      // Step 2: Wait for existing connections
      logger.info('Waiting for connections to close...');
      await connectionTracker.shutdown(10000);
      
      // Step 3: Close database connections
      logger.info('Closing database connections...');
      await this.closeDatabase();
      
      // Step 4: Cleanup resources
      logger.info('Cleaning up resources...');
      await this.cleanup();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error as Error);
      process.exit(1);
    }
  }
  
  private async closeDatabase(): Promise<void> {
    // Close database connections
    try {
      // Example: await db.destroy();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database', error as Error);
    }
  }
  
  private async cleanup(): Promise<void> {
    // Cleanup any other resources
    try {
      // Close Redis connections, stop background jobs, etc.
      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup', error as Error);
    }
  }
  
  listen(port = 3000) {
    this.server = this.app.withOptions({ port }).listen();
    return this.server;
  }
  
  getApp() {
    return this.app;
  }
}
```

## WebSocket Graceful Shutdown

### WebSocket Connection Management

```typescript
// src/websocket/gracefulWebSocket.ts
import { server } from 'verb';
import { logger } from '../utils/logger';

export class GracefulWebSocketServer {
  private app = server.websocket();
  private connections = new Set<any>();
  private isShuttingDown = false;
  
  constructor() {
    this.setupWebSocket();
    this.setupShutdownHandlers();
  }
  
  private setupWebSocket() {
    this.app.websocket({
      open: (ws) => {
        if (this.isShuttingDown) {
          ws.close(1012, 'Server is shutting down');
          return;
        }
        
        this.connections.add(ws);
        logger.info('WebSocket connection opened', {
          connectionCount: this.connections.size,
        });
      },
      
      message: (ws, message) => {
        if (this.isShuttingDown) {
          ws.send(JSON.stringify({
            type: 'server_shutdown',
            message: 'Server is shutting down, please reconnect later',
          }));
          return;
        }
        
        // Handle messages normally
        this.handleMessage(ws, message);
      },
      
      close: (ws) => {
        this.connections.delete(ws);
        logger.info('WebSocket connection closed', {
          connectionCount: this.connections.size,
        });
      },
      
      error: (ws, error) => {
        this.connections.delete(ws);
        logger.error('WebSocket error', error);
      },
    });
  }
  
  private handleMessage(ws: any, message: any) {
    // Your WebSocket message handling logic
    try {
      const data = JSON.parse(message.toString());
      // Process message
    } catch (error) {
      logger.error('Error handling WebSocket message', error as Error);
    }
  }
  
  private setupShutdownHandlers() {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down WebSocket server`);
      
      try {
        // Notify all clients about shutdown
        await this.notifyClientsShutdown();
        
        // Wait a moment for clients to handle the notification
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Close all connections
        await this.closeAllConnections();
        
        logger.info('WebSocket graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during WebSocket shutdown', error as Error);
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
  
  private async notifyClientsShutdown(): Promise<void> {
    const shutdownMessage = JSON.stringify({
      type: 'server_shutdown',
      message: 'Server is shutting down for maintenance',
      reconnectAfter: 30000, // 30 seconds
    });
    
    const notifications = Array.from(this.connections).map(ws => {
      return new Promise<void>((resolve) => {
        try {
          ws.send(shutdownMessage);
          resolve();
        } catch (error) {
          logger.warn('Failed to notify client of shutdown', error as Error);
          resolve();
        }
      });
    });
    
    await Promise.all(notifications);
    logger.info(`Notified ${this.connections.size} clients of shutdown`);
  }
  
  private async closeAllConnections(): Promise<void> {
    return new Promise((resolve) => {
      if (this.connections.size === 0) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        // Force close remaining connections
        this.connections.forEach(ws => {
          try {
            ws.close(1012, 'Server shutdown');
          } catch (error) {
            logger.warn('Error force closing WebSocket', error as Error);
          }
        });
        resolve();
      }, 5000);
      
      // Close connections gracefully
      this.connections.forEach(ws => {
        try {
          ws.close(1001, 'Server going away');
        } catch (error) {
          logger.warn('Error closing WebSocket', error as Error);
        }
      });
      
      // Wait for all connections to close
      const checkConnections = () => {
        if (this.connections.size === 0) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkConnections, 100);
        }
      };
      
      checkConnections();
    });
  }
}
```

## Background Tasks Management

### Graceful Task Shutdown

```typescript
// src/utils/taskManager.ts
export class TaskManager {
  private tasks = new Set<Promise<any>>();
  private isShuttingDown = false;
  
  async addTask<T>(taskPromise: Promise<T>): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Cannot start new tasks during shutdown');
    }
    
    this.tasks.add(taskPromise);
    
    try {
      const result = await taskPromise;
      this.tasks.delete(taskPromise);
      return result;
    } catch (error) {
      this.tasks.delete(taskPromise);
      throw error;
    }
  }
  
  async shutdown(timeoutMs = 30000): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.tasks.size === 0) {
      return;
    }
    
    logger.info(`Waiting for ${this.tasks.size} background tasks to complete`);
    
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        logger.warn(`Timeout reached, ${this.tasks.size} tasks may not have completed`);
        resolve();
      }, timeoutMs);
    });
    
    const tasksPromise = Promise.allSettled(Array.from(this.tasks));
    
    await Promise.race([tasksPromise, timeoutPromise]);
  }
  
  getTaskCount(): number {
    return this.tasks.size;
  }
}

export const taskManager = new TaskManager();
```

## Docker and Kubernetes

### Docker Signal Handling

```docker
# Dockerfile
FROM oven/bun:1-slim

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y dumb-init

WORKDIR /app
COPY . .
RUN bun install --production

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "src/server.ts"]

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
```

### Kubernetes Graceful Shutdown

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: verb-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: verb-app
  template:
    metadata:
      labels:
        app: verb-app
    spec:
      containers:
      - name: app
        image: your-registry/verb-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        # Graceful shutdown configuration
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 10"]
        # Give app time to shut down gracefully
        terminationGracePeriodSeconds: 30
        # Health checks
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Testing Graceful Shutdown

### Shutdown Test Script

```typescript
// scripts/test-shutdown.ts
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testGracefulShutdown() {
  console.log('Starting server...');
  
  const server = spawn('bun', ['src/server.ts'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  server.stdout?.on('data', (data) => {
    console.log(`Server: ${data}`);
  });
  
  server.stderr?.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
  
  // Wait for server to start
  await setTimeout(2000);
  
  console.log('Making requests...');
  
  // Make some requests
  const requests = [];
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch('http://localhost:3000/health')
        .then(res => res.json())
        .then(data => console.log(`Request ${i}:`, data))
        .catch(err => console.error(`Request ${i} failed:`, err))
    );
  }
  
  // Send shutdown signal after a delay
  setTimeout(1000).then(() => {
    console.log('Sending SIGTERM...');
    server.kill('SIGTERM');
  });
  
  // Wait for all requests and server shutdown
  await Promise.allSettled(requests);
  
  return new Promise((resolve) => {
    server.on('exit', (code) => {
      console.log(`Server exited with code: ${code}`);
      resolve(code);
    });
  });
}

testGracefulShutdown().catch(console.error);
```

## Best Practices

1. **Always handle SIGTERM and SIGINT signals**
2. **Set reasonable timeouts for shutdown operations**
3. **Stop accepting new connections first**
4. **Wait for in-flight requests to complete**
5. **Close database connections properly**
6. **Use proper signal handling in containers**
7. **Test shutdown behavior in your CI/CD pipeline**
8. **Monitor shutdown duration and success rates**
9. **Implement health checks that reflect shutdown state**
10. **Document expected shutdown time for operations teams**

## Next Steps

- [Health Checks](./health-checks.md)
- [Production Configuration](./production-config.md)
- [Docker Deployment](./docker.md)