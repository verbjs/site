# Debugging Guide for Verb Framework

Comprehensive debugging techniques for all protocols supported by Verb framework.

## HTTP Debugging

### Request/Response Logging
```typescript
app.use((req, res, next) => {
  const start = performance.now();
  
  console.log(`→ ${req.method} ${req.url}`, {
    headers: Object.fromEntries(req.headers.entries()),
    query: req.query,
    timestamp: new Date().toISOString()
  });
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    console.log(`← ${req.method} ${req.url} ${res.statusCode} (${duration.toFixed(2)}ms)`);
  });
  
  return next();
});
```

### Request Body Debugging
```typescript
app.post('/api/debug', async (req, res) => {
  try {
    // Debug content type
    console.log('Content-Type:', req.headers.get('content-type'));
    
    // Debug raw body
    const rawBody = await req.text();
    console.log('Raw body:', rawBody);
    
    // Parse based on content type
    let parsedBody;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      parsedBody = JSON.parse(rawBody);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      parsedBody = new URLSearchParams(rawBody);
    } else {
      parsedBody = rawBody;
    }
    
    console.log('Parsed body:', parsedBody);
    return res.json({ received: parsedBody });
  } catch (error) {
    console.error('Body parsing error:', error);
    return res.status(400).json({ error: error.message });
  }
});
```

### Route Parameter Debugging
```typescript
app.get('/users/:id/posts/:postId', (req, res) => {
  console.log('Route params:', req.params);
  console.log('Query params:', req.query);
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  
  return res.json({
    params: req.params,
    query: req.query,
    url: req.url
  });
});
```

### Headers Debugging
```typescript
app.use((req, res, next) => {
  // Log all headers
  console.log('Request headers:');
  for (const [key, value] of req.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }
  
  // Debug specific headers
  console.log('Authorization:', req.headers.get('authorization'));
  console.log('User-Agent:', req.headers.get('user-agent'));
  console.log('Accept:', req.headers.get('accept'));
  
  return next();
});
```

## WebSocket Debugging

### Connection Debugging
```typescript
app.websocket('/ws/debug', {
  open: (ws) => {
    console.log('WebSocket opened:', {
      id: ws.id,
      remoteAddress: ws.remoteAddress,
      protocol: ws.protocol,
      timestamp: new Date().toISOString()
    });
    
    // Send welcome message with debug info
    ws.send(JSON.stringify({
      type: 'debug',
      message: 'Connection established',
      connectionId: ws.id,
      timestamp: new Date().toISOString()
    }));
  },
  
  message: (ws, message) => {
    console.log('WebSocket message received:', {
      connectionId: ws.id,
      message,
      type: typeof message,
      timestamp: new Date().toISOString()
    });
    
    try {
      const parsed = JSON.parse(message);
      console.log('Parsed message:', parsed);
      
      // Echo back with debug info
      ws.send(JSON.stringify({
        type: 'echo',
        original: parsed,
        receivedAt: new Date().toISOString(),
        connectionId: ws.id
      }));
    } catch (error) {
      console.error('Message parsing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid JSON',
        received: message
      }));
    }
  },
  
  close: (ws, code, reason) => {
    console.log('WebSocket closed:', {
      connectionId: ws.id,
      code,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  error: (ws, error) => {
    console.error('WebSocket error:', {
      connectionId: ws.id,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
});
```

### Message Broadcasting Debug
```typescript
const connectionManager = new Map();

app.websocket('/ws/broadcast', {
  open: (ws) => {
    const connectionId = crypto.randomUUID();
    connectionManager.set(connectionId, {
      ws,
      connectedAt: new Date(),
      messageCount: 0
    });
    
    console.log(`Connection ${connectionId} added. Total: ${connectionManager.size}`);
    ws.id = connectionId;
  },
  
  message: (ws, message) => {
    const connection = connectionManager.get(ws.id);
    if (connection) {
      connection.messageCount++;
      console.log(`Broadcasting message from ${ws.id} (msg #${connection.messageCount})`);
    }
    
    // Broadcast to all connections
    let broadcastCount = 0;
    for (const [id, conn] of connectionManager.entries()) {
      try {
        conn.ws.send(message);
        broadcastCount++;
      } catch (error) {
        console.error(`Failed to send to ${id}:`, error);
        connectionManager.delete(id);
      }
    }
    
    console.log(`Message broadcast to ${broadcastCount} connections`);
  },
  
  close: (ws) => {
    connectionManager.delete(ws.id);
    console.log(`Connection ${ws.id} removed. Total: ${connectionManager.size}`);
  }
});
```

## UDP Debugging

### UDP Server Debugging
```typescript
import { server } from 'verb';

const app = server.http();

app.udp(8080, {
  message: (buffer, rinfo) => {
    console.log('UDP message received:', {
      data: buffer.toString(),
      length: buffer.length,
      from: `${rinfo.address}:${rinfo.port}`,
      timestamp: new Date().toISOString()
    });
    
    // Echo back with debug info
    const response = JSON.stringify({
      echo: buffer.toString(),
      receivedFrom: rinfo,
      serverTime: new Date().toISOString()
    });
    
    // Send response back to sender
    app.udpSend(Buffer.from(response), rinfo.port, rinfo.address);
  },
  
  listening: () => {
    console.log('UDP server listening on port 8080');
  },
  
  error: (error) => {
    console.error('UDP server error:', error);
  }
});
```

### UDP Client Debugging
```typescript
// UDP client for testing
const udpClient = {
  send: (message: string, port: number, host: string = 'localhost') => {
    const buffer = Buffer.from(message);
    console.log('Sending UDP message:', {
      message,
      to: `${host}:${port}`,
      size: buffer.length,
      timestamp: new Date().toISOString()
    });
    
    app.udpSend(buffer, port, host);
  }
};

// Usage
udpClient.send('Hello UDP Server', 8080);
```

## TCP Debugging

### TCP Server Debugging
```typescript
app.tcp(9090, {
  connection: (socket) => {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log('TCP connection established:', {
      id: connectionId,
      localAddress: socket.localAddress,
      localPort: socket.localPort,
      timestamp: new Date().toISOString()
    });
    
    socket.on('data', (data) => {
      console.log('TCP data received:', {
        connectionId,
        data: data.toString(),
        length: data.length,
        timestamp: new Date().toISOString()
      });
      
      // Echo back with debug info
      const response = `Echo: ${data.toString()} (received at ${new Date().toISOString()})\n`;
      socket.write(response);
    });
    
    socket.on('end', () => {
      console.log('TCP connection ended:', connectionId);
    });
    
    socket.on('error', (error) => {
      console.error('TCP socket error:', {
        connectionId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  },
  
  listening: () => {
    console.log('TCP server listening on port 9090');
  },
  
  error: (error) => {
    console.error('TCP server error:', error);
  }
});
```

## Performance Debugging

### Response Time Monitoring
```typescript
const responseTimeMiddleware = (req, res, next) => {
  const start = performance.now();
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    const hrDuration = process.hrtime.bigint() - startTime;
    
    console.log('Performance metrics:', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      hrDuration: `${Number(hrDuration / 1000000n)}ms`,
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
    
    // Log slow requests
    if (duration > 1000) {
      console.warn('SLOW REQUEST DETECTED:', {
        method: req.method,
        url: req.url,
        duration: `${duration.toFixed(2)}ms`
      });
    }
  });
  
  return next();
};

app.use(responseTimeMiddleware);
```

### Memory Usage Monitoring
```typescript
const memoryMonitoringMiddleware = (req, res, next) => {
  const memBefore = process.memoryUsage();
  
  res.on('finish', () => {
    const memAfter = process.memoryUsage();
    const memDiff = {
      rss: memAfter.rss - memBefore.rss,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external
    };
    
    console.log('Memory usage:', {
      route: `${req.method} ${req.url}`,
      before: memBefore,
      after: memAfter,
      diff: memDiff,
      timestamp: new Date().toISOString()
    });
    
    // Alert on significant memory increases
    if (memDiff.heapUsed > 10 * 1024 * 1024) { // 10MB
      console.warn('HIGH MEMORY USAGE:', {
        route: `${req.method} ${req.url}`,
        heapIncrease: `${(memDiff.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });
    }
  });
  
  return next();
};

app.use(memoryMonitoringMiddleware);
```

## Error Debugging

### Comprehensive Error Logging
```typescript
app.use((error, req, res, next) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    request: {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || 'unknown'
    },
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform
  };
  
  console.error('Application Error:', errorInfo);
  
  // Log to external service in production
  if (process.env.NODE_ENV === 'production') {
    // Send to logging service
    // logError(errorInfo);
  }
  
  return res.status(500).json({
    error: 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { debug: errorInfo })
  });
});
```

## Development Tools

### Debug Route for Inspection
```typescript
app.get('/debug/info', (req, res) => {
  return res.json({
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    },
    request: {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      query: req.query,
      params: req.params
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      // Add other safe env vars
    }
  });
});
```

### Health Check with Debug Info
```typescript
app.get('/debug/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    loadAverage: process.loadavg(),
    version: process.version,
    pid: process.pid
  };
  
  // Test external dependencies
  const checks = await Promise.allSettled([
    // Add your dependency checks here
    Promise.resolve('database: ok'),
    Promise.resolve('cache: ok')
  ]);
  
  health.dependencies = checks.map((check, index) => ({
    name: ['database', 'cache'][index],
    status: check.status,
    value: check.status === 'fulfilled' ? check.value : check.reason
  }));
  
  const allHealthy = checks.every(check => check.status === 'fulfilled');
  
  return res.status(allHealthy ? 200 : 503).json(health);
});
```

## VS Code Debugging

### Launch Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Verb App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "runtime": "bun",
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "runtimeArgs": ["--inspect-wait", "--hot"]
    }
  ]
}
```

## Browser DevTools for WebSocket

### WebSocket Client Debugging in Browser
```javascript
// Browser console debugging
const ws = new WebSocket('ws://localhost:3000/ws/debug');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  ws.send(JSON.stringify({ type: 'test', message: 'Hello' }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

This comprehensive debugging guide covers all protocols and common debugging scenarios in Verb applications.