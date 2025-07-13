# Mocking Strategies for Verb Framework

This guide covers comprehensive mocking strategies for testing applications built with the Verb framework across all supported protocols.

## HTTP Endpoint Mocking

### Basic HTTP Mocking with Test Doubles

```typescript
import { Verb } from 'verb';
import { expect, test, beforeEach, afterEach } from 'bun:test';

class MockVerbServer {
  private routes: Map<string, Function> = new Map();
  private server: any;

  get(path: string, handler: Function) {
    this.routes.set(`GET:${path}`, handler);
    return this;
  }

  post(path: string, handler: Function) {
    this.routes.set(`POST:${path}`, handler);
    return this;
  }

  async mockRequest(method: string, path: string, body?: any) {
    const handler = this.routes.get(`${method}:${path}`);
    if (!handler) {
      return { status: 404, body: 'Not Found' };
    }

    const mockReq = {
      method,
      url: path,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
      headers: new Headers(),
    };

    const mockRes = {
      status: 200,
      body: null,
      json: (data: any) => ({ status: 200, body: data }),
      text: (data: string) => ({ status: 200, body: data }),
    };

    return await handler(mockReq, mockRes);
  }
}

// Usage in tests
test('HTTP endpoint mocking', async () => {
  const mockServer = new MockVerbServer();
  
  mockServer.get('/users/:id', (req, res) => {
    return res.json({ id: 1, name: 'Test User' });
  });

  const response = await mockServer.mockRequest('GET', '/users/1');
  expect(response.body).toEqual({ id: 1, name: 'Test User' });
});
```

### HTTP Service Mocking with Dependency Injection

```typescript
interface UserService {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserData): Promise<User>;
}

class MockUserService implements UserService {
  private users: Map<string, User> = new Map();

  async getUser(id: string): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    return user;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const user = { id: crypto.randomUUID(), ...data };
    this.users.set(user.id, user);
    return user;
  }

  // Test helper methods
  seedUser(user: User) {
    this.users.set(user.id, user);
  }

  clear() {
    this.users.clear();
  }
}

// Test setup
let mockUserService: MockUserService;
let app: Verb;

beforeEach(() => {
  mockUserService = new MockUserService();
  app = new Verb();
  
  // Inject mock service
  app.get('/users/:id', async (req, res) => {
    const user = await mockUserService.getUser(req.params.id);
    return res.json(user);
  });
});
```

## WebSocket Connection Mocking

### WebSocket Client Simulation

```typescript
class MockWebSocketClient {
  private handlers: Map<string, Function[]> = new Map();
  private connected = false;
  private server: any;

  constructor(private url: string) {}

  connect(server: any) {
    this.server = server;
    this.connected = true;
    this.emit('open');
  }

  send(data: string | object) {
    if (!this.connected) throw new Error('WebSocket not connected');
    
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    // Simulate server receiving message
    if (this.server && this.server.onMessage) {
      this.server.onMessage(message, this);
    }
  }

  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  emit(event: string, data?: any) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  close() {
    this.connected = false;
    this.emit('close');
  }

  // Simulate receiving message from server
  receive(data: string | object) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.emit('message', message);
  }
}

// Usage in tests
test('WebSocket connection mocking', async () => {
  const mockClient = new MockWebSocketClient('ws://localhost:3000');
  const messages: string[] = [];

  mockClient.on('message', (data) => {
    messages.push(data);
  });

  // Simulate server sending message
  mockClient.receive({ type: 'welcome', message: 'Connected successfully' });
  
  expect(messages).toHaveLength(1);
  expect(JSON.parse(messages[0])).toEqual({
    type: 'welcome',
    message: 'Connected successfully'
  });
});
```

### WebSocket Server Mocking

```typescript
class MockWebSocketServer {
  private clients: MockWebSocketClient[] = [];
  private handlers: Map<string, Function> = new Map();

  on(event: string, handler: Function) {
    this.handlers.set(event, handler);
  }

  addClient(client: MockWebSocketClient) {
    this.clients.push(client);
    client.connect(this);
    
    const connectionHandler = this.handlers.get('connection');
    if (connectionHandler) {
      connectionHandler(client);
    }
  }

  broadcast(data: string | object) {
    this.clients.forEach(client => client.receive(data));
  }

  onMessage(message: string, client: MockWebSocketClient) {
    const messageHandler = this.handlers.get('message');
    if (messageHandler) {
      messageHandler(message, client);
    }
  }

  removeClient(client: MockWebSocketClient) {
    const index = this.clients.indexOf(client);
    if (index > -1) {
      this.clients.splice(index, 1);
    }
  }
}

// Chat room testing example
test('WebSocket chat room simulation', async () => {
  const mockServer = new MockWebSocketServer();
  const client1 = new MockWebSocketClient('ws://localhost:3000');
  const client2 = new MockWebSocketClient('ws://localhost:3000');

  const client1Messages: string[] = [];
  const client2Messages: string[] = [];

  client1.on('message', (data) => client1Messages.push(data));
  client2.on('message', (data) => client2Messages.push(data));

  // Set up chat logic
  mockServer.on('message', (message, sender) => {
    const data = JSON.parse(message);
    if (data.type === 'chat') {
      mockServer.broadcast({ type: 'chat', user: data.user, message: data.message });
    }
  });

  // Connect clients
  mockServer.addClient(client1);
  mockServer.addClient(client2);

  // Send message from client1
  client1.send({ type: 'chat', user: 'Alice', message: 'Hello everyone!' });

  // Both clients should receive the message
  expect(client1Messages).toHaveLength(1);
  expect(client2Messages).toHaveLength(1);
});
```

## UDP/TCP Socket Mocking

### UDP Socket Mocking

```typescript
class MockUDPSocket {
  private handlers: Map<string, Function[]> = new Map();
  private bound = false;
  private port?: number;

  bind(port: number, callback?: Function) {
    this.port = port;
    this.bound = true;
    if (callback) callback();
    this.emit('listening');
  }

  send(buffer: Buffer, port: number, address: string, callback?: Function) {
    if (!this.bound) throw new Error('Socket not bound');
    
    // Simulate sending
    setTimeout(() => {
      if (callback) callback(null);
      this.emit('sent', { buffer, port, address });
    }, 0);
  }

  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  // Test helper to simulate receiving data
  simulateReceive(buffer: Buffer, rinfo: { address: string; port: number }) {
    this.emit('message', buffer, rinfo);
  }

  close(callback?: Function) {
    this.bound = false;
    if (callback) callback();
    this.emit('close');
  }
}

// Usage in tests
test('UDP socket communication', async () => {
  const mockSocket = new MockUDPSocket();
  const receivedMessages: Buffer[] = [];

  mockSocket.on('message', (buffer) => {
    receivedMessages.push(buffer);
  });

  mockSocket.bind(8080);
  
  // Simulate receiving UDP packet
  const testData = Buffer.from('Hello UDP');
  mockSocket.simulateReceive(testData, { address: '127.0.0.1', port: 3000 });

  expect(receivedMessages).toHaveLength(1);
  expect(receivedMessages[0].toString()).toBe('Hello UDP');
});
```

### TCP Socket Mocking

```typescript
class MockTCPSocket {
  private handlers: Map<string, Function[]> = new Map();
  private connected = false;
  private data: Buffer[] = [];

  connect(port: number, host: string, callback?: Function) {
    this.connected = true;
    if (callback) callback();
    setTimeout(() => this.emit('connect'), 0);
  }

  write(data: string | Buffer, callback?: Function) {
    if (!this.connected) throw new Error('Socket not connected');
    
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    this.data.push(buffer);
    
    if (callback) callback();
    this.emit('data', buffer);
  }

  on(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(...args));
  }

  // Test helper to simulate receiving data
  simulateReceive(data: string | Buffer) {
    const buffer = typeof data === 'string' ? Buffer.from(data) : data;
    this.emit('data', buffer);
  }

  end() {
    this.connected = false;
    this.emit('end');
  }

  destroy() {
    this.connected = false;
    this.emit('close');
  }
}

// Usage in tests
test('TCP socket communication', async () => {
  const mockSocket = new MockTCPSocket();
  const receivedData: Buffer[] = [];

  mockSocket.on('data', (data) => {
    receivedData.push(data);
  });

  mockSocket.connect(8080, 'localhost');
  mockSocket.write('Hello TCP');
  
  // Simulate server response
  mockSocket.simulateReceive('Hello Client');

  expect(receivedData).toHaveLength(2); // Own message + server response
  expect(receivedData[1].toString()).toBe('Hello Client');
});
```

## Server-Sent Events (SSE) Mocking

### SSE Client Mocking

```typescript
class MockEventSource {
  private handlers: Map<string, Function[]> = new Map();
  private readyState = 0; // CONNECTING
  
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  constructor(private url: string) {
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
      this.emit('open');
    }, 0);
  }

  addEventListener(event: string, handler: Function) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  removeEventListener(event: string, handler: Function) {
    const handlers = this.handlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }

  emit(event: string, data?: any) {
    const handlers = this.handlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  // Test helper to simulate server events
  simulateEvent(type: string, data: any, id?: string) {
    if (this.readyState !== MockEventSource.OPEN) return;
    
    const event = {
      type,
      data: typeof data === 'string' ? data : JSON.stringify(data),
      lastEventId: id || '',
      origin: this.url,
    };
    
    this.emit(type, event);
    this.emit('message', event);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
    this.emit('close');
  }
}

// Usage in tests
test('SSE event streaming', async () => {
  const mockEventSource = new MockEventSource('/events');
  const receivedEvents: any[] = [];

  mockEventSource.addEventListener('message', (event) => {
    receivedEvents.push(event);
  });

  mockEventSource.addEventListener('update', (event) => {
    receivedEvents.push({ type: 'update', ...event });
  });

  // Simulate server events
  mockEventSource.simulateEvent('message', { text: 'Hello SSE' });
  mockEventSource.simulateEvent('update', { status: 'processing' });

  expect(receivedEvents).toHaveLength(3); // message, update, and message for update
  expect(JSON.parse(receivedEvents[0].data)).toEqual({ text: 'Hello SSE' });
});
```

## Protocol-Specific Test Utilities

### Multi-Protocol Test Suite

```typescript
class VerbTestSuite {
  private app: Verb;
  private httpClient: MockHttpClient;
  private wsClient: MockWebSocketClient;
  private udpSocket: MockUDPSocket;
  private tcpSocket: MockTCPSocket;
  private sseClient: MockEventSource;

  constructor() {
    this.app = new Verb();
    this.setupMocks();
  }

  private setupMocks() {
    this.httpClient = new MockHttpClient();
    this.wsClient = new MockWebSocketClient('ws://localhost:3000');
    this.udpSocket = new MockUDPSocket();
    this.tcpSocket = new MockTCPSocket();
    this.sseClient = new MockEventSource('/events');
  }

  // HTTP testing utilities
  async get(path: string, headers?: Record<string, string>) {
    return this.httpClient.get(path, headers);
  }

  async post(path: string, body?: any, headers?: Record<string, string>) {
    return this.httpClient.post(path, body, headers);
  }

  // WebSocket testing utilities
  connectWebSocket() {
    return new Promise((resolve) => {
      this.wsClient.on('open', resolve);
      this.wsClient.connect(null);
    });
  }

  sendWebSocketMessage(data: any) {
    this.wsClient.send(data);
  }

  onWebSocketMessage(handler: Function) {
    this.wsClient.on('message', handler);
  }

  // UDP testing utilities
  bindUDP(port: number) {
    return new Promise((resolve) => {
      this.udpSocket.bind(port, resolve);
    });
  }

  sendUDP(buffer: Buffer, port: number, address: string) {
    return new Promise((resolve, reject) => {
      this.udpSocket.send(buffer, port, address, (err) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });
  }

  // SSE testing utilities
  connectSSE() {
    return new Promise((resolve) => {
      this.sseClient.addEventListener('open', resolve);
    });
  }

  onSSEMessage(handler: Function) {
    this.sseClient.addEventListener('message', handler);
  }

  // Cleanup
  cleanup() {
    this.wsClient.close();
    this.udpSocket.close();
    this.tcpSocket.destroy();
    this.sseClient.close();
  }
}

// Usage in integration tests
test('multi-protocol integration', async () => {
  const testSuite = new VerbTestSuite();
  
  try {
    // Test HTTP
    const httpResponse = await testSuite.get('/api/status');
    expect(httpResponse.status).toBe(200);

    // Test WebSocket
    await testSuite.connectWebSocket();
    const wsMessages: any[] = [];
    testSuite.onWebSocketMessage((data) => wsMessages.push(data));
    testSuite.sendWebSocketMessage({ type: 'ping' });

    // Test UDP
    await testSuite.bindUDP(8080);
    await testSuite.sendUDP(Buffer.from('test'), 8081, '127.0.0.1');

    // Test SSE
    await testSuite.connectSSE();
    const sseEvents: any[] = [];
    testSuite.onSSEMessage((event) => sseEvents.push(event));

    // Verify all protocols work together
    expect(wsMessages.length).toBeGreaterThan(0);
    expect(sseEvents.length).toBeGreaterThan(0);
  } finally {
    testSuite.cleanup();
  }
});
```

## Best Practices

### 1. Isolation and Cleanup

```typescript
let testSuite: VerbTestSuite;

beforeEach(() => {
  testSuite = new VerbTestSuite();
});

afterEach(() => {
  testSuite.cleanup();
});
```

### 2. Deterministic Testing

```typescript
// Use fixed timestamps and IDs for consistent testing
const mockDate = new Date('2024-01-01T00:00:00Z');
const mockId = 'test-id-12345';

jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockId);
```

### 3. Error Simulation

```typescript
class ErrorSimulatingMock {
  private shouldFail = false;
  private errorMessage = 'Simulated error';

  enableFailure(message?: string) {
    this.shouldFail = true;
    if (message) this.errorMessage = message;
  }

  disableFailure() {
    this.shouldFail = false;
  }

  async execute() {
    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }
    // Normal execution
  }
}
```

This comprehensive mocking strategy ensures thorough testing of Verb applications across all supported protocols while maintaining test isolation and reliability.