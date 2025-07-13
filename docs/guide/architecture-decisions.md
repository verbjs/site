# Architecture Decision Guide

Strategic guidance on when to use which protocol and architectural patterns in Verb applications.

## Protocol Selection Matrix

### HTTP - RESTful APIs and Web Services

**Use HTTP when:**
- Building RESTful APIs
- Traditional web applications
- Request-response patterns
- Stateless operations
- Integration with existing HTTP infrastructure

**Examples:**
```typescript
// CRUD operations
app.get('/api/users', getUsersHandler);
app.post('/api/users', createUserHandler);
app.put('/api/users/:id', updateUserHandler);
app.delete('/api/users/:id', deleteUserHandler);

// File serving
app.static('/assets', './public/assets');

// API endpoints
app.get('/api/health', healthCheckHandler);
```

**Performance Characteristics:**
- Throughput: High (47,000+ req/sec)
- Latency: Low (0.48ms average)
- Overhead: Minimal
- Caching: Excellent browser/proxy support

### WebSocket - Real-time Bidirectional Communication

**Use WebSocket when:**
- Real-time updates required
- Bidirectional communication needed
- Low-latency messaging
- Live data streaming
- Collaborative applications

**Examples:**
```typescript
// Chat applications
app.websocket('/ws/chat', {
  open: (ws) => ws.subscribe('chat'),
  message: (ws, data) => ws.publish('chat', data)
});

// Live dashboards
app.websocket('/ws/dashboard', {
  open: (ws) => {
    ws.subscribe('metrics');
    sendCurrentMetrics(ws);
  }
});

// Gaming
app.websocket('/ws/game', {
  message: (ws, data) => {
    const gameUpdate = processGameAction(data);
    ws.publish('game-room', gameUpdate);
  }
});

// Financial data
app.websocket('/ws/prices', {
  open: (ws) => {
    ws.subscribe('price-updates');
    streamPriceData(ws);
  }
});
```

**Performance Characteristics:**
- Throughput: Very High (persistent connections)
- Latency: Ultra-low (no handshake overhead)
- Memory: Moderate (per-connection state)
- Scalability: High with proper connection management

### UDP - High-performance, Low-latency Communication

**Use UDP when:**
- Maximum performance required
- Packet loss acceptable
- Real-time gaming
- IoT sensor data
- Video/audio streaming
- Network monitoring

**Examples:**
```typescript
// Game server
app.udp(7777, {
  message: (buffer, rinfo) => {
    const gamePacket = parseGamePacket(buffer);
    
    // Broadcast to nearby players
    broadcastToNearbyPlayers(gamePacket, rinfo);
  }
});

// IoT data collection
app.udp(8888, {
  message: (buffer, rinfo) => {
    const sensorData = parseSensorData(buffer);
    
    // Store in time-series database
    storeMetrics(sensorData, rinfo.address);
  }
});

// Network monitoring
app.udp(9999, {
  message: (buffer, rinfo) => {
    const logEntry = parseLogEntry(buffer);
    processNetworkLog(logEntry);
  }
});
```

**Performance Characteristics:**
- Throughput: Maximum
- Latency: Minimal
- Reliability: No guarantees
- Overhead: Lowest

### TCP - Reliable Connection-oriented Communication

**Use TCP when:**
- Reliability is critical
- Ordered delivery required
- Binary protocols
- Custom protocols
- Database connections
- File transfers

**Examples:**
```typescript
// Custom protocol server
app.tcp(8080, {
  connection: (socket) => {
    socket.on('data', (buffer) => {
      const message = parseCustomProtocol(buffer);
      
      switch (message.type) {
        case 'AUTH':
          handleAuthentication(socket, message);
          break;
        case 'DATA':
          processData(socket, message);
          break;
      }
    });
  }
});

// Message broker
app.tcp(5672, {
  connection: (socket) => {
    const client = new MessageClient(socket);
    
    socket.on('data', (data) => {
      const command = parseMessageCommand(data);
      client.handleCommand(command);
    });
  }
});

// Database proxy
app.tcp(5432, {
  connection: (clientSocket) => {
    const dbSocket = connectToDatabase();
    
    // Bidirectional proxy
    clientSocket.pipe(dbSocket);
    dbSocket.pipe(clientSocket);
  }
});
```

**Performance Characteristics:**
- Throughput: High
- Latency: Low
- Reliability: Guaranteed delivery
- Overhead: Moderate

## Application Architecture Patterns

### Microservices Architecture

**Multi-Protocol Microservices:**
```typescript
// User Service (HTTP)
const userService = new Verb();
userService.get('/users/:id', getUserHandler);
userService.post('/users', createUserHandler);
userService.listen(3001);

// Notification Service (WebSocket + HTTP)
const notificationService = new Verb();

// HTTP endpoint for sending notifications
notificationService.post('/notifications', sendNotificationHandler);

// WebSocket for real-time delivery
notificationService.websocket('/ws/notifications', {
  open: (ws) => ws.subscribe('notifications'),
  message: (ws, data) => handleNotificationMessage(ws, data)
});

notificationService.listen(3002);

// Metrics Service (UDP + HTTP)
const metricsService = new Verb();

// UDP for high-frequency metrics
metricsService.udp(8125, {
  message: (buffer, rinfo) => {
    const metric = parseStatsD(buffer);
    storeMetric(metric);
  }
});

// HTTP for queries
metricsService.get('/metrics', getMetricsHandler);
metricsService.listen(3003);
```

### Event-Driven Architecture

**Protocol Selection by Event Type:**
```typescript
// Command events (HTTP)
app.post('/commands/:type', async (req, res) => {
  const command = await req.json();
  
  switch (req.params.type) {
    case 'create-order':
      await eventBus.publish('order.created', command);
      break;
    case 'update-inventory':
      await eventBus.publish('inventory.updated', command);
      break;
  }
  
  return res.json({ status: 'accepted' });
});

// Real-time events (WebSocket)
app.websocket('/ws/events', {
  open: (ws) => {
    ws.subscribe('order.events');
    ws.subscribe('inventory.events');
  },
  
  message: (ws, data) => {
    const event = JSON.parse(data);
    ws.publish(`${event.type}.events`, data);
  }
});

// High-frequency events (UDP)
app.udp(9999, {
  message: (buffer, rinfo) => {
    const event = parseHighFrequencyEvent(buffer);
    processStreamingEvent(event);
  }
});
```

### API Gateway Pattern

**Protocol Routing:**
```typescript
// API Gateway with protocol routing
const gateway = new Verb();

// HTTP API routing
gateway.get('/api/v1/*', (req, res) => {
  const service = routeToService(req.url);
  return proxyToService(service, req, res);
});

// WebSocket connection routing
gateway.websocket('/ws/:service/*', {
  open: (ws) => {
    const service = ws.params.service;
    const targetWs = connectToServiceWebSocket(service);
    bridgeWebSockets(ws, targetWs);
  }
});

// Load balancing for UDP
gateway.udp(8080, {
  message: (buffer, rinfo) => {
    const targetService = selectUDPService(buffer);
    forwardUDPMessage(targetService, buffer, rinfo);
  }
});
```

## Performance Optimization Strategies

### Protocol-Specific Optimizations

**HTTP Optimization:**
```typescript
// Connection pooling
const httpService = new Verb({
  keepAlive: true,
  maxConnections: 1000,
  timeout: 30000
});

// Response caching
const cache = new Map();
httpService.get('/api/data/:id', (req, res) => {
  const { id } = req.params;
  const cached = cache.get(id);
  
  if (cached && Date.now() - cached.timestamp < 300000) {
    return res.json(cached.data);
  }
  
  const data = fetchData(id);
  cache.set(id, { data, timestamp: Date.now() });
  return res.json(data);
});
```

**WebSocket Optimization:**
```typescript
// Connection management
const connectionManager = new Map();

app.websocket('/ws/optimized', {
  open: (ws) => {
    const id = generateConnectionId();
    connectionManager.set(id, ws);
    ws.id = id;
  },
  
  message: (ws, data) => {
    // Batch messages for efficiency
    const batch = parseBatchMessage(data);
    processBatch(batch);
  },
  
  close: (ws) => {
    connectionManager.delete(ws.id);
  }
});

// Message batching
const messageBatcher = {
  batch: [],
  timer: null,
  
  add(message) {
    this.batch.push(message);
    
    if (this.batch.length >= 10 || !this.timer) {
      this.flush();
    }
  },
  
  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.batch.length > 0) {
      broadcastBatch(this.batch);
      this.batch = [];
    }
    
    this.timer = setTimeout(() => this.flush(), 100);
  }
};
```

**UDP Optimization:**
```typescript
// Buffer pooling for UDP
const bufferPool = {
  buffers: [],
  
  get(size = 1024) {
    return this.buffers.pop() || Buffer.allocUnsafe(size);
  },
  
  release(buffer) {
    buffer.fill(0);
    this.buffers.push(buffer);
  }
};

app.udp(8080, {
  message: (buffer, rinfo) => {
    // Use pooled buffers for responses
    const responseBuffer = bufferPool.get();
    
    try {
      const response = processUDPMessage(buffer);
      response.copy(responseBuffer);
      
      app.udpSend(responseBuffer, rinfo.port, rinfo.address);
    } finally {
      bufferPool.release(responseBuffer);
    }
  }
});
```

## Scaling Strategies

### Horizontal Scaling

**Load Balancing by Protocol:**
```typescript
// HTTP load balancing
const httpInstances = [
  'http://service1:3000',
  'http://service2:3000',
  'http://service3:3000'
];

let currentHttp = 0;

app.get('/api/*', (req, res) => {
  const target = httpInstances[currentHttp];
  currentHttp = (currentHttp + 1) % httpInstances.length;
  
  return proxyRequest(target, req, res);
});

// WebSocket clustering
const wsCluster = new Map();

app.websocket('/ws/clustered', {
  open: (ws) => {
    const nodeId = selectWebSocketNode();
    wsCluster.set(ws.id, nodeId);
    forwardToNode(nodeId, 'open', ws);
  },
  
  message: (ws, data) => {
    const nodeId = wsCluster.get(ws.id);
    forwardToNode(nodeId, 'message', ws, data);
  }
});

// UDP sharding
app.udp(8080, {
  message: (buffer, rinfo) => {
    const shardKey = calculateShardKey(buffer);
    const shard = selectShard(shardKey);
    forwardToShard(shard, buffer, rinfo);
  }
});
```

### Vertical Scaling

**Resource Optimization:**
```typescript
// CPU-intensive operations
const workerPool = [];

app.post('/api/process', async (req, res) => {
  const data = await req.json();
  
  // Offload to worker thread
  const worker = getAvailableWorker();
  const result = await worker.process(data);
  
  return res.json(result);
});

// Memory optimization
const objectPool = new Pool(
  () => ({ data: null, processed: false }),
  (obj) => { obj.data = null; obj.processed = false; }
);

app.post('/api/optimized', async (req, res) => {
  const obj = objectPool.acquire();
  
  try {
    obj.data = await req.json();
    obj.processed = true;
    
    const result = processObject(obj);
    return res.json(result);
  } finally {
    objectPool.release(obj);
  }
});
```

## Security Considerations by Protocol

### HTTP Security
```typescript
// Rate limiting
app.use(rateLimitMiddleware(100, 60000));

// CORS
app.use(corsMiddleware({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
}));

// Authentication
app.use('/api/protected', jwtAuthMiddleware);
```

### WebSocket Security
```typescript
app.websocket('/ws/secure', {
  open: (ws) => {
    // Validate origin
    const origin = ws.request.headers.origin;
    if (!isAllowedOrigin(origin)) {
      ws.close(1008, 'Invalid origin');
      return;
    }
    
    // Rate limiting
    if (!rateLimitCheck(ws.remoteAddress)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }
  },
  
  message: (ws, data) => {
    // Message size limiting
    if (data.length > 1024) {
      ws.close(1009, 'Message too large');
      return;
    }
    
    // Validate message format
    try {
      const parsed = JSON.parse(data);
      if (!validateMessage(parsed)) {
        ws.send(JSON.stringify({ error: 'Invalid message' }));
        return;
      }
    } catch (error) {
      ws.close(1003, 'Invalid JSON');
      return;
    }
  }
});
```

### UDP Security
```typescript
app.udp(8080, {
  message: (buffer, rinfo) => {
    // Source validation
    if (!isAllowedSource(rinfo.address)) {
      console.warn('Blocked UDP packet from:', rinfo.address);
      return;
    }
    
    // Size validation
    if (buffer.length > 512) {
      console.warn('Oversized UDP packet from:', rinfo.address);
      return;
    }
    
    // Rate limiting per source
    if (!udpRateLimit.check(rinfo.address)) {
      return;
    }
    
    processUDPMessage(buffer, rinfo);
  }
});
```

## Decision Framework

### Performance Requirements
- **Ultra-low latency**: UDP → TCP → WebSocket → HTTP
- **High throughput**: UDP → TCP → WebSocket → HTTP  
- **Reliability**: TCP → HTTP → WebSocket → UDP
- **Simplicity**: HTTP → WebSocket → TCP → UDP

### Use Case Mapping
- **RESTful APIs**: HTTP
- **Real-time dashboards**: WebSocket
- **File transfers**: TCP/HTTP
- **Gaming**: UDP/WebSocket
- **IoT sensors**: UDP
- **Chat applications**: WebSocket
- **Microservices**: HTTP + selective WebSocket/UDP

### Infrastructure Considerations
- **Existing HTTP infrastructure**: Favor HTTP
- **Firewall restrictions**: HTTP/WebSocket
- **Load balancer support**: HTTP > WebSocket > TCP > UDP
- **Monitoring tools**: HTTP > TCP > WebSocket > UDP

This architecture guide helps you make informed decisions about protocol selection and application design patterns for optimal performance and maintainability.