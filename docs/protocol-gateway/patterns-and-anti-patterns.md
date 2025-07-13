# Protocol Gateway Patterns and Anti-Patterns

A comprehensive catalog of proven patterns and common anti-patterns for implementing protocol gateways, with practical examples and guidelines for building robust, maintainable multi-protocol applications.

## Overview

Protocol gateways enable applications to communicate across different network protocols dynamically. This guide presents battle-tested patterns that promote maintainability, performance, and reliability, while highlighting anti-patterns that should be avoided.

## Core Gateway Patterns

### 1. Protocol Adapter Pattern

#### Pattern: Abstract Protocol Differences

**Intent**: Provide a uniform interface for different protocols while hiding protocol-specific implementation details.

```typescript
// ✅ Good: Protocol Adapter Pattern
interface ProtocolAdapter {
  send(data: any): Promise<void>;
  receive(): Promise<any>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

class HTTPAdapter implements ProtocolAdapter {
  constructor(private baseUrl: string) {}
  
  async send(data: any): Promise<void> {
    await fetch(`${this.baseUrl}/api/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
  
  async receive(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/data`);
    return response.json();
  }
  
  async connect(): Promise<void> {
    // HTTP is connectionless, but we can validate endpoint
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) throw new Error('HTTP endpoint unavailable');
  }
  
  async disconnect(): Promise<void> {
    // No explicit disconnect for HTTP
  }
  
  isConnected(): boolean {
    // Could implement connection pooling status check
    return true;
  }
}

class WebSocketAdapter implements ProtocolAdapter {
  private ws?: WebSocket;
  private messageQueue: any[] = [];
  
  constructor(private url: string) {}
  
  async send(data: any): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected');
    }
    this.ws!.send(JSON.stringify(data));
  }
  
  async receive(): Promise<any> {
    return new Promise((resolve) => {
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift());
      } else {
        this.ws!.addEventListener('message', (event) => {
          resolve(JSON.parse(event.data));
        }, { once: true });
      }
    });
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
      this.ws.onmessage = (event) => {
        this.messageQueue.push(JSON.parse(event.data));
      };
    });
  }
  
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }
  
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

class TCPAdapter implements ProtocolAdapter {
  private socket?: any;
  
  constructor(private host: string, private port: number) {}
  
  async send(data: any): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(data), 'utf8');
    this.socket.write(buffer);
  }
  
  async receive(): Promise<any> {
    return new Promise((resolve) => {
      this.socket.once('data', (data: Buffer) => {
        resolve(JSON.parse(data.toString('utf8')));
      });
    });
  }
  
  async connect(): Promise<void> {
    const net = await import('net');
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host);
      this.socket.on('connect', resolve);
      this.socket.on('error', reject);
    });
  }
  
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.end();
      this.socket = undefined;
    }
  }
  
  isConnected(): boolean {
    return this.socket && !this.socket.destroyed;
  }
}

// Protocol factory
class ProtocolAdapterFactory {
  static create(protocol: string, config: any): ProtocolAdapter {
    switch (protocol) {
      case 'http':
        return new HTTPAdapter(config.baseUrl);
      case 'websocket':
        return new WebSocketAdapter(config.url);
      case 'tcp':
        return new TCPAdapter(config.host, config.port);
      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }
  }
}
```

**Benefits:**
- Uniform interface across protocols
- Easy to add new protocols
- Protocol-specific logic is encapsulated
- Testable through interface mocking

### 2. Protocol Router Pattern

#### Pattern: Route Messages Based on Content and Context

```typescript
// ✅ Good: Protocol Router Pattern
interface RoutingRule {
  condition: (message: any, context: any) => boolean;
  targetProtocol: string;
  priority: number;
  description: string;
}

class ProtocolRouter {
  private rules: RoutingRule[] = [];
  private adapters = new Map<string, ProtocolAdapter>();
  private defaultProtocol = 'http';
  
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    // Sort by priority (higher priority first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }
  
  registerAdapter(protocol: string, adapter: ProtocolAdapter): void {
    this.adapters.set(protocol, adapter);
  }
  
  async route(message: any, context: MessageContext): Promise<void> {
    const targetProtocol = this.selectProtocol(message, context);
    const adapter = this.adapters.get(targetProtocol);
    
    if (!adapter) {
      throw new Error(`No adapter registered for protocol: ${targetProtocol}`);
    }
    
    if (!adapter.isConnected()) {
      await adapter.connect();
    }
    
    await adapter.send(message);
    
    // Record routing decision for monitoring
    this.recordRoutingDecision(message, context, targetProtocol);
  }
  
  private selectProtocol(message: any, context: MessageContext): string {
    for (const rule of this.rules) {
      if (rule.condition(message, context)) {
        return rule.targetProtocol;
      }
    }
    return this.defaultProtocol;
  }
  
  private recordRoutingDecision(message: any, context: MessageContext, protocol: string): void {
    // Metrics collection for routing analysis
    console.log(`Routed ${message.type} via ${protocol} (size: ${JSON.stringify(message).length} bytes)`);
  }
}

// Usage example
const router = new ProtocolRouter();

// Add routing rules
router.addRule({
  condition: (msg, ctx) => msg.type === 'realtime_update',
  targetProtocol: 'websocket',
  priority: 100,
  description: 'Route real-time updates via WebSocket'
});

router.addRule({
  condition: (msg, ctx) => msg.size > 1024 * 1024, // 1MB
  targetProtocol: 'tcp',
  priority: 90,
  description: 'Route large messages via TCP'
});

router.addRule({
  condition: (msg, ctx) => ctx.clientCapabilities.supportsHTTP2,
  targetProtocol: 'http2',
  priority: 80,
  description: 'Use HTTP/2 for capable clients'
});

router.addRule({
  condition: (msg, ctx) => ctx.networkCondition === 'poor',
  targetProtocol: 'http',
  priority: 70,
  description: 'Fall back to HTTP for poor network conditions'
});

interface MessageContext {
  clientId: string;
  clientCapabilities: {
    supportsHTTP2: boolean;
    supportsWebSocket: boolean;
  };
  networkCondition: 'excellent' | 'good' | 'poor';
  requestFrequency: number;
}
```

### 3. Protocol State Machine Pattern

#### Pattern: Manage Protocol Transitions Safely

```typescript
// ✅ Good: Protocol State Machine Pattern
enum ProtocolState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SWITCHING = 'switching',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

enum ProtocolEvent {
  CONNECT = 'connect',
  CONNECTED = 'connected',
  SWITCH = 'switch',
  SWITCHED = 'switched',
  DISCONNECT = 'disconnect',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RETRY = 'retry'
}

interface StateTransition {
  from: ProtocolState;
  event: ProtocolEvent;
  to: ProtocolState;
  guard?: (context: any) => boolean;
  action?: (context: any) => Promise<void>;
}

class ProtocolStateMachine {
  private currentState = ProtocolState.IDLE;
  private currentProtocol?: string;
  private targetProtocol?: string;
  private transitions: StateTransition[] = [];
  
  constructor() {
    this.defineTransitions();
  }
  
  private defineTransitions(): void {
    this.transitions = [
      // Connection transitions
      {
        from: ProtocolState.IDLE,
        event: ProtocolEvent.CONNECT,
        to: ProtocolState.CONNECTING,
        action: async (ctx) => await this.initiateConnection(ctx)
      },
      {
        from: ProtocolState.CONNECTING,
        event: ProtocolEvent.CONNECTED,
        to: ProtocolState.CONNECTED,
        action: async (ctx) => await this.onConnectionEstablished(ctx)
      },
      {
        from: ProtocolState.CONNECTING,
        event: ProtocolEvent.ERROR,
        to: ProtocolState.ERROR,
        action: async (ctx) => await this.handleConnectionError(ctx)
      },
      
      // Protocol switching transitions
      {
        from: ProtocolState.CONNECTED,
        event: ProtocolEvent.SWITCH,
        to: ProtocolState.SWITCHING,
        guard: (ctx) => this.canSwitchProtocol(ctx),
        action: async (ctx) => await this.initiateSwitching(ctx)
      },
      {
        from: ProtocolState.SWITCHING,
        event: ProtocolEvent.SWITCHED,
        to: ProtocolState.CONNECTED,
        action: async (ctx) => await this.completeSwitching(ctx)
      },
      {
        from: ProtocolState.SWITCHING,
        event: ProtocolEvent.ERROR,
        to: ProtocolState.ERROR,
        action: async (ctx) => await this.handleSwitchingError(ctx)
      },
      
      // Disconnection transitions
      {
        from: ProtocolState.CONNECTED,
        event: ProtocolEvent.DISCONNECT,
        to: ProtocolState.DISCONNECTING,
        action: async (ctx) => await this.initiateDisconnection(ctx)
      },
      {
        from: ProtocolState.DISCONNECTING,
        event: ProtocolEvent.DISCONNECTED,
        to: ProtocolState.IDLE,
        action: async (ctx) => await this.onDisconnected(ctx)
      },
      
      // Error recovery transitions
      {
        from: ProtocolState.ERROR,
        event: ProtocolEvent.RETRY,
        to: ProtocolState.IDLE,
        action: async (ctx) => await this.resetState(ctx)
      }
    ];
  }
  
  async transition(event: ProtocolEvent, context: any): Promise<boolean> {
    const transition = this.findTransition(this.currentState, event);
    
    if (!transition) {
      console.warn(`No transition defined for ${this.currentState} + ${event}`);
      return false;
    }
    
    if (transition.guard && !transition.guard(context)) {
      console.warn(`Transition guard failed for ${this.currentState} + ${event}`);
      return false;
    }
    
    console.log(`Transitioning from ${this.currentState} to ${transition.to} via ${event}`);
    
    try {
      if (transition.action) {
        await transition.action(context);
      }
      this.currentState = transition.to;
      return true;
    } catch (error) {
      console.error(`Transition action failed:`, error);
      await this.transition(ProtocolEvent.ERROR, { error, originalEvent: event });
      return false;
    }
  }
  
  private findTransition(from: ProtocolState, event: ProtocolEvent): StateTransition | undefined {
    return this.transitions.find(t => t.from === from && t.event === event);
  }
  
  private async initiateConnection(context: any): Promise<void> {
    this.currentProtocol = context.protocol;
    // Connection logic here
  }
  
  private async onConnectionEstablished(context: any): Promise<void> {
    console.log(`Connected to ${this.currentProtocol}`);
  }
  
  private canSwitchProtocol(context: any): boolean {
    return (
      this.currentState === ProtocolState.CONNECTED &&
      context.targetProtocol !== this.currentProtocol &&
      this.isProtocolSupported(context.targetProtocol)
    );
  }
  
  private async initiateSwitching(context: any): Promise<void> {
    this.targetProtocol = context.targetProtocol;
    console.log(`Switching from ${this.currentProtocol} to ${this.targetProtocol}`);
  }
  
  private async completeSwitching(context: any): Promise<void> {
    this.currentProtocol = this.targetProtocol;
    this.targetProtocol = undefined;
    console.log(`Successfully switched to ${this.currentProtocol}`);
  }
  
  private isProtocolSupported(protocol: string): boolean {
    const supportedProtocols = ['http', 'websocket', 'tcp', 'udp'];
    return supportedProtocols.includes(protocol);
  }
  
  getCurrentState(): ProtocolState {
    return this.currentState;
  }
  
  getCurrentProtocol(): string | undefined {
    return this.currentProtocol;
  }
}
```

### 4. Protocol Load Balancer Pattern

#### Pattern: Distribute Load Across Multiple Protocol Endpoints

```typescript
// ✅ Good: Protocol Load Balancer Pattern
interface Endpoint {
  protocol: string;
  address: string;
  port: number;
  weight: number;
  healthy: boolean;
  currentLoad: number;
  maxLoad: number;
}

interface LoadBalancingStrategy {
  selectEndpoint(endpoints: Endpoint[], request: any): Endpoint | null;
}

class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0;
  
  selectEndpoint(endpoints: Endpoint[]): Endpoint | null {
    const healthyEndpoints = endpoints.filter(e => e.healthy);
    if (healthyEndpoints.length === 0) return null;
    
    const selected = healthyEndpoints[this.currentIndex % healthyEndpoints.length];
    this.currentIndex++;
    return selected;
  }
}

class WeightedStrategy implements LoadBalancingStrategy {
  selectEndpoint(endpoints: Endpoint[]): Endpoint | null {
    const healthyEndpoints = endpoints.filter(e => e.healthy);
    if (healthyEndpoints.length === 0) return null;
    
    const totalWeight = healthyEndpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of healthyEndpoints) {
      random -= endpoint.weight;
      if (random <= 0) return endpoint;
    }
    
    return healthyEndpoints[0]; // Fallback
  }
}

class LeastConnectionsStrategy implements LoadBalancingStrategy {
  selectEndpoint(endpoints: Endpoint[]): Endpoint | null {
    const healthyEndpoints = endpoints.filter(e => e.healthy && e.currentLoad < e.maxLoad);
    if (healthyEndpoints.length === 0) return null;
    
    return healthyEndpoints.reduce((least, current) => 
      current.currentLoad < least.currentLoad ? current : least
    );
  }
}

class ProtocolLoadBalancer {
  private endpoints: Endpoint[] = [];
  private strategy: LoadBalancingStrategy;
  private healthCheckInterval: NodeJS.Timeout;
  
  constructor(strategy: LoadBalancingStrategy) {
    this.strategy = strategy;
    this.startHealthChecks();
  }
  
  addEndpoint(endpoint: Endpoint): void {
    this.endpoints.push(endpoint);
  }
  
  removeEndpoint(address: string, port: number): void {
    this.endpoints = this.endpoints.filter(
      e => !(e.address === address && e.port === port)
    );
  }
  
  async route(request: any): Promise<any> {
    const endpoint = this.strategy.selectEndpoint(this.endpoints, request);
    
    if (!endpoint) {
      throw new Error('No healthy endpoints available');
    }
    
    try {
      endpoint.currentLoad++;
      const result = await this.sendToEndpoint(endpoint, request);
      return result;
    } finally {
      endpoint.currentLoad--;
    }
  }
  
  private async sendToEndpoint(endpoint: Endpoint, request: any): Promise<any> {
    const adapter = ProtocolAdapterFactory.create(endpoint.protocol, {
      baseUrl: `${endpoint.protocol}://${endpoint.address}:${endpoint.port}`,
      host: endpoint.address,
      port: endpoint.port
    });
    
    if (!adapter.isConnected()) {
      await adapter.connect();
    }
    
    await adapter.send(request);
    return await adapter.receive();
  }
  
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds
  }
  
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = this.endpoints.map(async (endpoint) => {
      try {
        const adapter = ProtocolAdapterFactory.create(endpoint.protocol, {
          baseUrl: `${endpoint.protocol}://${endpoint.address}:${endpoint.port}`,
          host: endpoint.address,
          port: endpoint.port
        });
        
        await adapter.connect();
        await adapter.disconnect();
        endpoint.healthy = true;
      } catch (error) {
        endpoint.healthy = false;
        console.warn(`Health check failed for ${endpoint.address}:${endpoint.port}`, error);
      }
    });
    
    await Promise.all(healthCheckPromises);
  }
  
  getHealthyEndpoints(): Endpoint[] {
    return this.endpoints.filter(e => e.healthy);
  }
  
  getEndpointStats(): { total: number; healthy: number; protocols: Record<string, number> } {
    const protocolCounts = this.endpoints.reduce((acc, endpoint) => {
      acc[endpoint.protocol] = (acc[endpoint.protocol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: this.endpoints.length,
      healthy: this.endpoints.filter(e => e.healthy).length,
      protocols: protocolCounts
    };
  }
}
```

## Anti-Patterns to Avoid

### 1. Protocol Chaos Anti-Pattern

#### ❌ Anti-Pattern: Random Protocol Switching

```typescript
// DON'T: Random or arbitrary protocol switching
class ProtocolChaos {
  async handleRequest(request: any) {
    // ❌ Random protocol selection
    const protocols = ['http', 'websocket', 'tcp', 'udp'];
    const randomProtocol = protocols[Math.floor(Math.random() * protocols.length)];
    
    // ❌ No logic behind the choice
    await this.useProtocol(randomProtocol, request);
  }
  
  async optimizePerformance(request: any) {
    // ❌ Switching protocols on every request
    if (request.id % 2 === 0) {
      await this.useProtocol('websocket', request);
    } else {
      await this.useProtocol('http', request);
    }
  }
  
  async handleBasedOnTime(request: any) {
    // ❌ Time-based protocol switching without reason
    const hour = new Date().getHours();
    const protocol = hour < 12 ? 'http' : 'websocket';
    await this.useProtocol(protocol, request);
  }
}
```

#### ✅ Better: Rule-Based Protocol Selection

```typescript
// DO: Logical, rule-based protocol selection
class IntelligentProtocolSelector {
  private rules: ProtocolSelectionRule[] = [
    {
      condition: (req) => req.requiresRealTime && req.bidirectional,
      protocol: 'websocket',
      reason: 'Real-time bidirectional communication'
    },
    {
      condition: (req) => req.dataSize > 10 * 1024 * 1024,
      protocol: 'tcp',
      reason: 'Large data transfer'
    },
    {
      condition: (req) => req.frequency > 100, // per second
      protocol: 'udp',
      reason: 'High frequency, low latency required'
    },
    {
      condition: (req) => req.cacheable,
      protocol: 'http',
      reason: 'Cacheable content, HTTP caching benefits'
    }
  ];
  
  selectProtocol(request: any): { protocol: string; reason: string } {
    for (const rule of this.rules) {
      if (rule.condition(request)) {
        return { protocol: rule.protocol, reason: rule.reason };
      }
    }
    
    return { protocol: 'http', reason: 'Default choice' };
  }
}
```

### 2. Protocol Spaghetti Anti-Pattern

#### ❌ Anti-Pattern: Tight Coupling Between Protocols

```typescript
// DON'T: Tightly coupled protocol implementations
class ProtocolSpaghetti {
  async handleMessage(message: any) {
    // ❌ Protocol-specific logic scattered everywhere
    if (this.currentProtocol === 'websocket') {
      // WebSocket-specific logic mixed with business logic
      if (message.type === 'ping') {
        this.websocketConnection.pong();
      } else if (message.type === 'data') {
        // HTTP-specific headers in WebSocket handler
        this.addHttpHeaders(message);
        await this.processData(message);
      }
    } else if (this.currentProtocol === 'http') {
      // HTTP-specific logic with WebSocket assumptions
      if (message.keepAlive) {
        // Trying to use WebSocket concepts in HTTP
        this.websocketHeartbeat();
      }
      await this.processData(message);
    } else if (this.currentProtocol === 'tcp') {
      // TCP logic that assumes HTTP structure
      const httpRequest = this.parseHttpFromTcp(message);
      await this.handleHttpRequest(httpRequest);
    }
  }
  
  // ❌ Protocol knowledge leaking everywhere
  async processData(data: any) {
    if (this.currentProtocol === 'websocket') {
      // WebSocket-specific processing
    } else if (this.currentProtocol === 'http') {
      // HTTP-specific processing
    }
    // Business logic mixed with protocol concerns
  }
}
```

#### ✅ Better: Clean Separation of Concerns

```typescript
// DO: Clean separation between protocol and business logic
interface MessageProcessor {
  process(message: any): Promise<any>;
}

class BusinessLogicProcessor implements MessageProcessor {
  async process(message: any): Promise<any> {
    // Pure business logic, no protocol awareness
    switch (message.type) {
      case 'create_user':
        return await this.createUser(message.data);
      case 'get_data':
        return await this.getData(message.query);
      case 'update_status':
        return await this.updateStatus(message.id, message.status);
      default:
        throw new Error(`Unknown message type: ${message.type}`);
    }
  }
  
  private async createUser(userData: any): Promise<any> {
    // Business logic only
    return { success: true, userId: 'user_123' };
  }
}

class ProtocolHandler {
  constructor(private processor: MessageProcessor) {}
  
  async handleWebSocketMessage(ws: any, rawMessage: string): Promise<void> {
    const message = JSON.parse(rawMessage);
    const result = await this.processor.process(message);
    ws.send(JSON.stringify(result));
  }
  
  async handleHttpRequest(req: any, res: any): Promise<void> {
    const message = this.extractMessageFromHttp(req);
    const result = await this.processor.process(message);
    res.json(result);
  }
  
  async handleTcpData(socket: any, buffer: Buffer): Promise<void> {
    const message = this.parseMessageFromBuffer(buffer);
    const result = await this.processor.process(message);
    socket.write(Buffer.from(JSON.stringify(result)));
  }
}
```

### 3. Protocol Leak Anti-Pattern

#### ❌ Anti-Pattern: Protocol Details Leaking to Business Logic

```typescript
// DON'T: Let protocol details leak into business logic
class LeakyProtocolAbstraction {
  async createUser(userData: any, req: any, res: any) {
    // ❌ HTTP-specific logic in business method
    if (req.headers['content-type'] !== 'application/json') {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    // ❌ WebSocket-specific logic in business method
    if (req.websocket) {
      req.websocket.send(JSON.stringify({ type: 'user_creating' }));
    }
    
    const user = await this.userService.create(userData);
    
    // ❌ Protocol-specific response handling in business logic
    if (req.protocol === 'websocket') {
      req.websocket.send(JSON.stringify({ type: 'user_created', user }));
    } else {
      res.status(201).json(user);
    }
  }
}
```

#### ✅ Better: Protocol-Agnostic Business Logic

```typescript
// DO: Keep business logic protocol-agnostic
interface NotificationService {
  notify(channel: string, message: any): Promise<void>;
}

class ProtocolAwareNotificationService implements NotificationService {
  constructor(private protocolContext: ProtocolContext) {}
  
  async notify(channel: string, message: any): Promise<void> {
    switch (this.protocolContext.currentProtocol) {
      case 'websocket':
        this.protocolContext.websocket?.send(JSON.stringify(message));
        break;
      case 'http':
        // Store notification for next HTTP request (polling)
        await this.storeNotification(channel, message);
        break;
      case 'tcp':
        this.protocolContext.socket?.write(Buffer.from(JSON.stringify(message)));
        break;
    }
  }
}

class UserService {
  constructor(private notifications: NotificationService) {}
  
  async createUser(userData: any): Promise<User> {
    // Pure business logic
    const user = await this.repository.create(userData);
    
    // Protocol-agnostic notification
    await this.notifications.notify('user_events', {
      type: 'user_created',
      user: user
    });
    
    return user;
  }
}
```

### 4. Protocol Switching Thrashing Anti-Pattern

#### ❌ Anti-Pattern: Excessive Protocol Switching

```typescript
// DON'T: Switch protocols too frequently
class ProtocolThrashing {
  async handleRequestStream(requests: any[]) {
    for (const request of requests) {
      // ❌ Switching protocol for every request
      if (request.size > 1000) {
        await this.switchToProtocol('tcp');
      } else {
        await this.switchToProtocol('http');
      }
      
      await this.processRequest(request);
      
      // ❌ Switching back immediately
      await this.switchToProtocol('http');
    }
  }
  
  async optimizeForRequestType(request: any) {
    // ❌ Micro-optimizations that cause thrashing
    if (request.contentType === 'application/json') {
      await this.switchToProtocol('websocket'); // 1ms saved
    } else if (request.contentType === 'text/plain') {
      await this.switchToProtocol('http'); // 0.5ms saved
    }
    // Switching overhead: 5ms - net loss!
  }
}
```

#### ✅ Better: Intelligent Switching with Hysteresis

```typescript
// DO: Use hysteresis and batching to prevent thrashing
class IntelligentProtocolSwitcher {
  private switchingThreshold = 0.8; // 80% of requests must benefit
  private minBatchSize = 10;
  private requestBuffer: any[] = [];
  private lastSwitch = 0;
  private minSwitchInterval = 30000; // 30 seconds minimum between switches
  
  async handleRequest(request: any): Promise<void> {
    this.requestBuffer.push(request);
    
    if (this.requestBuffer.length >= this.minBatchSize) {
      await this.analyzeAndOptimize();
    }
  }
  
  private async analyzeAndOptimize(): Promise<void> {
    const now = Date.now();
    
    // Prevent thrashing with minimum interval
    if (now - this.lastSwitch < this.minSwitchInterval) {
      await this.processBatchWithCurrentProtocol();
      return;
    }
    
    const analysis = this.analyzeBatch(this.requestBuffer);
    
    if (analysis.shouldSwitch && analysis.benefitRatio > this.switchingThreshold) {
      await this.switchToProtocol(analysis.recommendedProtocol);
      this.lastSwitch = now;
    }
    
    await this.processBatchWithCurrentProtocol();
    this.requestBuffer = [];
  }
  
  private analyzeBatch(requests: any[]): BatchAnalysis {
    // Analyze which protocol would benefit the majority of requests
    const protocolBenefits = {
      http: 0,
      websocket: 0,
      tcp: 0
    };
    
    for (const request of requests) {
      if (this.wouldBenefitFromHTTP(request)) protocolBenefits.http++;
      if (this.wouldBenefitFromWebSocket(request)) protocolBenefits.websocket++;
      if (this.wouldBenefitFromTCP(request)) protocolBenefits.tcp++;
    }
    
    const bestProtocol = Object.keys(protocolBenefits).reduce((a, b) => 
      protocolBenefits[a] > protocolBenefits[b] ? a : b
    );
    
    const benefitRatio = protocolBenefits[bestProtocol] / requests.length;
    
    return {
      recommendedProtocol: bestProtocol,
      benefitRatio,
      shouldSwitch: bestProtocol !== this.currentProtocol && benefitRatio > this.switchingThreshold
    };
  }
}

interface BatchAnalysis {
  recommendedProtocol: string;
  benefitRatio: number;
  shouldSwitch: boolean;
}
```

## Pattern Implementation Guidelines

### 1. Protocol Selection Criteria

```typescript
// Decision matrix for protocol selection
const protocolDecisionMatrix = {
  realTimeRequired: {
    high: ['websocket', 'udp'],
    medium: ['websocket', 'tcp'],
    low: ['http', 'tcp']
  },
  
  reliabilityRequired: {
    high: ['tcp', 'websocket', 'http'],
    medium: ['tcp', 'websocket'],
    low: ['udp', 'tcp']
  },
  
  dataSize: {
    large: ['tcp', 'http'],
    medium: ['tcp', 'websocket', 'http'],
    small: ['udp', 'websocket', 'http']
  },
  
  frequency: {
    high: ['udp', 'websocket'],
    medium: ['websocket', 'tcp'],
    low: ['http', 'tcp']
  }
};

function selectOptimalProtocol(requirements: ProtocolRequirements): string {
  const candidates = new Set<string>();
  
  // Get candidates from each criterion
  for (const [criterion, value] of Object.entries(requirements)) {
    const options = protocolDecisionMatrix[criterion]?.[value];
    if (options) {
      if (candidates.size === 0) {
        options.forEach(p => candidates.add(p));
      } else {
        // Keep only intersection
        const intersection = new Set(options.filter(p => candidates.has(p)));
        candidates.clear();
        intersection.forEach(p => candidates.add(p));
      }
    }
  }
  
  // If no intersection, fall back to weighted scoring
  if (candidates.size === 0) {
    return selectByWeightedScoring(requirements);
  }
  
  // If multiple candidates, select based on priority
  return selectByPriority(Array.from(candidates), requirements);
}
```

### 2. Error Handling Patterns

```typescript
// Robust error handling for protocol operations
class ProtocolErrorHandler {
  async withRetry<T>(
    operation: () => Promise<T>,
    protocol: string,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRetryableError(error, protocol)) {
          const delay = this.calculateBackoffDelay(attempt);
          await this.sleep(delay);
          continue;
        } else {
          throw error; // Non-retryable error
        }
      }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
  }
  
  private isRetryableError(error: any, protocol: string): boolean {
    // Protocol-specific retryable error detection
    const retryableErrors = {
      http: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
      websocket: ['ECONNRESET', 'ETIMEDOUT', 'CONNECTION_LOST'],
      tcp: ['ECONNRESET', 'ETIMEDOUT', 'EPIPE'],
      udp: ['ETIMEDOUT', 'EHOSTUNREACH']
    };
    
    return retryableErrors[protocol]?.includes(error.code) || false;
  }
  
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const jitter = Math.random() * 0.1; // ±10%
    
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    return delay * (1 + jitter);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3. Monitoring and Observability Patterns

```typescript
// Comprehensive monitoring for protocol gateways
class ProtocolGatewayMonitor {
  private metrics = {
    protocolSwitches: new Map<string, number>(),
    protocolErrors: new Map<string, number>(),
    protocolLatency: new Map<string, number[]>(),
    activeConnections: new Map<string, number>()
  };
  
  recordProtocolSwitch(from: string, to: string, reason: string): void {
    const key = `${from}->${to}`;
    this.metrics.protocolSwitches.set(key, (this.metrics.protocolSwitches.get(key) || 0) + 1);
    
    console.log(`Protocol switch: ${from} -> ${to} (${reason})`);
  }
  
  recordProtocolError(protocol: string, error: Error): void {
    this.metrics.protocolErrors.set(protocol, (this.metrics.protocolErrors.get(protocol) || 0) + 1);
    
    console.error(`Protocol error (${protocol}):`, error.message);
  }
  
  recordProtocolLatency(protocol: string, latency: number): void {
    if (!this.metrics.protocolLatency.has(protocol)) {
      this.metrics.protocolLatency.set(protocol, []);
    }
    
    const latencies = this.metrics.protocolLatency.get(protocol)!;
    latencies.push(latency);
    
    // Keep only last 1000 measurements
    if (latencies.length > 1000) {
      latencies.shift();
    }
  }
  
  getMetricsSummary(): ProtocolMetricsSummary {
    return {
      protocolSwitches: Object.fromEntries(this.metrics.protocolSwitches),
      protocolErrors: Object.fromEntries(this.metrics.protocolErrors),
      protocolLatencies: this.calculateLatencyStats(),
      activeConnections: Object.fromEntries(this.metrics.activeConnections),
      timestamp: new Date().toISOString()
    };
  }
  
  private calculateLatencyStats(): Record<string, LatencyStats> {
    const stats: Record<string, LatencyStats> = {};
    
    for (const [protocol, latencies] of this.metrics.protocolLatency) {
      if (latencies.length === 0) continue;
      
      const sorted = [...latencies].sort((a, b) => a - b);
      const sum = latencies.reduce((a, b) => a + b, 0);
      
      stats[protocol] = {
        count: latencies.length,
        average: sum / latencies.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)]
      };
    }
    
    return stats;
  }
}
```

## Summary

**Key Patterns to Adopt:**
1. **Protocol Adapter**: Abstract protocol differences behind a uniform interface
2. **Protocol Router**: Route messages based on content and context
3. **State Machine**: Manage protocol transitions safely and predictably
4. **Load Balancer**: Distribute load intelligently across protocols

**Anti-Patterns to Avoid:**
1. **Protocol Chaos**: Random or arbitrary protocol switching
2. **Protocol Spaghetti**: Tight coupling between protocols and business logic
3. **Protocol Leak**: Letting protocol details leak into business logic
4. **Protocol Thrashing**: Excessive and unnecessary protocol switching

**Best Practices:**
- Use clear decision criteria for protocol selection
- Implement robust error handling with appropriate retry strategies
- Monitor and measure protocol performance continuously
- Maintain clean separation between protocol and business concerns
- Apply hysteresis to prevent switching thrashing
- Design for testability and maintainability from the start

These patterns provide a solid foundation for building robust, maintainable protocol gateways that can evolve with your application's needs while avoiding common pitfalls that lead to complexity and maintenance burden.