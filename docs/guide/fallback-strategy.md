# Fallback Strategy: Node.js Compatibility

Comprehensive fallback strategies for teams adopting Bun, including Node.js compatibility layers and migration rollback procedures.

## Strategy Overview

While Bun is production-ready, having fallback options ensures smooth adoption and risk mitigation. This guide covers:

1. **Compatibility Layers**: Running Node.js code in Bun environments
2. **Rollback Procedures**: Reverting to Node.js if needed
3. **Hybrid Architectures**: Running both runtimes simultaneously
4. **Migration Safety Nets**: Ensuring zero-downtime transitions

## Compatibility Layer Implementation

### Node.js Module Compatibility

```typescript
// compatibility.ts - Node.js compatibility layer for Bun
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

// Enable Node.js-style require() in Bun
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export for legacy modules
global.require = require;
global.__filename = __filename;
global.__dirname = __dirname;

// Buffer compatibility (Bun has native Buffer)
if (!global.Buffer) {
  global.Buffer = Buffer;
}

// Process compatibility
if (!global.process) {
  global.process = process;
}
```

### Express Middleware Compatibility

```typescript
// middleware-bridge.ts - Ensure Express middleware works in Verb
import { server } from "verb";
import type { Request, Response, NextFunction } from "express";

const app = server.http();

// Compatibility wrapper for Express middleware
const wrapExpressMiddleware = (middleware: Function) => {
  return (req: any, res: any, next: any) => {
    // Ensure req/res objects match Express interface
    req.app = app;
    res.app = app;
    
    // Add missing Express methods if needed
    if (!res.locals) res.locals = {};
    if (!req.route) req.route = undefined;
    
    return middleware(req, res, next);
  };
};

// Usage example
import expressRateLimit from "express-rate-limit";
const limiter = expressRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(wrapExpressMiddleware(limiter));
```

### Database Driver Compatibility

```typescript
// db-compatibility.ts - Database connection fallbacks
import { Database as BunSQLite } from "bun:sqlite";

class DatabaseAdapter {
  private db: any;
  private runtime: "bun" | "node";

  constructor(connectionString: string) {
    this.runtime = typeof Bun !== "undefined" ? "bun" : "node";
    
    if (this.runtime === "bun") {
      // Use Bun's native SQLite driver
      this.db = new BunSQLite(connectionString);
    } else {
      // Fallback to Node.js sqlite3
      const sqlite3 = require("sqlite3");
      this.db = new sqlite3.Database(connectionString);
    }
  }

  query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.runtime === "bun") {
      return Promise.resolve(this.db.query(sql).all(...params));
    } else {
      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err: any, rows: any) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    }
  }

  close(): Promise<void> {
    if (this.runtime === "bun") {
      this.db.close();
      return Promise.resolve();
    } else {
      return new Promise((resolve) => {
        this.db.close(resolve);
      });
    }
  }
}

export { DatabaseAdapter };
```

## Deployment Fallback Strategy

### Container-Based Fallback

```docker
# Dockerfile.fallback - Multi-runtime container
FROM oven/bun:latest as bun-runtime
WORKDIR /app
COPY . .
RUN bun install

FROM node:20-alpine as node-runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Runtime selection stage
FROM ${RUNTIME:-bun-runtime} as final
EXPOSE 3000

# Smart startup script
COPY start.sh .
RUN chmod +x start.sh
CMD ["./start.sh"]
```

```bash
#!/bin/bash
# start.sh - Runtime detection and fallback

# Check if Bun is available and working
if command -v bun &> /dev/null; then
    echo "Starting with Bun runtime..."
    exec bun run server.ts
else
    echo "Bun not available, falling back to Node.js..."
    exec node server.js
fi
```

### Kubernetes Deployment with Fallback

```yaml
# k8s-deployment.yaml - Deployment with runtime fallback
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
        image: myapp:latest
        env:
        - name: RUNTIME
          value: "bun-runtime"  # Change to "node-runtime" for fallback
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Blue-Green Deployment Strategy

```typescript
// deployment-controller.ts - Blue-green deployment with runtime switching
class DeploymentController {
  private bunDeployment: string = "verb-app-bun";
  private nodeDeployment: string = "verb-app-node";
  private activeRuntime: "bun" | "node" = "bun";

  async switchRuntime(targetRuntime: "bun" | "node") {
    const targetDeployment = targetRuntime === "bun" 
      ? this.bunDeployment 
      : this.nodeDeployment;
    
    try {
      // Scale up target deployment
      await this.scaleDeployment(targetDeployment, 3);
      
      // Wait for readiness
      await this.waitForReadiness(targetDeployment);
      
      // Switch traffic
      await this.updateService(targetDeployment);
      
      // Scale down old deployment
      const oldDeployment = targetRuntime === "bun" 
        ? this.nodeDeployment 
        : this.bunDeployment;
      await this.scaleDeployment(oldDeployment, 0);
      
      this.activeRuntime = targetRuntime;
      console.log(`Successfully switched to ${targetRuntime} runtime`);
      
    } catch (error) {
      console.error(`Runtime switch failed: ${error.message}`);
      // Rollback logic here
      throw error;
    }
  }

  async emergencyFallback() {
    console.log("Emergency fallback to Node.js initiated");
    await this.switchRuntime("node");
  }
}
```

## CI/CD Pipeline Fallback

### GitHub Actions with Runtime Matrix

```yaml
# .github/workflows/test-and-deploy.yml
name: Test and Deploy
on: [push, pull_request]

jobs:
  test-matrix:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        runtime: [bun, node]
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Bun
      if: matrix.runtime == 'bun'
      uses: oven-sh/setup-bun@v1
    
    - name: Setup Node.js
      if: matrix.runtime == 'node'
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies (Bun)
      if: matrix.runtime == 'bun'
      run: bun install
    
    - name: Install dependencies (Node)
      if: matrix.runtime == 'node'
      run: npm ci
    
    - name: Run tests (Bun)
      if: matrix.runtime == 'bun'
      run: bun test
    
    - name: Run tests (Node)
      if: matrix.runtime == 'node'
      run: npm test
    
    - name: Build (Bun)
      if: matrix.runtime == 'bun'
      run: bun run build
    
    - name: Build (Node)
      if: matrix.runtime == 'node'
      run: npm run build

  deploy:
    needs: test-matrix
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - name: Deploy with Bun
      run: |
        # Try Bun deployment first
        if ! ./deploy.sh bun; then
          echo "Bun deployment failed, falling back to Node.js"
          ./deploy.sh node
        fi
```

### Automated Rollback Script

```bash
#!/bin/bash
# rollback.sh - Automated rollback to Node.js

set -e

NAMESPACE=${1:-default}
APP_NAME=${2:-verb-app}

echo "Starting emergency rollback to Node.js runtime..."

# Check current deployment health
CURRENT_READY=$(kubectl get deployment $APP_NAME-bun -n $NAMESPACE -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
CURRENT_DESIRED=$(kubectl get deployment $APP_NAME-bun -n $NAMESPACE -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

if [ "$CURRENT_READY" -lt "$CURRENT_DESIRED" ]; then
    echo "Bun deployment unhealthy, initiating rollback..."
    
    # Scale up Node.js deployment
    kubectl scale deployment $APP_NAME-node --replicas=3 -n $NAMESPACE
    
    # Wait for Node.js pods to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/$APP_NAME-node -n $NAMESPACE
    
    # Switch service to Node.js deployment
    kubectl patch service $APP_NAME -n $NAMESPACE -p '{"spec":{"selector":{"runtime":"node"}}}'
    
    # Scale down Bun deployment
    kubectl scale deployment $APP_NAME-bun --replicas=0 -n $NAMESPACE
    
    echo "Rollback completed successfully"
else
    echo "Bun deployment is healthy, no rollback needed"
fi
```

## Package Compatibility Fallbacks

### NPM Package Fallback System

```typescript
// package-fallback.ts - Automatic package fallback system
class PackageFallback {
  private static packageMappings: Record<string, string> = {
    "sharp": "@bun/sharp",
    "node-sass": "sass",
    "puppeteer": "playwright",
    "sqlite3": "bun:sqlite"
  };

  static async importWithFallback(packageName: string) {
    try {
      // Try Bun-optimized version first
      const bunPackage = this.packageMappings[packageName];
      if (bunPackage && typeof Bun !== "undefined") {
        return await import(bunPackage);
      }
      
      // Fall back to original package
      return await import(packageName);
    } catch (error) {
      console.warn(`Failed to import ${packageName}, trying fallback...`);
      
      // Try alternative implementations
      const alternatives = this.getAlternatives(packageName);
      for (const alt of alternatives) {
        try {
          return await import(alt);
        } catch (altError) {
          console.warn(`Alternative ${alt} also failed`);
        }
      }
      
      throw new Error(`No compatible package found for ${packageName}`);
    }
  }

  private static getAlternatives(packageName: string): string[] {
    const alternatives: Record<string, string[]> = {
      "sharp": ["@squoosh/lib", "jimp"],
      "puppeteer": ["playwright", "chromium"],
      "node-sass": ["sass", "stylus"]
    };
    
    return alternatives[packageName] || [];
  }
}

// Usage example
const sharp = await PackageFallback.importWithFallback("sharp");
```

### Runtime Feature Detection

```typescript
// feature-detection.ts - Runtime capability detection
class RuntimeDetector {
  static isBun(): boolean {
    return typeof Bun !== "undefined";
  }

  static isNode(): boolean {
    return typeof process !== "undefined" && process.versions?.node !== undefined;
  }

  static supportsNativeModules(): boolean {
    if (this.isBun()) {
      return Bun.version >= "1.0.0"; // Adjust based on actual support
    }
    return this.isNode();
  }

  static async getOptimalImplementation<T>(implementations: {
    bun?: () => Promise<T>;
    node?: () => Promise<T>;
    fallback: () => Promise<T>;
  }): Promise<T> {
    try {
      if (this.isBun() && implementations.bun) {
        return await implementations.bun();
      }
      
      if (this.isNode() && implementations.node) {
        return await implementations.node();
      }
      
      return await implementations.fallback();
    } catch (error) {
      console.warn("Optimal implementation failed, using fallback");
      return await implementations.fallback();
    }
  }
}

// Usage example
const database = await RuntimeDetector.getOptimalImplementation({
  bun: async () => new (await import("bun:sqlite")).Database("app.db"),
  node: async () => new (await import("sqlite3")).Database("app.db"),
  fallback: async () => new (await import("better-sqlite3"))("app.db")
});
```

## Monitoring and Alerting for Fallbacks

### Health Check Implementation

```typescript
// health-check.ts - Runtime-aware health checks
import { server } from "verb";

const app = server.http();

app.get("/health", (req, res) => {
  const health = {
    status: "ok",
    runtime: typeof Bun !== "undefined" ? "bun" : "node",
    version: typeof Bun !== "undefined" ? Bun.version : process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };

  res.json(health);
});

app.get("/ready", async (req, res) => {
  try {
    // Test critical dependencies
    await testDatabaseConnection();
    await testExternalServices();
    
    res.json({ 
      status: "ready", 
      runtime: typeof Bun !== "undefined" ? "bun" : "node"
    });
  } catch (error) {
    res.status(503).json({ 
      status: "not ready", 
      error: error.message,
      runtime: typeof Bun !== "undefined" ? "bun" : "node"
    });
  }
});
```

### Alerting Configuration

```yaml
# alerting-rules.yml - Prometheus alerting for runtime issues
groups:
- name: runtime-fallback
  rules:
  - alert: BunRuntimeDown
    expr: up{job="verb-app",runtime="bun"} == 0
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Bun runtime deployment is down"
      description: "Consider failing over to Node.js runtime"

  - alert: HighErrorRateOnBun
    expr: rate(http_requests_total{job="verb-app",runtime="bun",code=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate on Bun runtime"
      description: "Automatic fallback to Node.js may be required"
```

## Emergency Procedures

### Incident Response Playbook

```markdown
# Emergency Fallback Procedure

## Severity Levels

### P0 - Critical (Immediate Fallback)
- Complete service outage
- Data corruption risk
- Security breach

**Actions:**
1. Execute `./emergency-fallback.sh`
2. Notify incident commander
3. Monitor Node.js deployment
4. Begin root cause analysis

### P1 - High (Planned Fallback)
- High error rates (>5%)
- Performance degradation (>50% slower)
- Memory leaks

**Actions:**
1. Schedule maintenance window
2. Execute `./planned-fallback.sh`
3. Validate service health
4. Update monitoring dashboards

### P2 - Medium (Investigation)
- Intermittent issues
- Package compatibility problems
- Minor performance degradation

**Actions:**
1. Enable debug logging
2. Collect performance metrics
3. Test in staging environment
4. Plan potential fallback
```

### Emergency Contact Automation

```typescript
// emergency-automation.ts - Automated incident response
class EmergencyAutomation {
  private static thresholds = {
    errorRate: 0.05,      // 5% error rate
    responseTime: 1000,   // 1 second
    memoryUsage: 0.9      // 90% memory usage
  };

  static async checkHealth(): Promise<boolean> {
    const metrics = await this.gatherMetrics();
    
    if (metrics.errorRate > this.thresholds.errorRate) {
      await this.triggerFallback("High error rate detected");
      return false;
    }
    
    if (metrics.avgResponseTime > this.thresholds.responseTime) {
      await this.triggerFallback("High response time detected");
      return false;
    }
    
    if (metrics.memoryUsage > this.thresholds.memoryUsage) {
      await this.triggerFallback("High memory usage detected");
      return false;
    }
    
    return true;
  }

  private static async triggerFallback(reason: string) {
    console.error(`Emergency fallback triggered: ${reason}`);
    
    // Execute fallback script
    await this.executeScript("./emergency-fallback.sh");
    
    // Notify team
    await this.sendAlert({
      level: "critical",
      message: `Automatic fallback to Node.js: ${reason}`,
      timestamp: new Date().toISOString()
    });
  }
}
```

## Testing Fallback Scenarios

### Automated Fallback Testing

```typescript
// fallback-tests.ts - Comprehensive fallback testing
describe("Fallback Scenarios", () => {
  test("should fallback to Node.js when Bun fails", async () => {
    // Simulate Bun failure
    const originalBun = global.Bun;
    delete global.Bun;
    
    const app = await createAppWithFallback();
    expect(app.runtime).toBe("node");
    
    // Restore Bun
    global.Bun = originalBun;
  });

  test("should maintain API compatibility across runtimes", async () => {
    const bunResponse = await testWithBun();
    const nodeResponse = await testWithNode();
    
    expect(bunResponse).toEqual(nodeResponse);
  });

  test("should preserve data integrity during runtime switch", async () => {
    const initialData = await seedTestData();
    await switchRuntime("node");
    const finalData = await verifyTestData();
    
    expect(finalData).toEqual(initialData);
  });
});
```

## Documentation and Training

### Team Training Checklist

- [ ] Runtime detection and debugging
- [ ] Emergency fallback procedures  
- [ ] Package compatibility troubleshooting
- [ ] Monitoring and alerting setup
- [ ] Incident response protocols

### Runbook Template

```markdown
# Verb Runtime Fallback Runbook

## Quick Reference
- Emergency fallback: `./emergency-fallback.sh`
- Health check: `curl /health`
- Switch runtime: `kubectl patch service verb-app -p '{"spec":{"selector":{"runtime":"node"}}}'`

## Decision Tree
1. Is the service responding? → No: Execute emergency fallback
2. Are error rates > 5%? → Yes: Plan fallback
3. Is performance degraded > 50%? → Yes: Investigate and prepare fallback
4. Are there package compatibility issues? → Yes: Use compatibility layer

## Contact Information
- On-call engineer: [phone]
- Platform team: [slack channel]
- Escalation: [manager phone]
```

This comprehensive fallback strategy ensures teams can adopt Bun with confidence, knowing they have robust safety nets and can seamlessly return to Node.js if needed.