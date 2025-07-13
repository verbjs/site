# Monitoring and Observability Patterns

Comprehensive monitoring and observability strategies for Verb framework applications.

## Metrics Collection

### Application Metrics

```typescript
import { performance } from 'perf_hooks';

class MetricsCollector {
  private metrics = new Map<string, any>();
  private timers = new Map<string, number>();
  
  // Counter metrics
  increment(metric: string, value = 1, tags?: Record<string, string>) {
    const key = this.buildKey(metric, tags);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + value);
  }
  
  // Gauge metrics
  gauge(metric: string, value: number, tags?: Record<string, string>) {
    const key = this.buildKey(metric, tags);
    this.metrics.set(key, value);
  }
  
  // Timing metrics
  timing(metric: string, duration: number, tags?: Record<string, string>) {
    const key = this.buildKey(metric, tags);
    const timings = this.metrics.get(key) || [];
    timings.push(duration);
    this.metrics.set(key, timings);
  }
  
  // Histogram metrics
  histogram(metric: string, value: number, tags?: Record<string, string>) {
    const key = this.buildKey(metric, tags);
    const values = this.metrics.get(key) || [];
    values.push(value);
    this.metrics.set(key, values);
  }
  
  // Timer helpers
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }
  
  endTimer(name: string, tags?: Record<string, string>): number {
    const start = this.timers.get(name);
    if (!start) return 0;
    
    const duration = performance.now() - start;
    this.timing(name, duration, tags);
    this.timers.delete(name);
    return duration;
  }
  
  private buildKey(metric: string, tags?: Record<string, string>): string {
    if (!tags) return metric;
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    
    return `${metric}{${tagString}}`;
  }
  
  // Export metrics in Prometheus format
  toPrometheus(): string {
    const lines: string[] = [];
    
    for (const [key, value] of this.metrics.entries()) {
      const [metric, tagsString] = key.includes('{') ? key.split('{') : [key, ''];
      const tags = tagsString ? tagsString.slice(0, -1) : '';
      
      if (Array.isArray(value)) {
        // Histogram or timing data
        const sorted = value.sort((a, b) => a - b);
        const count = sorted.length;
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        lines.push(`${metric}_count${tags ? `{${tags}}` : ''} ${count}`);
        lines.push(`${metric}_sum${tags ? `{${tags}}` : ''} ${sum}`);
        
        // Percentiles
        if (count > 0) {
          const p50 = sorted[Math.floor(count * 0.5)];
          const p95 = sorted[Math.floor(count * 0.95)];
          const p99 = sorted[Math.floor(count * 0.99)];
          
          lines.push(`${metric}_p50${tags ? `{${tags}}` : ''} ${p50}`);
          lines.push(`${metric}_p95${tags ? `{${tags}}` : ''} ${p95}`);
          lines.push(`${metric}_p99${tags ? `{${tags}}` : ''} ${p99}`);
        }
      } else {
        // Counter or gauge
        lines.push(`${metric}${tags ? `{${tags}}` : ''} ${value}`);
      }
    }
    
    return lines.join('\n');
  }
  
  // Get metrics as JSON
  toJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of this.metrics.entries()) {
      result[key] = Array.isArray(value) ? {
        count: value.length,
        sum: value.reduce((a, b) => a + b, 0),
        avg: value.length > 0 ? value.reduce((a, b) => a + b, 0) / value.length : 0,
        min: Math.min(...value),
        max: Math.max(...value)
      } : value;
    }
    
    return result;
  }
  
  // Reset all metrics
  reset(): void {
    this.metrics.clear();
    this.timers.clear();
  }
}

const metrics = new MetricsCollector();

// Metrics middleware
const metricsMiddleware = (req, res, next) => {
  const startTime = performance.now();
  
  // Track request
  metrics.increment('http_requests_total', 1, {
    method: req.method,
    route: req.route || req.url
  });
  
  res.on('finish', () => {
    const duration = performance.now() - startTime;
    
    // Track response time
    metrics.timing('http_request_duration_ms', duration, {
      method: req.method,
      status: res.statusCode.toString(),
      route: req.route || req.url
    });
    
    // Track status codes
    metrics.increment('http_responses_total', 1, {
      method: req.method,
      status: res.statusCode.toString(),
      route: req.route || req.url
    });
    
    // Track errors
    if (res.statusCode >= 400) {
      metrics.increment('http_errors_total', 1, {
        method: req.method,
        status: res.statusCode.toString(),
        route: req.route || req.url
      });
    }
  });
  
  return next();
};

app.use(metricsMiddleware);
```

### System Metrics

```typescript
import { cpus, freemem, totalmem, loadavg } from 'os';

class SystemMetrics {
  collect() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const systemLoad = loadavg();
    
    // Process metrics
    metrics.gauge('process_memory_rss_bytes', memoryUsage.rss);
    metrics.gauge('process_memory_heap_used_bytes', memoryUsage.heapUsed);
    metrics.gauge('process_memory_heap_total_bytes', memoryUsage.heapTotal);
    metrics.gauge('process_memory_external_bytes', memoryUsage.external);
    
    metrics.gauge('process_cpu_user_seconds_total', cpuUsage.user / 1000000);
    metrics.gauge('process_cpu_system_seconds_total', cpuUsage.system / 1000000);
    
    // System metrics
    metrics.gauge('system_memory_free_bytes', freemem());
    metrics.gauge('system_memory_total_bytes', totalmem());
    metrics.gauge('system_memory_used_bytes', totalmem() - freemem());
    
    metrics.gauge('system_load_1m', systemLoad[0]);
    metrics.gauge('system_load_5m', systemLoad[1]);
    metrics.gauge('system_load_15m', systemLoad[2]);
    
    metrics.gauge('system_cpu_count', cpus().length);
    
    // Event loop lag
    const start = process.hrtime.bigint();
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      metrics.gauge('nodejs_event_loop_lag_ms', lag);
    });
    
    // Uptime
    metrics.gauge('process_uptime_seconds', process.uptime());
  }
  
  startCollection(intervalMs = 5000) {
    this.collect(); // Initial collection
    return setInterval(() => this.collect(), intervalMs);
  }
}

const systemMetrics = new SystemMetrics();
systemMetrics.startCollection();
```

### Protocol-Specific Metrics

```typescript
// WebSocket metrics
let activeWebSocketConnections = 0;
const webSocketMetrics = new Map();

app.websocket('/ws/monitored', {
  open: (ws) => {
    activeWebSocketConnections++;
    metrics.gauge('websocket_connections_active', activeWebSocketConnections);
    metrics.increment('websocket_connections_total');
    
    ws.connectionStart = Date.now();
    ws.messageCount = 0;
    ws.bytesReceived = 0;
    ws.bytesSent = 0;
  },
  
  message: (ws, message) => {
    ws.messageCount++;
    ws.bytesReceived += message.length;
    
    metrics.increment('websocket_messages_received_total');
    metrics.histogram('websocket_message_size_bytes', message.length);
    
    // Echo message (example)
    const response = `Echo: ${message}`;
    ws.send(response);
    ws.bytesSent += response.length;
  },
  
  close: (ws) => {
    activeWebSocketConnections--;
    metrics.gauge('websocket_connections_active', activeWebSocketConnections);
    
    if (ws.connectionStart) {
      const duration = Date.now() - ws.connectionStart;
      metrics.timing('websocket_connection_duration_ms', duration);
    }
    
    metrics.histogram('websocket_messages_per_connection', ws.messageCount || 0);
    metrics.histogram('websocket_bytes_received_per_connection', ws.bytesReceived || 0);
    metrics.histogram('websocket_bytes_sent_per_connection', ws.bytesSent || 0);
  },
  
  error: (ws, error) => {
    metrics.increment('websocket_errors_total', 1, {
      error_type: error.name || 'unknown'
    });
  }
});

// UDP metrics
app.udp(8080, {
  message: (buffer, rinfo) => {
    metrics.increment('udp_packets_received_total');
    metrics.histogram('udp_packet_size_bytes', buffer.length);
    metrics.increment('udp_packets_by_source', 1, {
      source_ip: rinfo.address
    });
    
    // Process message
    const response = Buffer.from(`Echo: ${buffer.toString()}`);
    app.udpSend(response, rinfo.port, rinfo.address);
    
    metrics.increment('udp_packets_sent_total');
    metrics.histogram('udp_response_size_bytes', response.length);
  },
  
  error: (error) => {
    metrics.increment('udp_errors_total', 1, {
      error_type: error.code || 'unknown'
    });
  }
});

// TCP metrics
let activeTCPConnections = 0;

app.tcp(9090, {
  connection: (socket) => {
    activeTCPConnections++;
    metrics.gauge('tcp_connections_active', activeTCPConnections);
    metrics.increment('tcp_connections_total');
    
    let bytesReceived = 0;
    let bytesSent = 0;
    const connectionStart = Date.now();
    
    socket.on('data', (data) => {
      bytesReceived += data.length;
      metrics.increment('tcp_bytes_received_total', data.length);
      
      // Echo data
      socket.write(data);
      bytesSent += data.length;
      metrics.increment('tcp_bytes_sent_total', data.length);
    });
    
    socket.on('close', () => {
      activeTCPConnections--;
      metrics.gauge('tcp_connections_active', activeTCPConnections);
      
      const duration = Date.now() - connectionStart;
      metrics.timing('tcp_connection_duration_ms', duration);
      metrics.histogram('tcp_bytes_received_per_connection', bytesReceived);
      metrics.histogram('tcp_bytes_sent_per_connection', bytesSent);
    });
    
    socket.on('error', (error) => {
      metrics.increment('tcp_errors_total', 1, {
        error_type: error.code || 'unknown'
      });
    });
  }
});
```

## Structured Logging

### Log Levels and Formatting

```typescript
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: Record<string, any>;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  service: string;
  version: string;
  environment: string;
}

class StructuredLogger {
  private minLevel: LogLevel;
  private service: string;
  private version: string;
  private environment: string;
  
  constructor(options: {
    minLevel?: LogLevel;
    service: string;
    version: string;
    environment: string;
  }) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.service = options.service;
    this.version = options.version;
    this.environment = options.environment;
  }
  
  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    if (level > this.minLevel) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      meta,
      service: this.service,
      version: this.version,
      environment: this.environment
    };
    
    // Add trace context if available
    const traceContext = this.getTraceContext();
    if (traceContext) {
      entry.traceId = traceContext.traceId;
      entry.spanId = traceContext.spanId;
    }
    
    // Add user context if available
    const userContext = this.getUserContext();
    if (userContext) {
      entry.userId = userContext.userId;
      entry.requestId = userContext.requestId;
    }
    
    console.log(JSON.stringify(entry));
  }
  
  error(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, meta);
  }
  
  warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, message, meta);
  }
  
  info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, message, meta);
  }
  
  debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, meta);
  }
  
  private getTraceContext(): { traceId: string; spanId: string } | null {
    // Implementation depends on tracing library
    return null; // Placeholder
  }
  
  private getUserContext(): { userId: string; requestId: string } | null {
    // Implementation depends on context storage
    return null; // Placeholder
  }
}

const logger = new StructuredLogger({
  service: 'verb-app',
  version: process.env.APP_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG
});
```

### Request Logging

```typescript
// Request correlation middleware
const correlationMiddleware = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.startTime = Date.now();
  
  // Log request start
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for') || 'unknown',
    requestId: req.requestId
  });
  
  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.requestId,
      contentLength: res.headers.get('content-length')
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        requestId: req.requestId
      });
    }
  });
  
  return next();
};

app.use(correlationMiddleware);
```

### Error Logging

```typescript
// Enhanced error logging
const errorLoggingMiddleware = (error, req, res, next) => {
  const errorId = crypto.randomUUID();
  
  logger.error('Application error', {
    errorId,
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code,
    request: {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries()),
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      requestId: req.requestId
    },
    user: req.user ? { id: req.user.id, role: req.user.role } : null
  });
  
  // Return error ID to client for support purposes
  return res.status(500).json({
    error: 'Internal Server Error',
    errorId,
    timestamp: new Date().toISOString()
  });
};

app.use(errorLoggingMiddleware);
```

## Health Checks

### Comprehensive Health Checks

```typescript
interface HealthCheck {
  name: string;
  check: () => Promise<{ status: 'healthy' | 'unhealthy'; details?: any }>;
  timeout: number;
  critical: boolean;
}

class HealthChecker {
  private checks: HealthCheck[] = [];
  
  addCheck(check: HealthCheck) {
    this.checks.push(check);
  }
  
  async runChecks(): Promise<{
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    checks: Record<string, any>;
  }> {
    const results: Record<string, any> = {};
    let overallHealthy = true;
    
    await Promise.allSettled(
      this.checks.map(async (check) => {
        try {
          const result = await Promise.race([
            check.check(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), check.timeout)
            )
          ]);
          
          results[check.name] = {
            status: result.status,
            details: result.details,
            critical: check.critical
          };
          
          if (check.critical && result.status === 'unhealthy') {
            overallHealthy = false;
          }
        } catch (error) {
          results[check.name] = {
            status: 'unhealthy',
            error: error.message,
            critical: check.critical
          };
          
          if (check.critical) {
            overallHealthy = false;
          }
        }
      })
    );
    
    return {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: results
    };
  }
}

const healthChecker = new HealthChecker();

// Database health check
healthChecker.addCheck({
  name: 'database',
  check: async () => {
    try {
      const result = await pool.query('SELECT 1');
      return {
        status: 'healthy',
        details: { query_time_ms: Date.now() }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  },
  timeout: 5000,
  critical: true
});

// Memory health check
healthChecker.addCheck({
  name: 'memory',
  check: async () => {
    const memUsage = process.memoryUsage();
    const freeMemory = freemem();
    const totalMemory = totalmem();
    
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const systemMemoryPercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    return {
      status: memoryUsagePercent < 90 && systemMemoryPercent < 90 ? 'healthy' : 'unhealthy',
      details: {
        heap_used_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(memUsage.heapTotal / 1024 / 1024),
        heap_usage_percent: Math.round(memoryUsagePercent),
        system_memory_percent: Math.round(systemMemoryPercent)
      }
    };
  },
  timeout: 1000,
  critical: false
});

// External service health check
healthChecker.addCheck({
  name: 'external_api',
  check: async () => {
    try {
      const response = await fetch('https://api.external-service.com/health', {
        method: 'GET',
        timeout: 3000
      });
      
      if (response.ok) {
        return { status: 'healthy' };
      } else {
        return {
          status: 'unhealthy',
          details: { status_code: response.status }
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      };
    }
  },
  timeout: 5000,
  critical: false
});

// Health check endpoints
app.get('/health', async (req, res) => {
  const health = await healthChecker.runChecks();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
});

app.get('/health/live', (req, res) => {
  // Liveness probe - just check if the process is running
  return res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/health/ready', async (req, res) => {
  // Readiness probe - check if the app is ready to serve traffic
  const health = await healthChecker.runChecks();
  const criticalChecks = Object.values(health.checks).filter(check => check.critical);
  const ready = criticalChecks.every(check => check.status === 'healthy');
  
  const statusCode = ready ? 200 : 503;
  return res.status(statusCode).json({
    status: ready ? 'ready' : 'not_ready',
    timestamp: health.timestamp,
    uptime: health.uptime,
    critical_checks: criticalChecks
  });
});
```

## Distributed Tracing

### Basic Tracing Implementation

```typescript
import { randomBytes } from 'crypto';

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; fields: Record<string, any> }>;
}

class Tracer {
  private spans: Map<string, Span> = new Map();
  
  startSpan(operationName: string, parentSpan?: Span): Span {
    const span: Span = {
      traceId: parentSpan?.traceId || randomBytes(8).toString('hex'),
      spanId: randomBytes(8).toString('hex'),
      parentSpanId: parentSpan?.spanId,
      operationName,
      startTime: Date.now(),
      tags: {},
      logs: []
    };
    
    this.spans.set(span.spanId, span);
    return span;
  }
  
  finishSpan(span: Span) {
    span.endTime = Date.now();
    
    // Log span completion
    logger.debug('Span completed', {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      operationName: span.operationName,
      duration: span.endTime - span.startTime,
      tags: span.tags
    });
    
    // In production, send to tracing backend (Jaeger, Zipkin, etc.)
    this.exportSpan(span);
  }
  
  setTag(span: Span, key: string, value: any) {
    span.tags[key] = value;
  }
  
  log(span: Span, fields: Record<string, any>) {
    span.logs.push({
      timestamp: Date.now(),
      fields
    });
  }
  
  private exportSpan(span: Span) {
    // Export to tracing backend
    // Implementation depends on chosen backend
  }
}

const tracer = new Tracer();

// Tracing middleware
const tracingMiddleware = (req, res, next) => {
  const span = tracer.startSpan('http_request');
  
  tracer.setTag(span, 'http.method', req.method);
  tracer.setTag(span, 'http.url', req.url);
  tracer.setTag(span, 'http.user_agent', req.headers.get('user-agent'));
  
  req.span = span;
  req.traceId = span.traceId;
  
  res.on('finish', () => {
    tracer.setTag(span, 'http.status_code', res.statusCode);
    tracer.setTag(span, 'http.response_size', res.headers.get('content-length'));
    
    if (res.statusCode >= 400) {
      tracer.setTag(span, 'error', true);
    }
    
    tracer.finishSpan(span);
  });
  
  return next();
};

app.use(tracingMiddleware);

// Database operation tracing
async function tracedDatabaseQuery(query: string, params: any[], parentSpan: Span) {
  const span = tracer.startSpan('database_query', parentSpan);
  
  tracer.setTag(span, 'db.statement', query);
  tracer.setTag(span, 'db.type', 'postgresql');
  
  try {
    const result = await pool.query(query, params);
    tracer.setTag(span, 'db.rows_affected', result.rowCount);
    return result;
  } catch (error) {
    tracer.setTag(span, 'error', true);
    tracer.log(span, { error: error.message });
    throw error;
  } finally {
    tracer.finishSpan(span);
  }
}
```

## Metrics Endpoints

### Prometheus Metrics Endpoint

```typescript
// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  res.headers.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  
  const prometheusMetrics = metrics.toPrometheus();
  const systemMetricsText = generateSystemMetrics();
  
  return res.text(`${prometheusMetrics}\n${systemMetricsText}`);
});

function generateSystemMetrics(): string {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return `
# HELP process_memory_rss_bytes Resident Set Size memory usage
# TYPE process_memory_rss_bytes gauge
process_memory_rss_bytes ${memUsage.rss}

# HELP process_memory_heap_used_bytes Heap memory usage
# TYPE process_memory_heap_used_bytes gauge
process_memory_heap_used_bytes ${memUsage.heapUsed}

# HELP process_cpu_user_seconds_total CPU user time
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total ${cpuUsage.user / 1000000}

# HELP process_cpu_system_seconds_total CPU system time
# TYPE process_cpu_system_seconds_total counter
process_cpu_system_seconds_total ${cpuUsage.system / 1000000}

# HELP process_uptime_seconds Process uptime
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${process.uptime()}
`.trim();
}

// JSON metrics endpoint
app.get('/metrics/json', (req, res) => {
  return res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    system: {
      loadavg: loadavg(),
      freemem: freemem(),
      totalmem: totalmem()
    },
    application: metrics.toJSON()
  });
});
```

### Application Performance Monitoring

```typescript
// APM integration example
class APMMonitor {
  private performanceEntries: any[] = [];
  
  startMonitoring() {
    // Monitor performance entries
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.performanceEntries.push({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType,
          timestamp: Date.now()
        });
        
        // Log slow operations
        if (entry.duration > 1000) {
          logger.warn('Slow operation detected', {
            name: entry.name,
            duration: entry.duration,
            type: entry.entryType
          });
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure', 'navigation', 'resource'] });
    
    // Monitor event loop utilization
    setInterval(() => {
      const usage = performance.eventLoopUtilization();
      metrics.gauge('nodejs_event_loop_utilization', usage.utilization);
      
      if (usage.utilization > 0.9) {
        logger.warn('High event loop utilization', { utilization: usage.utilization });
      }
    }, 5000);
    
    // Monitor garbage collection
    if (global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const start = process.hrtime.bigint();
        originalGC();
        const duration = Number(process.hrtime.bigint() - start) / 1000000;
        
        metrics.timing('nodejs_gc_duration_ms', duration);
        logger.debug('Garbage collection completed', { duration });
      };
    }
  }
  
  getPerformanceReport() {
    const now = Date.now();
    const recentEntries = this.performanceEntries.filter(
      entry => entry.timestamp > now - 60000 // Last minute
    );
    
    return {
      total_entries: recentEntries.length,
      slow_operations: recentEntries.filter(entry => entry.duration > 1000).length,
      average_duration: recentEntries.reduce((sum, entry) => sum + entry.duration, 0) / recentEntries.length || 0,
      by_type: recentEntries.reduce((acc, entry) => {
        acc[entry.entryType] = (acc[entry.entryType] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

const apmMonitor = new APMMonitor();
apmMonitor.startMonitoring();

// Performance report endpoint
app.get('/metrics/performance', (req, res) => {
  return res.json(apmMonitor.getPerformanceReport());
});
```

This comprehensive monitoring and observability guide provides production-ready patterns for monitoring Verb applications across all protocols with structured logging, distributed tracing, health checks, and performance monitoring.