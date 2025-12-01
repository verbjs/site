# Testing Guide

Comprehensive testing strategies and patterns for Verb applications using Bun's built-in test runner.

## Overview

Verb applications benefit from a multi-layered testing approach:

- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test API endpoints and database operations
- **End-to-End Tests**: Test complete user workflows
- **Protocol-Specific Tests**: Test WebSocket, TCP, UDP functionality

## Setting Up Tests

### Test Configuration

```typescript
// tests/setup.ts
import { beforeAll, afterAll } from 'bun:test';

// Global test setup
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'sqlite://:memory:';
  process.env.JWT_SECRET = 'test-secret';
});

// Global test cleanup
afterAll(() => {
  // Cleanup resources
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:e2e": "bun test tests/e2e"
  }
}
```

## Unit Testing

### Testing API Endpoints

```typescript
// tests/unit/api/users.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';

describe('Users API', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    const app = server.http();
    
    // Setup test routes
    app.get('/api/users', async (req, res) => {
      return res.json({ users: [] });
    });

    app.post('/api/users', async (req, res) => {
      const body = await req.json();
      return res.status(201).json({ id: 1, ...body });
    });

    server = app.withOptions({ port: 0 }).listen();
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('GET /api/users - should return users list', async () => {
    const response = await fetch(`${baseUrl}/api/users`);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toEqual([]);
  });

  test('POST /api/users - should create user', async () => {
    const newUser = { name: 'John', email: 'john@example.com' };
    
    const response = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toMatchObject({ id: 1, ...newUser });
  });
});
```

### Testing Middleware

```typescript
// tests/unit/middleware/auth.test.ts
import { describe, test, expect, mock } from 'bun:test';

const authMiddleware = async (req: any, res: any, next: () => void) => {
  const token = req.headers.get('authorization');
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }
  
  req.user = { id: 1, name: 'Test User' };
  next();
};

describe('Auth Middleware', () => {
  test('should reject requests without token', async () => {
    const req = { headers: { get: mock(() => null) } };
    const res = { 
      status: mock((code) => res),
      json: mock((data) => data)
    };
    const next = mock();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('should pass with valid token', async () => {
    const req = { 
      headers: { get: mock(() => 'Bearer valid-token') },
      user: undefined
    };
    const res = {};
    const next = mock();

    await authMiddleware(req, res, next);

    expect(req.user).toEqual({ id: 1, name: 'Test User' });
    expect(next).toHaveBeenCalled();
  });
});
```

### Testing Utilities and Helpers

```typescript
// tests/unit/utils/validation.test.ts
import { describe, test, expect } from 'bun:test';

// Example validation function
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain number');
  }
  
  return { valid: errors.length === 0, errors };
};

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    test('should validate correct emails', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.email+tag@domain.co.uk')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
      expect(result.errors).toContain('Password must contain uppercase letter');
      expect(result.errors).toContain('Password must contain number');
    });
  });
});
```

## Integration Testing

### Database Testing

```typescript
// tests/integration/database.test.ts
import { describe, test, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

describe('Database Integration', () => {
  let db: Database;

  beforeEach(() => {
    // Use in-memory database for tests
    db = new Database(':memory:');
    
    // Setup schema
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
      )
    `);
  });

  test('should create and retrieve user', () => {
    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    const result = stmt.run('John Doe', 'john@example.com');
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
  });

  test('should enforce unique email constraint', () => {
    const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    stmt.run('User 1', 'same@example.com');
    
    expect(() => {
      stmt.run('User 2', 'same@example.com');
    }).toThrow();
  });
});
```

### API Integration Testing

```typescript
// tests/integration/api.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';

describe('API Integration', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Start your actual application server
    const app = await import('../src/server');
    server = app.server; // Assuming your server exports the server instance
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('should handle complete user workflow', async () => {
    // 1. Create user
    const createResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Test User',
        email: 'integration@example.com'
      })
    });
    
    expect(createResponse.status).toBe(201);
    const createdUser = await createResponse.json();
    const userId = createdUser.id;

    // 2. Retrieve user
    const getResponse = await fetch(`${baseUrl}/api/users/${userId}`);
    expect(getResponse.status).toBe(200);
    
    const retrievedUser = await getResponse.json();
    expect(retrievedUser.name).toBe('Integration Test User');

    // 3. Update user
    const updateResponse = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' })
    });
    
    expect(updateResponse.status).toBe(200);

    // 4. Delete user
    const deleteResponse = await fetch(`${baseUrl}/api/users/${userId}`, {
      method: 'DELETE'
    });
    
    expect(deleteResponse.status).toBe(204);

    // 5. Verify deletion
    const verifyResponse = await fetch(`${baseUrl}/api/users/${userId}`);
    expect(verifyResponse.status).toBe(404);
  });
});
```

## WebSocket Testing

### WebSocket Connection Testing

```typescript
// tests/integration/websocket.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { server } from 'verb';

describe('WebSocket Integration', () => {
  let server: any;
  let wsUrl: string;

  beforeAll(async () => {
    const app = server.websocket();
    
    app.websocket({
      open: (ws) => {
        ws.send(JSON.stringify({ type: 'welcome', message: 'Connected' }));
      },
      
      message: (ws, message) => {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'echo') {
          ws.send(JSON.stringify({ type: 'echo', data: data.message }));
        }
      }
    });

    server = app.withOptions({ port: 0 }).listen();
    wsUrl = `ws://localhost:${server.port}`;
  });

  afterAll(() => {
    server?.stop();
  });

  test('should establish WebSocket connection', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        ws.close();
        resolve(undefined);
      };
      
      ws.onerror = reject;
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  test('should receive welcome message', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        expect(data.type).toBe('welcome');
        expect(data.message).toBe('Connected');
        ws.close();
        resolve(undefined);
      };
      
      ws.onerror = reject;
      setTimeout(() => reject(new Error('Message timeout')), 5000);
    });
  });

  test('should echo messages', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const testMessage = 'Hello WebSocket';
      
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'echo', message: testMessage }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'echo') {
          expect(data.data).toBe(testMessage);
          ws.close();
          resolve(undefined);
        }
      };
      
      ws.onerror = reject;
      setTimeout(() => reject(new Error('Echo timeout')), 5000);
    });
  });
});
```

## Mocking and Test Utilities

### Database Mocking

```typescript
// tests/mocks/database.ts
export class MockDatabase {
  private data = new Map<string, any[]>();

  constructor() {
    this.data.set('users', []);
    this.data.set('posts', []);
  }

  create(table: string, data: any) {
    const items = this.data.get(table) || [];
    const newItem = { id: Date.now(), ...data };
    items.push(newItem);
    this.data.set(table, items);
    return newItem;
  }

  find(table: string, predicate?: (item: any) => boolean) {
    const items = this.data.get(table) || [];
    return predicate ? items.filter(predicate) : items;
  }

  findOne(table: string, predicate: (item: any) => boolean) {
    const items = this.data.get(table) || [];
    return items.find(predicate);
  }

  update(table: string, id: number, updates: any) {
    const items = this.data.get(table) || [];
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      return items[index];
    }
    return null;
  }

  delete(table: string, id: number) {
    const items = this.data.get(table) || [];
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      return items.splice(index, 1)[0];
    }
    return null;
  }

  clear(table?: string) {
    if (table) {
      this.data.set(table, []);
    } else {
      this.data.clear();
    }
  }
}
```

### HTTP Client Mocking

```typescript
// tests/mocks/http.ts
export class MockHTTPClient {
  private responses = new Map<string, any>();

  mockResponse(url: string, response: any) {
    this.responses.set(url, response);
  }

  async fetch(url: string, options?: any): Promise<Response> {
    const mockResponse = this.responses.get(url);
    
    if (!mockResponse) {
      throw new Error(`No mock response for ${url}`);
    }

    return new Response(JSON.stringify(mockResponse.body), {
      status: mockResponse.status || 200,
      headers: mockResponse.headers || {}
    });
  }

  clear() {
    this.responses.clear();
  }
}
```

## Test Helpers

### Server Test Helper

```typescript
// tests/helpers/server.ts
import { server } from 'verb';

export class TestServer {
  private server: any;
  public baseUrl: string = '';

  async start(setupRoutes: (app: any) => void, protocol = ServerProtocol.HTTP) {
    const app = server.http(); // or other protocol
    setupRoutes(app);
    
    this.server = app.withOptions({ port: 0 }).listen();
    this.baseUrl = `http://localhost:${this.server.port}`;
    
    return this.server;
  }

  stop() {
    this.server?.stop();
  }

  async request(path: string, options: RequestInit = {}) {
    return fetch(`${this.baseUrl}${path}`, options);
  }

  async get(path: string) {
    return this.request(path);
  }

  async post(path: string, body: any) {
    return this.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async put(path: string, body: any) {
    return this.request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async delete(path: string) {
    return this.request(path, { method: 'DELETE' });
  }
}
```

### Authentication Helper

```typescript
// tests/helpers/auth.ts
export class AuthHelper {
  constructor(private baseUrl: string) {}

  async login(username: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    const data = await response.json();
    return data.token;
  }

  async authenticatedRequest(url: string, token: string, options: RequestInit = {}) {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  }
}
```

## Performance Testing

### Load Testing with Bun

```typescript
// tests/performance/load.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('Performance Tests', () => {
  let server: any;
  let baseUrl: string;

  beforeAll(async () => {
    // Start server
  });

  afterAll(() => {
    server?.stop();
  });

  test('should handle concurrent requests', async () => {
    const concurrency = 100;
    const requests = Array.from({ length: concurrency }, () => 
      fetch(`${baseUrl}/api/health`)
    );

    const start = performance.now();
    const responses = await Promise.all(requests);
    const duration = performance.now() - start;

    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });

    // Should complete in reasonable time
    expect(duration).toBeLessThan(1000); // 1 second for 100 requests
  });

  test('should maintain performance under load', async () => {
    const iterations = 1000;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const response = await fetch(`${baseUrl}/api/health`);
      const duration = performance.now() - start;
      
      expect(response.status).toBe(200);
      times.push(duration);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);

    expect(avgTime).toBeLessThan(10); // Average under 10ms
    expect(maxTime).toBeLessThan(50); // Max under 50ms
  });
});
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain what is being tested
3. **Keep tests independent** - each test should be able to run in isolation
4. **Use setup and teardown** hooks for common initialization

### Test Data Management

1. **Use factories** for creating test data
2. **Clean up after tests** to prevent interference
3. **Use in-memory databases** for fast test execution
4. **Mock external dependencies** to ensure reliable tests

### Assertions

1. **Test behavior, not implementation** details
2. **Use specific assertions** rather than general ones
3. **Test error conditions** as well as success cases
4. **Verify side effects** of operations

### Performance

1. **Run tests in parallel** when possible
2. **Use beforeAll/afterAll** for expensive setup
3. **Mock slow operations** like network calls
4. **Profile test execution** to identify bottlenecks

## Next Steps

- [Integration Testing Patterns](./integration-testing.md)
- [Mocking Strategies](./mocking-strategies.md)
- [CI/CD Pipelines](./ci-cd-pipelines.md)