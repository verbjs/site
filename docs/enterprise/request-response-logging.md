# Request/Response Logging Middleware

Enterprise-grade logging middleware for Verb applications with structured logging, performance tracking, and security monitoring.

## Core Logging Middleware

### Basic Implementation

```typescript
import { middleware } from 'verb';
import type { VerbRequest, VerbResponse, Middleware } from 'verb';

// Structured logging interface
interface LogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: string;
  level: 'info' | 'warn' | 'error';
}

// Enhanced logging middleware
export const requestLogging = (options: {
  includeBody?: boolean;
  includeHeaders?: boolean;
  excludePaths?: string[];
  maxBodySize?: number;
  sensitiveHeaders?: string[];
} = {}): Middleware => {
  const {
    includeBody = false,
    includeHeaders = false,
    excludePaths = ['/health', '/metrics'],
    maxBodySize = 1024,
    sensitiveHeaders = ['authorization', 'cookie', 'x-api-key']
  } = options;

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Skip excluded paths
    if (excludePaths.includes(req.url)) {
      return next();
    }

    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    // Add request ID to request context
    req.requestId = requestId;
    res.header('X-Request-ID', requestId);

    // Extract client information
    const ip = req.ip || req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'];
    
    // Create base log entry
    const baseLog: Partial<LogEntry> = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.url,
      ip: typeof ip === 'string' ? ip : ip[0],
      userAgent,
      level: 'info'
    };

    // Log request details
    const requestLog = { ...baseLog };
    
    if (includeHeaders) {
      const sanitizedHeaders = { ...req.headers };
      sensitiveHeaders.forEach(header => {
        if (sanitizedHeaders[header]) {
          sanitizedHeaders[header] = '[REDACTED]';
        }
      });
      requestLog.headers = sanitizedHeaders;
    }

    if (includeBody && req.method !== 'GET') {
      try {
        const body = await req.text();
        if (body && body.length <= maxBodySize) {
          requestLog.body = body;
        } else if (body.length > maxBodySize) {
          requestLog.body = `[TRUNCATED - ${body.length} bytes]`;
        }
      } catch {
        requestLog.body = '[UNPARSEABLE]';
      }
    }

    console.log(JSON.stringify({ ...requestLog, message: 'Request received' }));

    // Intercept response to log completion
    const originalSend = res.send;
    const originalJson = res.json;
    const originalStatus = res.status;
    
    let statusCode = 200;
    let responseSize = 0;
    
    // Override status method
    res.status = (code: number) => {
      statusCode = code;
      return originalStatus.call(res, code);
    };

    // Override send method
    res.send = (data: any) => {
      responseSize = Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data));
      logResponse();
      return originalSend.call(res, data);
    };

    // Override json method
    res.json = (data: any) => {
      responseSize = Buffer.byteLength(JSON.stringify(data));
      logResponse();
      return originalJson.call(res, data);
    };

    const logResponse = () => {
      const duration = Date.now() - startTime;
      const responseLog: LogEntry = {
        ...baseLog,
        duration,
        statusCode,
        responseSize,
        level: statusCode >= 400 ? (statusCode >= 500 ? 'error' : 'warn') : 'info'
      };

      console.log(JSON.stringify({ 
        ...responseLog, 
        message: `Request completed - ${statusCode} (${duration}ms)` 
      }));
    };

    try {
      next();
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorLog: LogEntry = {
        ...baseLog,
        duration,
        statusCode: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
        level: 'error'
      };

      console.log(JSON.stringify({ 
        ...errorLog, 
        message: 'Request failed with error' 
      }));
      
      throw error;
    }
  };
};
```

## Performance Monitoring

### Response Time Tracking

```typescript
// Performance monitoring middleware
export const performanceLogging = (options: {
  slowRequestThreshold?: number;
  includeMemoryUsage?: boolean;
} = {}): Middleware => {
  const { slowRequestThreshold = 1000, includeMemoryUsage = false } = options;
  
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const startTime = process.hrtime.bigint();
    const startMemory = includeMemoryUsage ? process.memoryUsage() : null;

    const originalSend = res.send;
    const originalJson = res.json;
    
    const logPerformance = () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      const perfLog: any = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
        level: duration > slowRequestThreshold ? 'warn' : 'info'
      };

      if (includeMemoryUsage && startMemory) {
        const endMemory = process.memoryUsage();
        perfLog.memoryDelta = {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal
        };
      }

      if (duration > slowRequestThreshold) {
        console.log(JSON.stringify({ 
          ...perfLog, 
          message: `Slow request detected - ${duration}ms` 
        }));
      }

      // Store performance data for metrics collection
      if (global.verbMetrics) {
        global.verbMetrics.recordRequestDuration(req.method, req.url, duration);
      }
    };

    res.send = (data: any) => {
      logPerformance();
      return originalSend.call(res, data);
    };

    res.json = (data: any) => {
      logPerformance();
      return originalJson.call(res, data);
    };

    next();
  };
};
```

## Security Logging

### Security Event Monitoring

```typescript
// Security logging middleware
export const securityLogging = (): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    const securityEvents: string[] = [];
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\.\//g,  // Path traversal
      /<script/i,  // XSS attempts
      /union.*select/i,  // SQL injection
      /javascript:/i,  // JS injection
      /eval\(/i,  // Code injection
    ];

    const checkSuspiciousContent = (content: string) => {
      suspiciousPatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          const eventNames = ['Path Traversal', 'XSS', 'SQL Injection', 'JS Injection', 'Code Injection'];
          securityEvents.push(eventNames[index]);
        }
      });
    };

    // Check URL and query parameters
    checkSuspiciousContent(req.url);
    
    // Check headers for suspicious content
    Object.values(req.headers).forEach(header => {
      if (typeof header === 'string') {
        checkSuspiciousContent(header);
      }
    });

    // Check for suspicious request characteristics
    const userAgent = req.headers['user-agent'];
    if (!userAgent || userAgent.length < 10) {
      securityEvents.push('Suspicious User Agent');
    }

    // Check for rate limiting indicators
    const ip = req.ip || req.headers['x-forwarded-for'];
    if (global.verbRateLimit && global.verbRateLimit.isBlocked(ip)) {
      securityEvents.push('Rate Limit Exceeded');
    }

    // Log security events
    if (securityEvents.length > 0) {
      const securityLog = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: typeof ip === 'string' ? ip : ip?.[0],
        userAgent,
        securityEvents,
        level: 'warn',
        message: `Security events detected: ${securityEvents.join(', ')}`
      };
      
      console.log(JSON.stringify(securityLog));
    }

    // Continue with request
    next();
  };
};
```

## Error Logging

### Comprehensive Error Tracking

```typescript
// Error logging middleware
export const errorLogging = (): Middleware => {
  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    try {
      next();
    } catch (error) {
      const errorLog = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        error: {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        },
        level: 'error',
        message: 'Unhandled request error'
      };

      console.log(JSON.stringify(errorLog));
      
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ error: 'Internal Server Error' });
      } else {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  };
};
```

## Usage Examples

### Basic Setup

```typescript
import { createServer } from 'verb';
import { requestLogging, performanceLogging, securityLogging, errorLogging } from './middleware/logging';

const app = createServer();

// Apply logging middleware
app.use(requestLogging({
  includeBody: true,
  includeHeaders: false,
  excludePaths: ['/health', '/metrics'],
  maxBodySize: 2048
}));

app.use(performanceLogging({
  slowRequestThreshold: 500,
  includeMemoryUsage: true
}));

app.use(securityLogging());
app.use(errorLogging());

// Your routes
app.get('/api/users', async (req, res) => {
  // This request will be automatically logged
  const users = await getUsersFromDatabase();
  res.json(users);
});

app.listen(3000);
```

### Environment-Specific Configuration

```typescript
// Configure logging based on environment
const getLoggingConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      includeBody: false,
      includeHeaders: false,
      excludePaths: ['/health', '/metrics', '/favicon.ico'],
      maxBodySize: 0
    };
  }
  
  if (process.env.NODE_ENV === 'development') {
    return {
      includeBody: true,
      includeHeaders: true,
      excludePaths: ['/health'],
      maxBodySize: 4096
    };
  }
  
  // Test environment
  return {
    includeBody: false,
    includeHeaders: false,
    excludePaths: ['*'], // Exclude all paths in tests
    maxBodySize: 0
  };
};

app.use(requestLogging(getLoggingConfig()));
```

### Integration with External Log Aggregators

```typescript
// Custom logger that sends to external services
class EnterpriseLogger {
  private logstashEndpoint?: string;
  private splunkEndpoint?: string;
  
  constructor(config: { logstash?: string; splunk?: string }) {
    this.logstashEndpoint = config.logstash;
    this.splunkEndpoint = config.splunk;
  }
  
  async log(entry: LogEntry) {
    // Console logging (always)
    console.log(JSON.stringify(entry));
    
    // Send to external services
    const promises: Promise<any>[] = [];
    
    if (this.logstashEndpoint) {
      promises.push(this.sendToLogstash(entry));
    }
    
    if (this.splunkEndpoint) {
      promises.push(this.sendToSplunk(entry));
    }
    
    // Don't block the request if external logging fails
    Promise.allSettled(promises).catch(console.error);
  }
  
  private async sendToLogstash(entry: LogEntry) {
    try {
      await fetch(this.logstashEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      console.error('Failed to send log to Logstash:', error);
    }
  }
  
  private async sendToSplunk(entry: LogEntry) {
    try {
      await fetch(this.splunkEndpoint!, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Splunk ${process.env.SPLUNK_TOKEN}`
        },
        body: JSON.stringify({ event: entry })
      });
    } catch (error) {
      console.error('Failed to send log to Splunk:', error);
    }
  }
}

// Use custom logger
const logger = new EnterpriseLogger({
  logstash: process.env.LOGSTASH_ENDPOINT,
  splunk: process.env.SPLUNK_ENDPOINT
});

// Override console.log for the logging middleware
const originalConsoleLog = console.log;
console.log = (message: string) => {
  try {
    const logEntry = JSON.parse(message);
    logger.log(logEntry);
  } catch {
    originalConsoleLog(message);
  }
};
```

## Log Analysis and Monitoring

### Log Parsing and Alerting

```typescript
// Log analysis utilities
export class LogAnalyzer {
  private errorThreshold = 10; // errors per minute
  private slowRequestThreshold = 5; // slow requests per minute
  private recentErrors: number[] = [];
  private recentSlowRequests: number[] = [];
  
  processLogEntry(entry: LogEntry) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Track error rates
    if (entry.level === 'error') {
      this.recentErrors.push(now);
      this.recentErrors = this.recentErrors.filter(time => time > oneMinuteAgo);
      
      if (this.recentErrors.length > this.errorThreshold) {
        this.sendAlert('High error rate detected', {
          errorCount: this.recentErrors.length,
          threshold: this.errorThreshold
        });
      }
    }
    
    // Track slow request rates
    if (entry.duration && entry.duration > 1000) {
      this.recentSlowRequests.push(now);
      this.recentSlowRequests = this.recentSlowRequests.filter(time => time > oneMinuteAgo);
      
      if (this.recentSlowRequests.length > this.slowRequestThreshold) {
        this.sendAlert('High slow request rate detected', {
          slowRequestCount: this.recentSlowRequests.length,
          threshold: this.slowRequestThreshold
        });
      }
    }
  }
  
  private async sendAlert(message: string, data: any) {
    // Send to monitoring service (PagerDuty, Slack, etc.)
    console.error(JSON.stringify({ alert: message, data, timestamp: new Date().toISOString() }));
    
    // Example: Send to Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ${message}`,
            attachments: [{
              color: 'danger',
              fields: Object.entries(data).map(([key, value]) => ({
                title: key,
                value: value.toString(),
                short: true
              }))
            }]
          })
        });
      } catch (error) {
        console.error('Failed to send Slack alert:', error);
      }
    }
  }
}
```

## Best Practices

### 1. **Structured Logging**
- Always use JSON format for logs
- Include consistent fields (timestamp, requestId, etc.)
- Use appropriate log levels (info, warn, error)

### 2. **Performance Considerations**
- Exclude health check endpoints from detailed logging
- Limit body logging in production
- Use asynchronous logging for external services

### 3. **Security**
- Never log sensitive data (passwords, tokens, credit cards)
- Sanitize headers and request bodies
- Log security events for monitoring

### 4. **Monitoring Integration**
- Send logs to centralized aggregation services
- Set up alerts for error rates and performance degradation
- Use correlation IDs for distributed tracing

### 5. **Compliance**
- Ensure logging meets regulatory requirements (GDPR, HIPAA, etc.)
- Implement log retention policies
- Provide log access controls

This comprehensive logging middleware provides enterprise-grade observability for Verb applications while maintaining high performance and security standards.