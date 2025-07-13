# Metrics Collection (Prometheus Format)

Enterprise metrics collection middleware for Verb applications with Prometheus-compatible output, custom metrics, and performance monitoring.

## Core Metrics Middleware

### Prometheus-Compatible Metrics

```typescript
import type { VerbRequest, VerbResponse, Middleware } from 'verb';

// Metric types
interface Counter {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

interface Histogram {
  name: string;
  help: string;
  labels: string[];
  buckets: number[];
  values: Map<string, { count: number; sum: number; buckets: Map<number, number> }>;
}

interface Gauge {
  name: string;
  help: string;
  labels: string[];
  values: Map<string, number>;
}

// Metrics registry
class MetricsRegistry {
  private counters = new Map<string, Counter>();
  private histograms = new Map<string, Histogram>();
  private gauges = new Map<string, Gauge>();
  private startTime = Date.now();

  // Counter methods
  registerCounter(name: string, help: string, labels: string[] = []) {
    this.counters.set(name, {
      name,
      help,
      labels,
      values: new Map()
    });
  }

  incrementCounter(name: string, labels: Record<string, string> = {}) {
    const counter = this.counters.get(name);
    if (!counter) return;

    const labelKey = this.getLabelKey(labels, counter.labels);
    const current = counter.values.get(labelKey) || 0;
    counter.values.set(labelKey, current + 1);
  }

  // Histogram methods
  registerHistogram(name: string, help: string, buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], labels: string[] = []) {
    this.histograms.set(name, {
      name,
      help,
      labels,
      buckets,
      values: new Map()
    });
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}) {
    const histogram = this.histograms.get(name);
    if (!histogram) return;

    const labelKey = this.getLabelKey(labels, histogram.labels);
    const current = histogram.values.get(labelKey) || { count: 0, sum: 0, buckets: new Map() };
    
    current.count++;
    current.sum += value;
    
    // Update buckets
    histogram.buckets.forEach(bucket => {
      if (value <= bucket) {
        const bucketCount = current.buckets.get(bucket) || 0;
        current.buckets.set(bucket, bucketCount + 1);
      }
    });
    
    histogram.values.set(labelKey, current);
  }

  // Gauge methods
  registerGauge(name: string, help: string, labels: string[] = []) {
    this.gauges.set(name, {
      name,
      help,
      labels,
      values: new Map()
    });
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}) {
    const gauge = this.gauges.get(name);
    if (!gauge) return;

    const labelKey = this.getLabelKey(labels, gauge.labels);
    gauge.values.set(labelKey, value);
  }

  incrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}) {
    const gauge = this.gauges.get(name);
    if (!gauge) return;

    const labelKey = this.getLabelKey(labels, gauge.labels);
    const current = gauge.values.get(labelKey) || 0;
    gauge.values.set(labelKey, current + value);
  }

  decrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}) {
    this.incrementGauge(name, -value, labels);
  }

  // Generate Prometheus format output
  generatePrometheusMetrics(): string {
    let output = '';

    // Process counters
    this.counters.forEach(counter => {
      output += `# HELP ${counter.name} ${counter.help}\n`;
      output += `# TYPE ${counter.name} counter\n`;
      counter.values.forEach((value, labels) => {
        const labelStr = labels ? `{${labels}}` : '';
        output += `${counter.name}${labelStr} ${value}\n`;
      });
      output += '\n';
    });

    // Process histograms
    this.histograms.forEach(histogram => {
      output += `# HELP ${histogram.name} ${histogram.help}\n`;
      output += `# TYPE ${histogram.name} histogram\n`;
      
      histogram.values.forEach((value, labels) => {
        const baseLabels = labels ? labels : '';
        
        // Bucket metrics
        histogram.buckets.forEach(bucket => {
          const bucketLabels = baseLabels ? `${baseLabels},le="${bucket}"` : `le="${bucket}"`;
          const bucketCount = value.buckets.get(bucket) || 0;
          output += `${histogram.name}_bucket{${bucketLabels}} ${bucketCount}\n`;
        });
        
        // +Inf bucket
        const infLabels = baseLabels ? `${baseLabels},le="+Inf"` : `le="+Inf"`;
        output += `${histogram.name}_bucket{${infLabels}} ${value.count}\n`;
        
        // Count and sum
        const countLabels = baseLabels ? `{${baseLabels}}` : '';
        output += `${histogram.name}_count${countLabels} ${value.count}\n`;
        output += `${histogram.name}_sum${countLabels} ${value.sum}\n`;
      });
      output += '\n';
    });

    // Process gauges
    this.gauges.forEach(gauge => {
      output += `# HELP ${gauge.name} ${gauge.help}\n`;
      output += `# TYPE ${gauge.name} gauge\n`;
      gauge.values.forEach((value, labels) => {
        const labelStr = labels ? `{${labels}}` : '';
        output += `${gauge.name}${labelStr} ${value}\n`;
      });
      output += '\n';
    });

    // Add process metrics
    const memUsage = process.memoryUsage();
    const uptime = (Date.now() - this.startTime) / 1000;
    
    output += '# HELP process_resident_memory_bytes Resident memory size in bytes\n';
    output += '# TYPE process_resident_memory_bytes gauge\n';
    output += `process_resident_memory_bytes ${memUsage.rss}\n\n`;
    
    output += '# HELP process_heap_bytes Process heap size in bytes\n';
    output += '# TYPE process_heap_bytes gauge\n';
    output += `process_heap_bytes ${memUsage.heapUsed}\n\n`;
    
    output += '# HELP process_uptime_seconds Process uptime in seconds\n';
    output += '# TYPE process_uptime_seconds gauge\n';
    output += `process_uptime_seconds ${uptime}\n\n`;

    return output;
  }

  private getLabelKey(labels: Record<string, string>, allowedLabels: string[]): string {
    if (allowedLabels.length === 0) return '';
    
    const sortedLabels = allowedLabels
      .filter(label => labels[label] !== undefined)
      .sort()
      .map(label => `${label}="${labels[label]}"`)
      .join(',');
    
    return sortedLabels;
  }

  // Reset all metrics (useful for testing)
  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
    this.startTime = Date.now();
  }
}

// Global registry instance
const globalMetrics = new MetricsRegistry();

// Initialize default metrics
globalMetrics.registerCounter('http_requests_total', 'Total number of HTTP requests', ['method', 'status_code', 'endpoint']);
globalMetrics.registerHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], ['method', 'endpoint']);
globalMetrics.registerGauge('http_requests_in_flight', 'Number of HTTP requests currently being processed', []);
globalMetrics.registerCounter('http_request_errors_total', 'Total number of HTTP request errors', ['method', 'status_code', 'error_type']);

export { globalMetrics };
```

## HTTP Metrics Middleware

### Request/Response Tracking

```typescript
export const httpMetrics = (options: {
  includePathLabel?: boolean;
  pathNormalization?: (path: string) => string;
  excludePaths?: string[];
} = {}): Middleware => {
  const {
    includePathLabel = true,
    pathNormalization = (path: string) => {
      // Normalize parameterized paths
      return path
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
        .replace(/\/[a-f0-9]{24}/g, '/:objectid');
    },
    excludePaths = ['/metrics', '/health']
  } = options;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Skip excluded paths
    if (excludePaths.includes(req.url)) {
      return next();
    }

    const startTime = Date.now();
    const endpoint = includePathLabel ? pathNormalization(req.url) : 'all';
    
    // Increment in-flight requests
    globalMetrics.incrementGauge('http_requests_in_flight');

    // Hook into response to capture metrics
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    let statusCode = 200;
    let hasResponded = false;
    
    const recordMetrics = () => {
      if (hasResponded) return;
      hasResponded = true;
      
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      const method = req.method;
      const statusCodeStr = statusCode.toString();
      
      // Record request count
      globalMetrics.incrementCounter('http_requests_total', {
        method,
        status_code: statusCodeStr,
        endpoint
      });
      
      // Record request duration
      globalMetrics.observeHistogram('http_request_duration_seconds', duration, {
        method,
        endpoint
      });
      
      // Record errors
      if (statusCode >= 400) {
        const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
        globalMetrics.incrementCounter('http_request_errors_total', {
          method,
          status_code: statusCodeStr,
          error_type: errorType
        });
      }
      
      // Decrement in-flight requests
      globalMetrics.decrementGauge('http_requests_in_flight');
    };

    // Override status method
    res.status = (code: number) => {
      statusCode = code;
      return originalStatus.call(res, code);
    };

    // Override response methods
    res.send = (data: any) => {
      recordMetrics();
      return originalSend.call(res, data);
    };

    res.json = (data: any) => {
      recordMetrics();
      return originalJson.call(res, data);
    };

    try {
      next();
    } catch (error) {
      statusCode = 500;
      recordMetrics();
      throw error;
    }
  };
};
```

## Custom Business Metrics

### Application-Specific Metrics

```typescript
// Business metrics helpers
export class BusinessMetrics {
  static initializeBusinessMetrics() {
    // User activity metrics
    globalMetrics.registerCounter('user_registrations_total', 'Total number of user registrations', ['source']);
    globalMetrics.registerCounter('user_logins_total', 'Total number of user logins', ['method']);
    globalMetrics.registerGauge('active_users', 'Number of currently active users', []);
    
    // Feature usage metrics
    globalMetrics.registerCounter('feature_usage_total', 'Total feature usage events', ['feature_name', 'user_type']);
    globalMetrics.registerHistogram('api_operation_duration_seconds', 'Duration of API operations', [0.01, 0.05, 0.1, 0.5, 1, 5], ['operation']);
    
    // Business KPIs
    globalMetrics.registerGauge('revenue_daily', 'Daily revenue in cents', []);
    globalMetrics.registerCounter('orders_total', 'Total number of orders', ['status']);
    globalMetrics.registerHistogram('order_value_cents', 'Order value in cents', [100, 500, 1000, 5000, 10000, 50000], []);
    
    // Database metrics
    globalMetrics.registerHistogram('database_query_duration_seconds', 'Database query duration', [0.001, 0.005, 0.01, 0.05, 0.1, 0.5], ['table', 'operation']);
    globalMetrics.registerCounter('database_errors_total', 'Total database errors', ['table', 'error_type']);
    
    // External service metrics
    globalMetrics.registerCounter('external_api_calls_total', 'Total external API calls', ['service', 'endpoint', 'status']);
    globalMetrics.registerHistogram('external_api_duration_seconds', 'External API call duration', [0.1, 0.5, 1, 2, 5, 10], ['service']);
  }

  static recordUserRegistration(source: string) {
    globalMetrics.incrementCounter('user_registrations_total', { source });
  }

  static recordUserLogin(method: string) {
    globalMetrics.incrementCounter('user_logins_total', { method });
  }

  static updateActiveUsers(count: number) {
    globalMetrics.setGauge('active_users', count);
  }

  static recordFeatureUsage(featureName: string, userType: string) {
    globalMetrics.incrementCounter('feature_usage_total', { 
      feature_name: featureName, 
      user_type: userType 
    });
  }

  static recordApiOperation(operation: string, duration: number) {
    globalMetrics.observeHistogram('api_operation_duration_seconds', duration, { operation });
  }

  static recordOrder(status: string, valueInCents: number) {
    globalMetrics.incrementCounter('orders_total', { status });
    if (status === 'completed') {
      globalMetrics.observeHistogram('order_value_cents', valueInCents);
    }
  }

  static recordDatabaseQuery(table: string, operation: string, duration: number) {
    globalMetrics.observeHistogram('database_query_duration_seconds', duration, { table, operation });
  }

  static recordDatabaseError(table: string, errorType: string) {
    globalMetrics.incrementCounter('database_errors_total', { table, error_type: errorType });
  }

  static recordExternalApiCall(service: string, endpoint: string, status: string, duration: number) {
    globalMetrics.incrementCounter('external_api_calls_total', { service, endpoint, status });
    globalMetrics.observeHistogram('external_api_duration_seconds', duration, { service });
  }
}
```

## Metrics Endpoint

### Prometheus-Compatible Endpoint

```typescript
// Metrics endpoint handler
export const createMetricsEndpoint = () => {
  return (req: VerbRequest, res: VerbResponse) => {
    try {
      const metrics = globalMetrics.generatePrometheusMetrics();
      res.headers({ 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
      res.send(metrics);
    } catch (error) {
      console.error('Error generating metrics:', error);
      res.status(500).send('Error generating metrics');
    }
  };
};
```

## Database Metrics Middleware

### Query Performance Tracking

```typescript
// Database monitoring wrapper
export class DatabaseMetrics {
  static wrapDatabaseConnection(db: any) {
    const originalQuery = db.query;
    
    db.query = function(sql: string, params?: any[]) {
      const startTime = Date.now();
      const table = DatabaseMetrics.extractTableName(sql);
      const operation = DatabaseMetrics.extractOperation(sql);
      
      try {
        const result = originalQuery.call(this, sql, params);
        
        // For promise-based queries
        if (result && typeof result.then === 'function') {
          return result
            .then((data: any) => {
              const duration = (Date.now() - startTime) / 1000;
              BusinessMetrics.recordDatabaseQuery(table, operation, duration);
              return data;
            })
            .catch((error: any) => {
              const duration = (Date.now() - startTime) / 1000;
              BusinessMetrics.recordDatabaseQuery(table, operation, duration);
              BusinessMetrics.recordDatabaseError(table, error.code || 'unknown');
              throw error;
            });
        }
        
        // For synchronous queries
        const duration = (Date.now() - startTime) / 1000;
        BusinessMetrics.recordDatabaseQuery(table, operation, duration);
        return result;
        
      } catch (error: any) {
        const duration = (Date.now() - startTime) / 1000;
        BusinessMetrics.recordDatabaseQuery(table, operation, duration);
        BusinessMetrics.recordDatabaseError(table, error.code || 'unknown');
        throw error;
      }
    };
    
    return db;
  }
  
  private static extractTableName(sql: string): string {
    const match = sql.match(/(?:FROM|INTO|UPDATE|DELETE FROM)\s+([\w_]+)/i);
    return match ? match[1] : 'unknown';
  }
  
  private static extractOperation(sql: string): string {
    const operation = sql.trim().split(' ')[0].toUpperCase();
    return ['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(operation) ? operation.toLowerCase() : 'unknown';
  }
}
```

## Real-time Metrics Dashboard

### Live Metrics API

```typescript
// Real-time metrics for dashboard
export const createLiveMetricsEndpoint = () => {
  return (req: VerbRequest, res: VerbResponse) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      http: {
        requestsInFlight: getCurrentGaugeValue('http_requests_in_flight'),
        totalRequests: getCurrentCounterValue('http_requests_total'),
        errorRate: calculateErrorRate(),
        averageResponseTime: calculateAverageResponseTime()
      },
      business: {
        activeUsers: getCurrentGaugeValue('active_users'),
        dailyRevenue: getCurrentGaugeValue('revenue_daily'),
        ordersToday: getTodayCounterValue('orders_total')
      }
    };
    
    res.json(metrics);
  };
};

function getCurrentGaugeValue(metricName: string): number {
  // Implementation to get current gauge value
  const gauge = globalMetrics['gauges'].get(metricName);
  if (!gauge || gauge.values.size === 0) return 0;
  return Array.from(gauge.values.values())[0] || 0;
}

function getCurrentCounterValue(metricName: string): number {
  // Implementation to get current counter value
  const counter = globalMetrics['counters'].get(metricName);
  if (!counter) return 0;
  return Array.from(counter.values.values()).reduce((sum, val) => sum + val, 0);
}

function calculateErrorRate(): number {
  // Calculate error rate from the last minute
  const totalRequests = getCurrentCounterValue('http_requests_total');
  const totalErrors = getCurrentCounterValue('http_request_errors_total');
  return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
}

function calculateAverageResponseTime(): number {
  // Calculate from histogram data
  const histogram = globalMetrics['histograms'].get('http_request_duration_seconds');
  if (!histogram || histogram.values.size === 0) return 0;
  
  let totalSum = 0;
  let totalCount = 0;
  
  histogram.values.forEach(value => {
    totalSum += value.sum;
    totalCount += value.count;
  });
  
  return totalCount > 0 ? (totalSum / totalCount) * 1000 : 0; // Convert to milliseconds
}

function getTodayCounterValue(metricName: string): number {
  // This would require time-series storage for accurate daily counts
  // For now, return current total
  return getCurrentCounterValue(metricName);
}
```

## Usage Examples

### Basic Setup

```typescript
import { createServer } from 'verb';
import { httpMetrics, createMetricsEndpoint, BusinessMetrics } from './middleware/metrics';

const app = createServer();

// Initialize business metrics
BusinessMetrics.initializeBusinessMetrics();

// Add HTTP metrics middleware
app.use(httpMetrics({
  includePathLabel: true,
  excludePaths: ['/metrics', '/health', '/favicon.ico']
}));

// Metrics endpoint
app.get('/metrics', createMetricsEndpoint());

// Business logic with custom metrics
app.post('/api/users/register', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const user = await createUser(req.body);
    
    // Record business metrics
    BusinessMetrics.recordUserRegistration(req.body.source || 'direct');
    BusinessMetrics.recordApiOperation('user_registration', (Date.now() - startTime) / 1000);
    
    res.status(201).json(user);
  } catch (error) {
    // Error will be automatically recorded by HTTP metrics middleware
    res.status(400).json({ error: 'Registration failed' });
  }
});

app.listen(3000);
```

### Advanced Configuration

```typescript
// Production metrics configuration
const productionMetricsConfig = {
  includePathLabel: true,
  pathNormalization: (path: string) => {
    // Custom path normalization for your API structure
    return path
      .replace(/\/api\/v\d+/, '/api/v*')  // Version normalization
      .replace(/\/users\/\d+/, '/users/:id')
      .replace(/\/orders\/[a-f0-9-]+/, '/orders/:id')
      .replace(/\/products\/[\w-]+/, '/products/:slug');
  },
  excludePaths: [
    '/metrics',
    '/health',
    '/favicon.ico',
    '/robots.txt',
    '/_next/static',
    '/__webpack_hmr'
  ]
};

app.use(httpMetrics(productionMetricsConfig));
```

### Integration with Monitoring Systems

```typescript
// Grafana dashboard configuration
const grafanaDashboard = {
  dashboard: {
    title: 'Verb Application Metrics',
    panels: [
      {
        title: 'Request Rate',
        targets: [{
          expr: 'rate(http_requests_total[5m])'
        }]
      },
      {
        title: 'Response Time',
        targets: [{
          expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))'
        }]
      },
      {
        title: 'Error Rate',
        targets: [{
          expr: 'rate(http_request_errors_total[5m]) / rate(http_requests_total[5m])'
        }]
      }
    ]
  }
};

// Alerting rules
const alertingRules = [
  {
    alert: 'HighErrorRate',
    expr: 'rate(http_request_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05',
    for: '5m',
    annotations: {
      summary: 'High error rate detected'
    }
  },
  {
    alert: 'HighResponseTime',
    expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1',
    for: '5m',
    annotations: {
      summary: 'High response time detected'
    }
  }
];
```

## Best Practices

### 1. **Metric Naming**
- Use descriptive names with appropriate units
- Follow Prometheus naming conventions
- Use consistent label names across metrics

### 2. **Performance**
- Limit the number of unique label combinations
- Use histogram buckets appropriate for your data
- Avoid high-cardinality labels

### 3. **Security**
- Secure the metrics endpoint (authentication/IP filtering)
- Don't include sensitive data in metric labels
- Consider separate internal/external metrics endpoints

### 4. **Monitoring**
- Set up alerting on key metrics
- Monitor metric collection performance
- Implement metric retention policies

### 5. **Business Alignment**
- Track metrics that align with business objectives
- Include SLA/SLO relevant metrics
- Provide business-friendly metric dashboards

This comprehensive metrics collection system provides enterprise-grade observability for Verb applications with Prometheus compatibility and custom business metrics tracking.