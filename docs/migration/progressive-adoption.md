# Progressive Adoption Strategy

A step-by-step guide to gradually adopt Verb in existing applications without disrupting production systems.

## Adoption Phases

### Phase 1: Single Endpoint Migration (Week 1)
Start with one non-critical endpoint to test Verb integration.

```typescript
// Add Verb alongside existing framework
import { Verb } from 'verb';

const verbApp = new Verb();

// Migrate one simple endpoint
verbApp.get('/api/v2/health', (req, res) => {
  return res.json({ status: 'ok', framework: 'verb' });
});

// Run on different port initially
verbApp.listen(3001);
```

**Benefits:**
- Zero risk to existing system
- Team can learn Verb syntax
- Performance comparison possible
- Easy rollback if needed

### Phase 2: New Feature Development (Week 2-4)
Build new features exclusively with Verb.

```typescript
// All new endpoints use Verb
verbApp.get('/api/v2/users', async (req, res) => {
  const users = await userService.getAll();
  return res.json(users);
});

verbApp.post('/api/v2/users', async (req, res) => {
  const userData = await req.json();
  const user = await userService.create(userData);
  return res.status(201).json(user);
});

// Add real-time features (Verb advantage)
verbApp.websocket('/api/v2/notifications', {
  open: (ws) => ws.subscribe('notifications'),
  message: (ws, data) => ws.publish('notifications', data)
});
```

### Phase 3: Critical Path Migration (Week 5-8)
Migrate high-traffic, performance-sensitive endpoints.

```typescript
// Migrate performance-critical endpoints
verbApp.get('/api/v2/search', async (req, res) => {
  const { q } = req.query;
  const results = await searchService.query(q);
  return res.json(results);
});

// Add caching middleware for better performance
const cacheMiddleware = (req, res, next) => {
  const key = `cache:${req.url}`;
  const cached = cache.get(key);
  if (cached) return res.json(cached);
  return next();
};

verbApp.get('/api/v2/products', cacheMiddleware, async (req, res) => {
  const products = await productService.getAll();
  cache.set(`cache:${req.url}`, products, 300); // 5min cache
  return res.json(products);
});
```

### Phase 4: Full Migration (Week 9-12)
Complete migration and consolidation.

```typescript
// Single application serving all routes
const app = new Verb();

// All endpoints now use Verb
app.get('/api/users', userController.getAll);
app.post('/api/users', userController.create);
app.get('/api/products', productController.getAll);

// Multi-protocol features
app.websocket('/ws/live-updates', liveUpdateHandler);
app.static('/uploads', './uploads');

app.listen(3000);
```

## Parallel Deployment Strategy

### Reverse Proxy Setup
Use nginx or a load balancer to route traffic between old and new systems.

```nginx
# nginx.conf
upstream legacy_app {
    server localhost:3000;
}

upstream verb_app {
    server localhost:3001;
}

server {
    listen 80;
    
    # Route v2 API to Verb
    location /api/v2/ {
        proxy_pass http://verb_app;
    }
    
    # Route legacy API to existing app
    location /api/ {
        proxy_pass http://legacy_app;
    }
    
    # Static files
    location /static/ {
        root /var/www;
    }
}
```

### Feature Flags
Control traffic routing with feature flags.

```typescript
// Feature flag middleware
const featureFlag = (flag: string) => (req, res, next) => {
  if (process.env[flag] === 'true') {
    return next();
  }
  // Fallback to legacy endpoint
  return res.redirect(`/api/v1${req.path}`);
};

// Use feature flags for gradual rollout
verbApp.get('/api/v2/users', 
  featureFlag('ENABLE_VERB_USERS'),
  userController.getAll
);
```

## Migration Patterns

### 1. Shared Services Pattern
Keep business logic in shared services.

```typescript
// shared/userService.ts
export class UserService {
  async getUser(id: string) {
    return await db.users.findById(id);
  }
  
  async createUser(data: any) {
    return await db.users.create(data);
  }
}

// Express controller
app.get('/api/v1/users/:id', async (req, res) => {
  const user = await userService.getUser(req.params.id);
  res.json(user);
});

// Verb controller  
verbApp.get('/api/v2/users/:id', async (req, res) => {
  const user = await userService.getUser(req.params.id);
  return res.json(user);
});
```

### 2. Database Migration Pattern
Migrate data access patterns gradually.

```typescript
// Legacy database access
app.get('/api/v1/orders', async (req, res) => {
  const orders = await db.query('SELECT * FROM orders');
  res.json(orders);
});

// New optimized access with Verb
verbApp.get('/api/v2/orders', async (req, res) => {
  const orders = await orderRepository.findAllOptimized();
  return res.json(orders);
});
```

### 3. Middleware Compatibility Pattern
Reuse existing middleware where possible.

```typescript
// Adapter for Express middleware
function adaptExpressMiddleware(expressMiddleware) {
  return (req, res, next) => {
    // Adapt request/response objects
    const adaptedReq = { 
      ...req, 
      headers: Object.fromEntries(req.headers.entries())
    };
    const adaptedRes = {
      json: (data) => res.json(data),
      status: (code) => ({ json: (data) => res.status(code).json(data) })
    };
    
    return expressMiddleware(adaptedReq, adaptedRes, next);
  };
}

// Reuse existing auth middleware
verbApp.use(adaptExpressMiddleware(authMiddleware));
```

## Testing Strategy

### A/B Testing Setup
Compare performance between old and new implementations.

```typescript
// A/B test middleware
const abTestMiddleware = (req, res, next) => {
  const useVerb = Math.random() < 0.5; // 50/50 split
  
  if (useVerb) {
    req.headers.set('x-framework', 'verb');
    return next();
  } else {
    // Proxy to legacy system
    return proxy.web(req, res, { 
      target: 'http://localhost:3000' 
    });
  }
};

verbApp.use(abTestMiddleware);
```

### Performance Monitoring
Track metrics during migration.

```typescript
// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    metrics.record('response_time', duration, {
      endpoint: req.path,
      framework: 'verb',
      status: res.statusCode
    });
  });
  
  return next();
};

verbApp.use(performanceMiddleware);
```

## Risk Mitigation

### Rollback Strategy
Quick rollback plan for each phase.

```bash
#!/bin/bash
# rollback.sh

case $1 in
  "phase1")
    # Stop Verb service, traffic stays on legacy
    systemctl stop verb-app
    ;;
  "phase2") 
    # Redirect v2 traffic to legacy endpoints
    nginx -s reload -c nginx.legacy.conf
    ;;
  "phase3")
    # Database rollback and service restart
    ./restore-db-backup.sh
    systemctl restart legacy-app
    ;;
  "phase4")
    # Full rollback to legacy system
    docker-compose up -f docker-compose.legacy.yml
    ;;
esac
```

### Health Checks
Monitor system health during migration.

```typescript
// Health check endpoint
verbApp.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: database.isConnected(),
    cache: cache.isConnected()
  };
  
  return res.json(health);
});

// Detailed health check
verbApp.get('/health/detailed', async (req, res) => {
  const checks = await Promise.allSettled([
    database.ping(),
    cache.ping(),
    externalAPI.ping()
  ]);
  
  const health = {
    overall: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'degraded',
    services: {
      database: checks[0].status,
      cache: checks[1].status,
      external_api: checks[2].status
    }
  };
  
  return res.json(health);
});
```

## Team Preparation

### Training Schedule
```
Week 1: Verb fundamentals and syntax
Week 2: Migration patterns and best practices  
Week 3: Testing and monitoring setup
Week 4: Hands-on migration workshop
```

### Development Guidelines
```typescript
// Code review checklist for Verb migration
const migrationChecklist = {
  syntax: [
    'All route handlers return responses',
    'Async operations use await',
    'Headers accessed via .get()/.set()',
    'Request body parsed with await req.json()'
  ],
  performance: [
    'No blocking operations in handlers',
    'Database queries optimized',
    'Caching implemented where appropriate',
    'Error handling does not use try/catch in routes'
  ],
  testing: [
    'Unit tests updated for new syntax',
    'Integration tests cover new endpoints',
    'Performance benchmarks recorded',
    'Rollback procedures tested'
  ]
};
```

## Success Metrics

### Performance Metrics
- Response time improvement: Target 10-25% reduction
- Throughput increase: Target 15-30% improvement  
- Memory usage: Target 15-20% reduction
- Error rate: Maintain <0.1%

### Development Metrics
- Code reduction: Target 20-30% less boilerplate
- Development velocity: Target 25% faster feature delivery
- Bug reduction: Target 40% fewer runtime errors (TypeScript)
- Deployment size: Target 30-50% smaller bundles

### Monitoring Dashboard
```typescript
// Migration progress dashboard
const migrationMetrics = {
  endpoints: {
    total: 150,
    migrated: 75,
    percentage: 50
  },
  performance: {
    avgResponseTime: '245ms → 198ms',
    throughput: '15,000 → 19,500 req/min',
    memoryUsage: '512MB → 420MB'
  },
  quality: {
    errorRate: '0.15% → 0.08%',
    testCoverage: '78% → 85%',
    typeScriptCoverage: '45% → 98%'
  }
};
```

This progressive approach minimizes risk while maximizing the benefits of migrating to Verb.