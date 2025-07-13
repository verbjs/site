# Health Check Endpoints

Implement robust health check endpoints for monitoring, load balancing, and deployment verification.

## Overview

Health checks are essential for:
- **Load balancer** routing decisions
- **Container orchestration** (Docker, Kubernetes)
- **Monitoring systems** alerting
- **Deployment verification** (blue/green, rolling updates)
- **Circuit breaker** patterns

## Basic Health Check

### Simple Health Endpoint

```typescript
// src/routes/health.ts
import { VerbRequest, VerbResponse } from 'verb';

export const basicHealthCheck = async (req: VerbRequest, res: VerbResponse) => {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
};

// In your server
app.get('/health', basicHealthCheck);
```

### Advanced Health Check

```typescript
// src/utils/healthCheck.ts
interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  timeout?: number;
  critical?: boolean;
}

interface HealthCheckResult {
  status: 'ok' | 'error' | 'degraded';
  message?: string;
  data?: any;
  latency?: number;
}

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, HealthCheckResult>;
  summary: {
    total: number;
    passing: number;
    failing: number;
    degraded: number;
  };
}

export class HealthChecker {
  private checks: HealthCheck[] = [];

  addCheck(check: HealthCheck) {
    this.checks.push(check);
  }

  async runChecks(): Promise<HealthStatus> {
    const startTime = Date.now();
    const results: Record<string, HealthCheckResult> = {};
    
    // Run all checks in parallel
    const checkPromises = this.checks.map(async (check) => {
      const checkStart = Date.now();
      
      try {
        const timeout = check.timeout || 5000;
        const result = await Promise.race([
          check.check(),
          this.createTimeoutPromise(timeout)
        ]);
        
        result.latency = Date.now() - checkStart;
        results[check.name] = result;
      } catch (error) {
        results[check.name] = {
          status: 'error',
          message: (error as Error).message,
          latency: Date.now() - checkStart,
        };
      }
    });

    await Promise.allSettled(checkPromises);

    // Calculate summary
    const total = this.checks.length;
    const passing = Object.values(results).filter(r => r.status === 'ok').length;
    const failing = Object.values(results).filter(r => r.status === 'error').length;
    const degraded = Object.values(results).filter(r => r.status === 'degraded').length;

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    // Check for critical failures
    const criticalChecks = this.checks.filter(c => c.critical);
    const criticalFailures = criticalChecks.filter(c => 
      results[c.name]?.status === 'error'
    );
    
    if (criticalFailures.length > 0 || failing > 0) {
      overallStatus = 'unhealthy';
    } else if (degraded > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: results,
      summary: { total, passing, failing, degraded },
    };
  }

  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
    });
  }
}

export const healthChecker = new HealthChecker();
```

## Database Health Checks

### PostgreSQL Health Check

```typescript
// src/health/database.ts
import { healthChecker } from '../utils/healthCheck';

// Add PostgreSQL health check
healthChecker.addCheck({
  name: 'database',
  critical: true,
  timeout: 3000,
  check: async () => {
    try {
      const start = Date.now();
      
      // Simple query to check connection
      const result = await db.raw('SELECT 1 as health_check');
      
      if (result.rows?.[0]?.health_check === 1) {
        return {
          status: 'ok',
          message: 'Database connection healthy',
          data: {
            responseTime: Date.now() - start,
            connectionPool: {
              total: db.pool.totalCount,
              active: db.pool.activeCount,
              idle: db.pool.idleCount,
            },
          },
        };
      } else {
        return {
          status: 'error',
          message: 'Database query returned unexpected result',
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Database connection failed: ${(error as Error).message}`,
      };
    }
  },
});
```

### SQLite Health Check

```typescript
// SQLite health check
healthChecker.addCheck({
  name: 'sqlite',
  critical: true,
  check: async () => {
    try {
      const db = new Database(process.env.DATABASE_PATH || './app.db');
      const result = db.query('SELECT 1 as health').get();
      db.close();
      
      return {
        status: 'ok',
        message: 'SQLite database accessible',
        data: { result },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `SQLite error: ${(error as Error).message}`,
      };
    }
  },
});
```

## External Service Health Checks

### Redis Health Check

```typescript
// src/health/redis.ts
healthChecker.addCheck({
  name: 'redis',
  critical: false, // Non-critical - app can work without cache
  timeout: 2000,
  check: async () => {
    try {
      const start = Date.now();
      
      // Test Redis connection with ping
      const pong = await redis.ping();
      
      if (pong === 'PONG') {
        const info = await redis.info('memory');
        const memoryUsage = info.split('\n')
          .find(line => line.startsWith('used_memory_human:'))
          ?.split(':')[1]?.trim();

        return {
          status: 'ok',
          message: 'Redis connection healthy',
          data: {
            responseTime: Date.now() - start,
            memoryUsage,
          },
        };
      } else {
        return {
          status: 'error',
          message: 'Redis ping failed',
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: `Redis connection failed: ${(error as Error).message}`,
      };
    }
  },
});
```

### External API Health Check

```typescript
// src/health/externalApi.ts
healthChecker.addCheck({
  name: 'payment_service',
  critical: true,
  timeout: 5000,
  check: async () => {
    try {
      const start = Date.now();
      
      const response = await fetch(`${process.env.PAYMENT_API_URL}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.PAYMENT_API_KEY}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      
      const responseTime = Date.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'ok',
          message: 'Payment service healthy',
          data: {
            responseTime,
            apiVersion: data.version,
          },
        };
      } else {
        return {
          status: 'error',
          message: `Payment service returned ${response.status}`,
          data: { responseTime },
        };
      }
    } catch (error) {
      if (error.name === 'TimeoutError') {
        return {
          status: 'error',
          message: 'Payment service timeout',
        };
      }
      
      return {
        status: 'error',
        message: `Payment service error: ${(error as Error).message}`,
      };
    }
  },
});
```

## System Resource Health Checks

### Memory Health Check

```typescript
// src/health/system.ts
healthChecker.addCheck({
  name: 'memory',
  critical: false,
  check: async () => {
    const usage = process.memoryUsage();
    const totalMemory = 512 * 1024 * 1024; // 512MB limit example
    const memoryUsagePercent = (usage.heapUsed / totalMemory) * 100;
    
    if (memoryUsagePercent > 90) {
      return {
        status: 'error',
        message: 'High memory usage',
        data: { memoryUsagePercent, usage },
      };
    } else if (memoryUsagePercent > 75) {
      return {
        status: 'degraded',
        message: 'Elevated memory usage',
        data: { memoryUsagePercent, usage },
      };
    }
    
    return {
      status: 'ok',
      message: 'Memory usage normal',
      data: { memoryUsagePercent, usage },
    };
  },
});
```

### Disk Space Health Check

```typescript
// Disk space check (requires additional package or native module)
import { statSync } from 'fs';

healthChecker.addCheck({
  name: 'disk_space',
  critical: false,
  check: async () => {
    try {
      // This is a simplified example - you might want to use a library like 'node-disk-info'
      const stats = statSync('./');
      
      // Mock calculation - replace with actual disk space check
      const freeSpace = 1024 * 1024 * 1024; // 1GB free (mock)
      const totalSpace = 10 * 1024 * 1024 * 1024; // 10GB total (mock)
      const usagePercent = ((totalSpace - freeSpace) / totalSpace) * 100;
      
      if (usagePercent > 95) {
        return {
          status: 'error',
          message: 'Disk space critically low',
          data: { usagePercent, freeSpace, totalSpace },
        };
      } else if (usagePercent > 85) {
        return {
          status: 'degraded',
          message: 'Disk space running low',
          data: { usagePercent, freeSpace, totalSpace },
        };
      }
      
      return {
        status: 'ok',
        message: 'Disk space sufficient',
        data: { usagePercent, freeSpace, totalSpace },
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Disk check failed: ${(error as Error).message}`,
      };
    }
  },
});
```

## Health Check Routes

### Complete Health Check Implementation

```typescript
// src/routes/health.ts
import { healthChecker } from '../utils/healthCheck';
import { gracefulShutdown } from '../utils/graceful-shutdown';

// Liveness probe - basic check that app is running
export const livenessCheck = async (req: VerbRequest, res: VerbResponse) => {
  if (gracefulShutdown.shuttingDown) {
    return res.status(503).json({
      status: 'shutting_down',
      message: 'Application is shutting down',
    });
  }
  
  return res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

// Readiness probe - detailed check of dependencies
export const readinessCheck = async (req: VerbRequest, res: VerbResponse) => {
  if (gracefulShutdown.shuttingDown) {
    return res.status(503).json({
      status: 'not_ready',
      message: 'Application is shutting down',
    });
  }
  
  const health = await healthChecker.runChecks();
  
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  
  return res.status(statusCode).json(health);
};

// Startup probe - check if app has finished initializing
export const startupCheck = async (req: VerbRequest, res: VerbResponse) => {
  // Check if app initialization is complete
  const isInitialized = await checkAppInitialization();
  
  if (!isInitialized) {
    return res.status(503).json({
      status: 'starting',
      message: 'Application is still initializing',
    });
  }
  
  return res.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
  });
};

async function checkAppInitialization(): Promise<boolean> {
  // Check database migrations, cache warmup, etc.
  try {
    // Example checks:
    // - Database migrations completed
    // - Required configuration loaded
    // - External service connections established
    return true;
  } catch {
    return false;
  }
}

// Register routes
export function setupHealthRoutes(app: any) {
  app.get('/health', readinessCheck);           // Comprehensive health check
  app.get('/health/live', livenessCheck);       // Kubernetes liveness probe
  app.get('/health/ready', readinessCheck);     // Kubernetes readiness probe
  app.get('/health/startup', startupCheck);     // Kubernetes startup probe
}
```

## Kubernetes Health Check Configuration

### Pod Health Check Probes

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
        
        # Startup probe - prevents other probes from running until app is ready
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 30  # 30 * 5s = 150s max startup time
          successThreshold: 1
        
        # Liveness probe - restarts container if this fails
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1
        
        # Readiness probe - removes from service if this fails
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1
```

## Docker Health Check

### Dockerfile Health Check

```dockerfile
# Dockerfile
FROM oven/bun:1-slim

WORKDIR /app
COPY . .
RUN bun install --production

EXPOSE 3000

# Simple health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun --eval "fetch('http://localhost:3000/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["bun", "src/server.ts"]
```

### Docker Compose Health Check

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "bun", "--eval", "fetch('http://localhost:3000/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    depends_on:
      db:
        condition: service_healthy
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d myapp"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Load Balancer Configuration

### HAProxy Health Check

```
# haproxy.cfg
backend verb_app
    balance roundrobin
    option httpchk GET /health/ready
    http-check expect status 200
    
    server app1 10.0.1.10:3000 check inter 5s fall 3 rise 2
    server app2 10.0.1.11:3000 check inter 5s fall 3 rise 2
    server app3 10.0.1.12:3000 check inter 5s fall 3 rise 2
```

### Nginx Health Check

```nginx
# nginx.conf
upstream verb_app {
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    
    location /health {
        access_log off;
        proxy_pass http://verb_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 3s;
        proxy_read_timeout 3s;
    }
    
    location / {
        proxy_pass http://verb_app;
        # ... other proxy settings
    }
}
```

## Monitoring Integration

### Prometheus Metrics

```typescript
// src/utils/metrics.ts
export const healthMetrics = {
  healthCheckDuration: new Map<string, number>(),
  healthCheckFailures: new Map<string, number>(),
  
  recordHealthCheck(name: string, duration: number, success: boolean) {
    this.healthCheckDuration.set(name, duration);
    
    if (!success) {
      const failures = this.healthCheckFailures.get(name) || 0;
      this.healthCheckFailures.set(name, failures + 1);
    }
  },
  
  getMetrics() {
    return {
      health_check_duration: Array.from(this.healthCheckDuration.entries()),
      health_check_failures: Array.from(this.healthCheckFailures.entries()),
    };
  },
};
```

## Best Practices

1. **Separate liveness and readiness checks**
2. **Use timeouts for external dependencies**
3. **Mark critical vs non-critical checks**
4. **Include response time metrics**
5. **Test health checks in CI/CD**
6. **Monitor health check performance**
7. **Use appropriate HTTP status codes**
8. **Include version information**
9. **Handle shutdown gracefully**
10. **Document health check endpoints**

## Next Steps

- [Graceful Shutdown](./graceful-shutdown.md)
- [Production Configuration](./production-config.md)
- [Cloud Platform Deployment](./cloud-platforms.md)