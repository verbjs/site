# Integration Testing Patterns

Advanced integration testing strategies for Verb applications, covering database interactions, external services, and multi-protocol scenarios.

## Overview

Integration tests verify that different parts of your application work together correctly. They test:

- **API endpoint flows** with real HTTP requests
- **Database operations** with actual database connections
- **External service integrations** with mocked or test services
- **Multi-protocol interactions** between HTTP, WebSocket, TCP, etc.
- **Authentication and authorization** flows
- **File upload and processing** workflows

## Database Integration Testing

### SQLite Testing Setup

```typescript
// tests/integration/db/sqlite.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { join } from 'path';

interface User {
  id?: number;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

class UserRepository {
  constructor(private db: Database) {
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  create(user: Omit<User, 'id'>): User {
    const stmt = this.db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = stmt.run(user.name, user.email);
    return { id: result.lastInsertRowid as number, ...user };
  }

  findById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | null;
  }

  findByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | null;
  }

  update(id: number, updates: Partial<User>): boolean {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    const stmt = this.db.prepare(`
      UPDATE users 
      SET ${fields}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values, id);
    return result.changes > 0;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  list(limit = 10, offset = 0): User[] {
    const stmt = this.db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?');
    return stmt.all(limit, offset) as User[];
  }
}

describe('User Repository Integration', () => {
  let db: Database;
  let userRepo: UserRepository;

  beforeEach(() => {
    // Use temporary file for each test
    db = new Database(':memory:');
    userRepo = new UserRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  test('should create and retrieve user', () => {
    const userData = { name: 'John Doe', email: 'john@example.com' };
    const created = userRepo.create(userData);

    expect(created.id).toBeDefined();
    expect(created.name).toBe(userData.name);
    expect(created.email).toBe(userData.email);

    const retrieved = userRepo.findById(created.id!);
    expect(retrieved).toMatchObject(userData);
    expect(retrieved?.created_at).toBeDefined();
  });

  test('should enforce unique email constraint', () => {
    userRepo.create({ name: 'User 1', email: 'same@example.com' });

    expect(() => {
      userRepo.create({ name: 'User 2', email: 'same@example.com' });
    }).toThrow();
  });

  test('should update user data', () => {
    const created = userRepo.create({ name: 'Original', email: 'original@example.com' });
    
    const updated = userRepo.update(created.id!, { 
      name: 'Updated Name',
      email: 'updated@example.com'
    });

    expect(updated).toBe(true);

    const retrieved = userRepo.findById(created.id!);
    expect(retrieved?.name).toBe('Updated Name');
    expect(retrieved?.email).toBe('updated@example.com');
    expect(retrieved?.updated_at).toBeDefined();
  });

  test('should handle concurrent operations', () => {
    const users = Array.from({ length: 100 }, (_, i) => ({
      name: `User ${i}`,
      email: `user${i}@example.com`
    }));

    // Create users concurrently
    users.forEach(user => userRepo.create(user));

    const allUsers = userRepo.list(100);
    expect(allUsers).toHaveLength(100);
  });

  test('should paginate results correctly', () => {
    // Create test data
    for (let i = 0; i < 25; i++) {
      userRepo.create({ name: `User ${i}`, email: `user${i}@example.com` });
    }

    const page1 = userRepo.list(10, 0);
    const page2 = userRepo.list(10, 10);
    const page3 = userRepo.list(10, 20);

    expect(page1).toHaveLength(10);
    expect(page2).toHaveLength(10);
    expect(page3).toHaveLength(5);

    // Ensure no duplicates across pages
    const allIds = [...page1, ...page2, ...page3].map(u => u.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });
});
```

### PostgreSQL Testing Setup

```typescript
// tests/integration/db/postgres.test.ts
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';

// Mock PostgreSQL client for demonstration
class PostgreSQLClient {
  private connected = false;

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async query(sql: string, params: any[] = []) {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    // Mock query execution
    return { rows: [], rowCount: 0 };
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.query('BEGIN');
    try {
      const result = await callback();
      await this.query('COMMIT');
      return result;
    } catch (error) {
      await this.query('ROLLBACK');
      throw error;
    }
  }
}

describe('PostgreSQL Integration', () => {
  let client: PostgreSQLClient;

  beforeAll(async () => {
    client = new PostgreSQLClient();
    await client.connect();
    
    // Setup test schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS test_users');
    await client.disconnect();
  });

  beforeEach(async () => {
    await client.query('TRUNCATE test_users RESTART IDENTITY');
  });

  test('should handle database transactions', async () => {
    const result = await client.transaction(async () => {
      await client.query(
        'INSERT INTO test_users (name, email) VALUES ($1, $2)',
        ['User 1', 'user1@example.com']
      );
      
      await client.query(
        'INSERT INTO test_users (name, email) VALUES ($1, $2)',
        ['User 2', 'user2@example.com']
      );

      return 'success';
    });

    expect(result).toBe('success');
  });

  test('should rollback failed transactions', async () => {
    await expect(async () => {
      await client.transaction(async () => {
        await client.query(
          'INSERT INTO test_users (name, email) VALUES ($1, $2)',
          ['User 1', 'user1@example.com']
        );
        
        // This should fail due to duplicate email
        await client.query(
          'INSERT INTO test_users (name, email) VALUES ($1, $2)',
          ['User 2', 'user1@example.com']
        );
      });
    }).toThrow();

    // Verify no users were created
    const result = await client.query('SELECT COUNT(*) FROM test_users');
    expect(result.rows[0].count).toBe(0);
  });
});
```

## API Integration Testing

### Full Request/Response Cycle Testing

```typescript
// tests/integration/api/full-workflow.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';

describe('API Integration Workflows', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    const app = server.http();
    
    // Mock data store
    const users: any[] = [];
    const posts: any[] = [];

    // Auth middleware
    const authMiddleware = async (req: any, res: any, next: () => void) => {
      const token = req.headers.get('authorization')?.replace('Bearer ', '');
      if (!token || token !== 'valid-token') {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.user = { id: 1, name: 'Test User' };
      next();
    };

    // Authentication routes
    app.post('/api/auth/login', async (req, res) => {
      const { username, password } = await req.json();
      if (username === 'testuser' && password === 'password') {
        return res.json({ token: 'valid-token', user: { id: 1, name: 'Test User' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    });

    // User routes
    app.get('/api/users', authMiddleware, async (req, res) => {
      return res.json({ users });
    });

    app.post('/api/users', authMiddleware, async (req, res) => {
      const userData = await req.json();
      const user = { id: users.length + 1, ...userData };
      users.push(user);
      return res.status(201).json(user);
    });

    // Post routes
    app.get('/api/posts', async (req, res) => {
      const published = posts.filter(p => p.published);
      return res.json({ posts: published });
    });

    app.post('/api/posts', authMiddleware, async (req, res) => {
      const postData = await req.json();
      const post = {
        id: posts.length + 1,
        ...postData,
        authorId: req.user.id,
        createdAt: new Date().toISOString()
      };
      posts.push(post);
      return res.status(201).json(post);
    });

    app.put('/api/posts/:id', authMiddleware, async (req, res) => {
      const id = parseInt(req.params.id);
      const postIndex = posts.findIndex(p => p.id === id);
      
      if (postIndex === -1) {
        return res.status(404).json({ error: 'Post not found' });
      }
      
      const updates = await req.json();
      posts[postIndex] = { ...posts[postIndex], ...updates };
      
      return res.json(posts[postIndex]);
    });

    server = app.withOptions({ port: 0 }).listen();
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('complete user registration and content creation workflow', async () => {
    // 1. Login
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password' })
    });

    expect(loginResponse.status).toBe(200);
    const { token } = await loginResponse.json();

    // 2. Create user profile
    const userResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        bio: 'Test user bio'
      })
    });

    expect(userResponse.status).toBe(201);
    const user = await userResponse.json();

    // 3. Create a draft post
    const draftResponse = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'My First Post',
        content: 'This is my first post content',
        published: false
      })
    });

    expect(draftResponse.status).toBe(201);
    const draft = await draftResponse.json();

    // 4. Publish the post
    const publishResponse = await fetch(`${baseUrl}/api/posts/${draft.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ published: true })
    });

    expect(publishResponse.status).toBe(200);
    const published = await publishResponse.json();
    expect(published.published).toBe(true);

    // 5. Verify post appears in public feed
    const feedResponse = await fetch(`${baseUrl}/api/posts`);
    expect(feedResponse.status).toBe(200);
    
    const { posts } = await feedResponse.json();
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('My First Post');
  });

  test('should handle authentication errors properly', async () => {
    // Try to access protected resource without token
    const noTokenResponse = await fetch(`${baseUrl}/api/users`);
    expect(noTokenResponse.status).toBe(401);

    // Try with invalid token
    const invalidTokenResponse = await fetch(`${baseUrl}/api/users`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    expect(invalidTokenResponse.status).toBe(401);
  });

  test('should handle not found errors', async () => {
    // Login first
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password' })
    });

    const { token } = await loginResponse.json();

    // Try to update non-existent post
    const response = await fetch(`${baseUrl}/api/posts/999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'Updated' })
    });

    expect(response.status).toBe(404);
  });
});
```

## External Service Integration

### HTTP Service Integration Testing

```typescript
// tests/integration/external/http-service.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

class ExternalAPIClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async getUser(id: number) {
    const response = await fetch(`${this.baseUrl}/users/${id}`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async createUser(userData: any) {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}

// Mock external service for testing
class MockExternalService {
  private server: any;
  private users = new Map<number, any>();

  async start(port: number) {
    const app = server.http();

    app.get('/users/:id', async (req, res) => {
      const id = parseInt(req.params.id);
      const user = this.users.get(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json(user);
    });

    app.post('/users', async (req, res) => {
      const userData = await req.json();
      const id = this.users.size + 1;
      const user = { id, ...userData };
      this.users.set(id, user);
      
      return res.status(201).json(user);
    });

    this.server = app.withOptions({ port }).listen();
    return this.server;
  }

  stop() {
    this.server?.stop();
  }
}

describe('External Service Integration', () => {
  let mockService: MockExternalService;
  let client: ExternalAPIClient;
  let servicePort: number;

  beforeAll(async () => {
    servicePort = 9001;
    mockService = new MockExternalService();
    await mockService.start(servicePort);
    
    client = new ExternalAPIClient(`http://localhost:${servicePort}`, 'test-api-key');
  });

  afterAll(() => {
    mockService.stop();
  });

  test('should create and retrieve user from external service', async () => {
    const userData = {
      name: 'External User',
      email: 'external@example.com'
    };

    const created = await client.createUser(userData);
    expect(created.id).toBeDefined();
    expect(created.name).toBe(userData.name);

    const retrieved = await client.getUser(created.id);
    expect(retrieved).toMatchObject(userData);
  });

  test('should handle external service errors', async () => {
    await expect(client.getUser(999)).rejects.toThrow('API error: 404');
  });

  test('should handle service timeouts', async () => {
    // Mock timeout scenario
    const timeoutClient = new ExternalAPIClient('http://localhost:9999', 'test-key');
    
    await expect(timeoutClient.getUser(1)).rejects.toThrow();
  });
});
```

## Multi-Protocol Integration Testing

### HTTP + WebSocket Integration

```typescript
// tests/integration/protocols/http-websocket.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';

describe('HTTP + WebSocket Integration', () => {
  let server: any;
  let baseUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    const app = server.websocket();
    
    const rooms = new Map<string, Set<any>>();
    const sessions = new Map<any, { id: string; room?: string }>();

    // HTTP endpoints for room management
    app.get('/api/rooms', async (req, res) => {
      const roomList = Array.from(rooms.keys()).map(id => ({
        id,
        userCount: rooms.get(id)?.size || 0
      }));
      return res.json({ rooms: roomList });
    });

    app.post('/api/rooms', async (req, res) => {
      const { name } = await req.json();
      const id = `room_${Date.now()}`;
      rooms.set(id, new Set());
      return res.status(201).json({ id, name, userCount: 0 });
    });

    // WebSocket handling
    app.websocket({
      open: (ws) => {
        const sessionId = crypto.randomUUID();
        sessions.set(ws, { id: sessionId });
        
        ws.send(JSON.stringify({
          type: 'connected',
          sessionId
        }));
      },

      message: (ws, message) => {
        const data = JSON.parse(message.toString());
        const session = sessions.get(ws);

        if (!session) return;

        switch (data.type) {
          case 'join_room':
            const roomId = data.roomId;
            
            // Leave current room
            if (session.room) {
              const currentRoom = rooms.get(session.room);
              currentRoom?.delete(ws);
            }

            // Join new room
            if (!rooms.has(roomId)) {
              rooms.set(roomId, new Set());
            }
            
            rooms.get(roomId)!.add(ws);
            session.room = roomId;

            ws.send(JSON.stringify({
              type: 'room_joined',
              roomId
            }));
            break;

          case 'send_message':
            if (session.room) {
              const room = rooms.get(session.room);
              const messageData = {
                type: 'message',
                content: data.content,
                sessionId: session.id,
                timestamp: new Date().toISOString()
              };

              room?.forEach(client => {
                if (client !== ws) {
                  client.send(JSON.stringify(messageData));
                }
              });
            }
            break;
        }
      },

      close: (ws) => {
        const session = sessions.get(ws);
        if (session?.room) {
          const room = rooms.get(session.room);
          room?.delete(ws);
        }
        sessions.delete(ws);
      }
    });

    server = app.withOptions({ port: 0 }).listen();
    baseUrl = `http://localhost:${server.port}`;
    wsUrl = `ws://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('should create room via HTTP and join via WebSocket', async () => {
    // 1. Create room via HTTP
    const createResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Room' })
    });

    expect(createResponse.status).toBe(201);
    const room = await createResponse.json();

    // 2. Connect via WebSocket and join room
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let connected = false;
      let joined = false;

      ws.onopen = () => {
        connected = true;
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected' && connected && !joined) {
          // Join the room
          ws.send(JSON.stringify({
            type: 'join_room',
            roomId: room.id
          }));
          joined = true;
        } else if (data.type === 'room_joined') {
          expect(data.roomId).toBe(room.id);
          ws.close();
          resolve(undefined);
        }
      };

      ws.onerror = reject;
      setTimeout(() => reject(new Error('Test timeout')), 5000);
    });
  });

  test('should enable real-time messaging between WebSocket clients', async () => {
    // Create room first
    const createResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Message Test Room' })
    });

    const room = await createResponse.json();

    return new Promise((resolve, reject) => {
      let client1Connected = false;
      let client2Connected = false;
      let client1Joined = false;
      let client2Joined = false;

      const client1 = new WebSocket(wsUrl);
      const client2 = new WebSocket(wsUrl);

      client1.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          client1Connected = true;
          if (client2Connected) {
            // Both connected, join room
            client1.send(JSON.stringify({
              type: 'join_room',
              roomId: room.id
            }));
          }
        } else if (data.type === 'room_joined') {
          client1Joined = true;
          if (client2Joined) {
            // Both joined, send message
            client1.send(JSON.stringify({
              type: 'send_message',
              content: 'Hello from client 1'
            }));
          }
        }
      };

      client2.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'connected') {
          client2Connected = true;
          if (client1Connected) {
            // Both connected, join room
            client2.send(JSON.stringify({
              type: 'join_room',
              roomId: room.id
            }));
          }
        } else if (data.type === 'room_joined') {
          client2Joined = true;
          if (client1Joined) {
            // Both joined, client1 will send message
          }
        } else if (data.type === 'message') {
          expect(data.content).toBe('Hello from client 1');
          client1.close();
          client2.close();
          resolve(undefined);
        }
      };

      client1.onerror = client2.onerror = reject;
      setTimeout(() => reject(new Error('Test timeout')), 5000);
    });
  });

  test('should show updated room counts via HTTP after WebSocket connections', async () => {
    // Create room
    const createResponse = await fetch(`${baseUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Count Test Room' })
    });

    const room = await createResponse.json();

    // Connect WebSocket clients
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    // Wait for connections and joins
    await new Promise((resolve) => {
      let connectCount = 0;
      let joinCount = 0;

      const handleMessage = (data: any) => {
        if (data.type === 'connected') {
          connectCount++;
          if (connectCount === 2) {
            // Both connected, join room
            ws1.send(JSON.stringify({ type: 'join_room', roomId: room.id }));
            ws2.send(JSON.stringify({ type: 'join_room', roomId: room.id }));
          }
        } else if (data.type === 'room_joined') {
          joinCount++;
          if (joinCount === 2) {
            resolve(undefined);
          }
        }
      };

      ws1.onmessage = (event) => handleMessage(JSON.parse(event.data));
      ws2.onmessage = (event) => handleMessage(JSON.parse(event.data));
    });

    // Check room count via HTTP
    const roomsResponse = await fetch(`${baseUrl}/api/rooms`);
    const { rooms } = await roomsResponse.json();
    
    const testRoom = rooms.find((r: any) => r.id === room.id);
    expect(testRoom.userCount).toBe(2);

    ws1.close();
    ws2.close();
  });
});
```

## File Upload Integration Testing

### File Upload Workflow Testing

```typescript
// tests/integration/upload/file-upload.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';
import { join } from 'path';

describe('File Upload Integration', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    const app = server.http();
    
    const uploadedFiles: any[] = [];

    app.post('/api/upload', async (req, res) => {
      try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return res.status(400).json({ error: 'No file provided' });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'text/plain'];
        if (!allowedTypes.includes(file.type)) {
          return res.status(400).json({ error: 'Invalid file type' });
        }

        // Validate file size (5MB max)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          return res.status(400).json({ error: 'File too large' });
        }

        const fileData = {
          id: uploadedFiles.length + 1,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString()
        };

        uploadedFiles.push(fileData);

        return res.status(201).json(fileData);
      } catch (error) {
        return res.status(500).json({ error: 'Upload failed' });
      }
    });

    app.get('/api/uploads', async (req, res) => {
      return res.json({ files: uploadedFiles });
    });

    server = app.withOptions({ port: 0 }).listen();
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('should upload valid file', async () => {
    const fileContent = 'This is test file content';
    const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(201);
    const result = await response.json();

    expect(result.originalName).toBe('test.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(result.size).toBe(fileContent.length);
    expect(result.id).toBeDefined();
  });

  test('should reject invalid file types', async () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Invalid file type');
  });

  test('should reject files that are too large', async () => {
    // Create a large file (6MB)
    const largeContent = 'x'.repeat(6 * 1024 * 1024);
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('File too large');
  });

  test('should handle multiple file uploads', async () => {
    const files = [
      new File(['content 1'], 'file1.txt', { type: 'text/plain' }),
      new File(['content 2'], 'file2.txt', { type: 'text/plain' }),
      new File(['content 3'], 'file3.txt', { type: 'text/plain' })
    ];

    const uploadPromises = files.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      
      return fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        body: formData
      });
    });

    const responses = await Promise.all(uploadPromises);
    
    responses.forEach(response => {
      expect(response.status).toBe(201);
    });

    // Verify all files are tracked
    const listResponse = await fetch(`${baseUrl}/api/uploads`);
    const { files: uploadedFiles } = await listResponse.json();
    
    expect(uploadedFiles).toHaveLength(files.length + 1); // +1 from previous test
  });
});
```

## Test Environment Management

### Environment Configuration for Testing

```typescript
// tests/config/test-env.ts
export const testConfig = {
  database: {
    url: process.env.TEST_DATABASE_URL || 'sqlite://:memory:',
    resetBetweenTests: true
  },
  
  server: {
    port: 0, // Use random available port
    timeout: 5000
  },
  
  external: {
    mockServices: true,
    timeouts: {
      short: 1000,
      medium: 3000,
      long: 10000
    }
  },
  
  files: {
    uploadPath: '/tmp/test-uploads',
    maxSize: 1024 * 1024, // 1MB for tests
    allowedTypes: ['text/plain', 'image/jpeg', 'image/png']
  }
};

export const setupTestEnvironment = () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.DATABASE_URL = testConfig.database.url;
  
  // Disable logging in tests
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
};

export const teardownTestEnvironment = () => {
  // Cleanup test files, connections, etc.
};
```

## Best Practices for Integration Testing

### 1. Test Data Management

```typescript
// tests/helpers/test-data.ts
export class TestDataFactory {
  static createUser(overrides: any = {}) {
    return {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'password123',
      ...overrides
    };
  }

  static createPost(userId: number, overrides: any = {}) {
    return {
      title: 'Test Post',
      content: 'This is test content',
      authorId: userId,
      published: false,
      ...overrides
    };
  }

  static createUsers(count: number) {
    return Array.from({ length: count }, (_, i) => 
      this.createUser({ email: `user${i}@example.com` })
    );
  }
}
```

### 2. Test Isolation

```typescript
// tests/helpers/isolation.ts
export class TestIsolation {
  private cleanupTasks: (() => Promise<void>)[] = [];

  addCleanup(task: () => Promise<void>) {
    this.cleanupTasks.push(task);
  }

  async cleanup() {
    for (const task of this.cleanupTasks.reverse()) {
      try {
        await task();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    }
    this.cleanupTasks = [];
  }
}
```

### 3. Async Test Utilities

```typescript
// tests/helpers/async-utils.ts
export const waitFor = (condition: () => boolean, timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 50);
      }
    };
    
    check();
  });
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
```

## Next Steps

- [Mocking Strategies](./mocking-strategies.md)
- [CI/CD Pipelines](./ci-cd-pipelines.md)
- [Testing Guide](./testing-guide.md)