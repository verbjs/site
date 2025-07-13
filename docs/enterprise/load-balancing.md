# Load Balancing Considerations

Comprehensive guide for load balancing Verb applications including session affinity, health checks, and multi-protocol considerations.

## Load Balancing Strategies

### Round Robin with Health Checks

```typescript
// Health check endpoint for load balancer integration
import type { VerbRequest, VerbResponse } from 'verb';
import { getDatabase } from '../db/connection';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    duration?: number;
    error?: string;
  }>;
  timestamp: string;
  uptime: number;
  version: string;
  instance: string;
}

export const createHealthCheckEndpoint = (options: {
  includeDetails?: boolean;
  timeout?: number;
  dependencies?: {
    name: string;
    check: () => Promise<boolean>;
    critical?: boolean;
  }[];
} = {}) => {
  const {
    includeDetails = true,
    timeout = 5000,
    dependencies = []
  } = options;

  return async (req: VerbRequest, res: VerbResponse) => {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'healthy',
      checks: {},
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      instance: process.env.HOSTNAME || process.env.INSTANCE_ID || 'unknown'
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      const db = getDatabase();
      await Promise.race([
        db.query('SELECT 1').get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]);
      
      result.checks.database = {
        status: 'pass',
        duration: Date.now() - dbStart
      };
    } catch (error) {
      result.checks.database = {
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      result.status = 'unhealthy';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
    const memThreshold = 1000; // 1GB threshold
    
    result.checks.memory = {
      status: memUsageMB > memThreshold ? 'warn' : 'pass',
      duration: 0
    };
    
    if (memUsageMB > memThreshold && result.status === 'healthy') {
      result.status = 'degraded';
    }

    // Check custom dependencies
    for (const dep of dependencies) {
      try {
        const depStart = Date.now();
        const isHealthy = await Promise.race([
          dep.check(),
          new Promise<boolean>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
        
        result.checks[dep.name] = {
          status: isHealthy ? 'pass' : 'fail',
          duration: Date.now() - depStart
        };
        
        if (!isHealthy && dep.critical !== false) {
          result.status = 'unhealthy';
        }
      } catch (error) {
        result.checks[dep.name] = {
          status: 'fail',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        if (dep.critical !== false) {
          result.status = 'unhealthy';
        }
      }
    }

    // Set appropriate HTTP status
    const statusCode = result.status === 'healthy' ? 200 : 
                      result.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode);
    
    if (includeDetails) {
      res.json(result);
    } else {
      // Simple response for basic load balancers
      res.text(result.status === 'unhealthy' ? 'FAIL' : 'OK');
    }
  };
};
```

### Session Affinity for WebSocket Connections

```typescript
// Session affinity middleware for sticky sessions
interface StickySessionOptions {
  cookieName?: string;
  cookieMaxAge?: number;
  headerName?: string;
  algorithm?: 'ip-hash' | 'consistent-hash' | 'random';
  serverCount?: number;
}

export const stickySessionMiddleware = (options: StickySessionOptions = {}): Middleware => {
  const {
    cookieName = 'verb-server-id',
    cookieMaxAge = 86400000, // 24 hours
    headerName = 'X-Server-ID',
    algorithm = 'consistent-hash',
    serverCount = 3
  } = options;

  const serverId = process.env.SERVER_ID || process.env.HOSTNAME || 
                   Math.random().toString(36).substr(2, 9);

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Check for existing session affinity
    const existingServerId = req.cookies?.[cookieName] || req.headers[headerName.toLowerCase()];
    
    if (existingServerId && existingServerId === serverId) {
      // Request is for this server
      next();
      return;
    }
    
    // Determine target server based on algorithm
    let targetServerId: string;
    
    switch (algorithm) {
      case 'ip-hash':
        targetServerId = hashToServerId(req.ip || 'unknown', serverCount);
        break;
      case 'consistent-hash':
        const userId = req.user?.id || req.ip || 'anonymous';
        targetServerId = consistentHash(userId, serverCount);
        break;
      case 'random':
        targetServerId = `server-${Math.floor(Math.random() * serverCount) + 1}`;
        break;
      default:
        targetServerId = serverId;
    }
    
    // Set session affinity for future requests
    res.cookie(cookieName, targetServerId, {
      maxAge: cookieMaxAge,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    res.header(headerName, targetServerId);
    
    // If this isn't the target server, provide routing hint
    if (targetServerId !== serverId) {
      res.header('X-Preferred-Server', targetServerId);
    }
    
    next();
  };
};

function hashToServerId(input: string, serverCount: number): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `server-${Math.abs(hash) % serverCount + 1}`;
}

function consistentHash(key: string, serverCount: number): string {
  // Simple consistent hashing implementation
  const ring = [];
  const virtualNodes = 150; // Virtual nodes per server
  
  for (let i = 1; i <= serverCount; i++) {
    for (let j = 0; j < virtualNodes; j++) {
      const virtualKey = `server-${i}:${j}`;
      ring.push({ hash: simpleHash(virtualKey), server: `server-${i}` });
    }
  }
  
  ring.sort((a, b) => a.hash - b.hash);
  
  const keyHash = simpleHash(key);
  for (const node of ring) {
    if (node.hash >= keyHash) {
      return node.server;
    }
  }
  
  return ring[0].server;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

## WebSocket Load Balancing

### WebSocket-Aware Load Balancing

```typescript
// WebSocket connection tracking for load balancer awareness
class WebSocketConnectionTracker {
  private connections = new Map<string, Set<string>>();
  private connectionCount = 0;
  private maxConnections: number;

  constructor(maxConnections = 10000) {
    this.maxConnections = maxConnections;
  }

  addConnection(userId: string, connectionId: string): boolean {
    if (this.connectionCount >= this.maxConnections) {
      return false;
    }

    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    this.connections.get(userId)!.add(connectionId);
    this.connectionCount++;
    return true;
  }

  removeConnection(userId: string, connectionId: string): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      this.connectionCount--;
      
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }

  getUserConnections(userId: string): string[] {
    return Array.from(this.connections.get(userId) || []);
  }

  canAcceptConnections(): boolean {
    return this.connectionCount < this.maxConnections * 0.9; // 90% threshold
  }

  getMetrics() {
    return {
      totalConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      utilizationPercentage: (this.connectionCount / this.maxConnections) * 100,
      uniqueUsers: this.connections.size
    };
  }
}

const wsTracker = new WebSocketConnectionTracker();

// WebSocket middleware for connection management
export const websocketLoadBalancingMiddleware = () => {
  return {
    beforeUpgrade: (req: VerbRequest, res: VerbResponse) => {
      // Check if server can accept new connections
      if (!wsTracker.canAcceptConnections()) {
        res.header('X-WebSocket-Reject-Reason', 'Server at capacity');
        res.status(503).json({ error: 'Server temporarily unavailable' });
        return false;
      }
      
      // Add load balancing headers
      res.header('X-WebSocket-Server', process.env.SERVER_ID || 'unknown');
      res.header('X-Connection-Count', wsTracker.getConnectionCount().toString());
      
      return true;
    },
    
    onConnect: (ws: WebSocket, req: VerbRequest) => {
      const userId = req.user?.id || req.ip || 'anonymous';
      const connectionId = crypto.randomUUID();
      
      if (!wsTracker.addConnection(userId, connectionId)) {
        ws.close(1013, 'Server overloaded');
        return;
      }
      
      ws.userData = { userId, connectionId };
      
      // Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'connection_ack',
        serverId: process.env.SERVER_ID,
        connectionId
      }));
    },
    
    onClose: (ws: WebSocket) => {
      if (ws.userData) {
        wsTracker.removeConnection(ws.userData.userId, ws.userData.connectionId);
      }
    }
  };
};
```

## Multi-Protocol Load Balancing

### Protocol-Aware Routing

```typescript
// Load balancer configuration for different protocols
interface ProtocolConfig {
  protocol: 'http' | 'websocket' | 'udp' | 'tcp';
  port: number;
  healthCheckPath?: string;
  stickySession?: boolean;
  maxConnections?: number;
}

interface ServerInstance {
  id: string;
  host: string;
  protocols: ProtocolConfig[];
  healthy: boolean;
  lastHealthCheck: number;
  connections: Record<string, number>; // protocol -> connection count
  load: number; // 0-100
}

class MultiProtocolLoadBalancer {
  private servers: Map<string, ServerInstance> = new Map();
  private healthCheckInterval: NodeJS.Timeout;

  constructor(private healthCheckIntervalMs = 30000) {
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      healthCheckIntervalMs
    );
  }

  addServer(server: ServerInstance): void {
    this.servers.set(server.id, server);
  }

  removeServer(serverId: string): void {
    this.servers.delete(serverId);
  }

  selectServer(protocol: string, algorithm: 'round-robin' | 'least-connections' | 'weighted' = 'least-connections'): ServerInstance | null {
    const availableServers = Array.from(this.servers.values())
      .filter(server => 
        server.healthy && 
        server.protocols.some(p => p.protocol === protocol)
      );

    if (availableServers.length === 0) {
      return null;
    }

    switch (algorithm) {
      case 'round-robin':
        return this.roundRobinSelection(availableServers, protocol);
      case 'least-connections':
        return this.leastConnectionsSelection(availableServers, protocol);
      case 'weighted':
        return this.weightedSelection(availableServers);
      default:
        return availableServers[0];
    }
  }

  private roundRobinSelection(servers: ServerInstance[], protocol: string): ServerInstance {
    // Simple round-robin implementation
    const key = `rr-${protocol}`;
    if (!this.roundRobinCounters) {
      this.roundRobinCounters = new Map();
    }
    
    const current = this.roundRobinCounters.get(key) || 0;
    const selected = servers[current % servers.length];
    this.roundRobinCounters.set(key, current + 1);
    
    return selected;
  }

  private roundRobinCounters = new Map<string, number>();

  private leastConnectionsSelection(servers: ServerInstance[], protocol: string): ServerInstance {
    return servers.reduce((best, current) => {
      const bestConnections = best.connections[protocol] || 0;
      const currentConnections = current.connections[protocol] || 0;
      return currentConnections < bestConnections ? current : best;
    });
  }

  private weightedSelection(servers: ServerInstance[]): ServerInstance {
    // Weight based on inverse of load (lower load = higher weight)
    const weights = servers.map(server => Math.max(1, 100 - server.load));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < servers.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return servers[i];
      }
    }
    
    return servers[servers.length - 1];
  }

  private async performHealthChecks(): Promise<void> {
    for (const server of this.servers.values()) {
      for (const protocolConfig of server.protocols) {
        if (protocolConfig.healthCheckPath) {
          try {
            const response = await fetch(
              `http://${server.host}:${protocolConfig.port}${protocolConfig.healthCheckPath}`,
              { timeout: 5000 }
            );
            
            server.healthy = response.ok;
            server.lastHealthCheck = Date.now();
            
            // Parse health response for additional metrics
            if (response.ok) {
              try {
                const healthData = await response.json();
                if (healthData.load !== undefined) {
                  server.load = healthData.load;
                }
                if (healthData.connections) {
                  server.connections = healthData.connections;
                }
              } catch {
                // Ignore JSON parsing errors
              }
            }
          } catch (error) {
            server.healthy = false;
            server.lastHealthCheck = Date.now();
            console.error(`Health check failed for ${server.id}:`, error);
          }
        }
      }
    }
  }

  getServerMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [serverId, server] of this.servers.entries()) {
      metrics[serverId] = {
        healthy: server.healthy,
        load: server.load,
        connections: server.connections,
        lastHealthCheck: server.lastHealthCheck,
        protocols: server.protocols.map(p => p.protocol)
      };
    }
    
    return metrics;
  }

  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
```

## nginx Configuration Examples

### HTTP Load Balancing with Health Checks

```nginx
# /etc/nginx/conf.d/verb-app.conf

# Upstream configuration for HTTP traffic
upstream verb_http {
    least_conn;
    server app1.example.com:3000 max_fails=3 fail_timeout=30s;
    server app2.example.com:3000 max_fails=3 fail_timeout=30s;
    server app3.example.com:3000 max_fails=3 fail_timeout=30s;
    
    # Health check (nginx plus)
    # health_check uri=/health interval=10s fails=3 passes=2;
}

# Upstream for WebSocket traffic (sticky sessions)
upstream verb_websocket {
    ip_hash;  # Sticky sessions for WebSocket
    server app1.example.com:3000;
    server app2.example.com:3000;
    server app3.example.com:3000;
}

server {
    listen 80;
    server_name api.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # WebSocket upgrade handling
    location /ws {
        proxy_pass http://verb_websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # Buffer settings
        proxy_buffering off;
    }
    
    # Health check endpoint (allow from load balancer only)
    location /health {
        proxy_pass http://verb_http;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Restrict access to health checks
        allow 10.0.0.0/8;    # Private networks
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        allow 127.0.0.1;     # Localhost
        deny all;
    }
    
    # API routes
    location /api {
        proxy_pass http://verb_http;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }
    
    # Static content (if any)
    location /static {
        proxy_pass http://verb_http;
        proxy_cache_valid 200 1h;
        proxy_cache_key $uri$is_args$args;
        add_header X-Cache-Status $upstream_cache_status;
    }
    
    # Default location
    location / {
        proxy_pass http://verb_http;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting zones
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    limit_conn conn_limit_per_ip 20;
}
```

### HAProxy Configuration

```haproxy
# /etc/haproxy/haproxy.cfg

global
    daemon
    maxconn 4096
    log stdout local0
    
    # SSL/TLS settings
    ssl-default-bind-ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512
    ssl-default-bind-options ssl-min-ver TLSv1.2 no-tls-tickets
    ssl-default-server-ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512
    ssl-default-server-options ssl-min-ver TLSv1.2 no-tls-tickets

defaults
    mode http
    log global
    option httplog
    option dontlognull
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option forwardfor
    option http-server-close

# Frontend for HTTP/HTTPS traffic
frontend verb_frontend
    bind *:80
    bind *:443 ssl crt /path/to/certificate.pem
    
    # Redirect HTTP to HTTPS
    redirect scheme https code 301 if !{ ssl_fc }
    
    # Security headers
    http-response set-header X-Frame-Options DENY
    http-response set-header X-Content-Type-Options nosniff
    http-response set-header X-XSS-Protection "1; mode=block"
    http-response set-header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    
    # Rate limiting (basic)
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny if { sc_http_req_rate(0) gt 20 }
    
    # Route based on path
    use_backend verb_websocket if { path_beg /ws }
    use_backend verb_api if { path_beg /api }
    default_backend verb_http

# Backend for regular HTTP traffic
backend verb_http
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    
    server app1 app1.example.com:3000 check inter 10s rise 2 fall 3
    server app2 app2.example.com:3000 check inter 10s rise 2 fall 3
    server app3 app3.example.com:3000 check inter 10s rise 2 fall 3

# Backend for API traffic (with different settings)
backend verb_api
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    
    # API-specific timeouts
    timeout server 30s
    
    server app1 app1.example.com:3000 check inter 5s rise 2 fall 2
    server app2 app2.example.com:3000 check inter 5s rise 2 fall 2
    server app3 app3.example.com:3000 check inter 5s rise 2 fall 2

# Backend for WebSocket traffic (sticky sessions)
backend verb_websocket
    balance source
    option httpchk GET /health
    http-check expect status 200
    
    # WebSocket timeouts
    timeout tunnel 3600s
    timeout server 3600s
    
    server app1 app1.example.com:3000 check inter 10s rise 2 fall 3
    server app2 app2.example.com:3000 check inter 10s rise 2 fall 3
    server app3 app3.example.com:3000 check inter 10s rise 2 fall 3

# Statistics page
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
```

## Cloud Load Balancer Configuration

### AWS Application Load Balancer

```yaml
# cloudformation-alb.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Application Load Balancer for Verb application'

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  CertificateArn:
    Type: String

Resources:
  # Security Group for ALB
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Application Load Balancer
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: verb-app-alb
      Scheme: internet-facing
      Type: application
      Subnets: !Ref SubnetIds
      SecurityGroups:
        - !Ref ALBSecurityGroup
      LoadBalancerAttributes:
        - Key: idle_timeout.timeout_seconds
          Value: '60'
        - Key: routing.http2.enabled
          Value: 'true'
        - Key: access_logs.s3.enabled
          Value: 'true'
        - Key: access_logs.s3.bucket
          Value: !Ref LogsBucket

  # Target Group for HTTP traffic
  HTTPTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: verb-http-targets
      Port: 3000
      Protocol: HTTP
      VpcId: !Ref VpcId
      TargetType: instance
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 10
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      HealthCheckTimeoutSeconds: 5
      Matcher:
        HttpCode: '200'
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: '30'
        - Key: stickiness.enabled
          Value: 'false'

  # Target Group for WebSocket traffic (sticky sessions)
  WebSocketTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: verb-websocket-targets
      Port: 3000
      Protocol: HTTP
      VpcId: !Ref VpcId
      TargetType: instance
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 10
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      TargetGroupAttributes:
        - Key: stickiness.enabled
          Value: 'true'
        - Key: stickiness.type
          Value: 'lb_cookie'
        - Key: stickiness.lb_cookie.duration_seconds
          Value: '86400'

  # HTTPS Listener
  HTTPSListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref HTTPTargetGroup
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 443
      Protocol: HTTPS
      Certificates:
        - CertificateArn: !Ref CertificateArn
      SslPolicy: ELBSecurityPolicy-TLS-1-2-2017-01

  # HTTP Listener (redirect to HTTPS)
  HTTPListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: redirect
          RedirectConfig:
            Protocol: HTTPS
            Port: 443
            StatusCode: HTTP_301
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP

  # Listener Rule for WebSocket traffic
  WebSocketListenerRule:
    Type: AWS::ElasticLoadBalancingV2::ListenerRule
    Properties:
      Actions:
        - Type: forward
          TargetGroupArn: !Ref WebSocketTargetGroup
      Conditions:
        - Field: path-pattern
          Values:
            - '/ws/*'
      ListenerArn: !Ref HTTPSListener
      Priority: 100

  # Listener Rule for API traffic
  APIListenerRule:
    Type: AWS::ElasticLoadBalancingV2::ListenerRule
    Properties:
      Actions:
        - Type: forward
          TargetGroupArn: !Ref HTTPTargetGroup
      Conditions:
        - Field: path-pattern
          Values:
            - '/api/*'
      ListenerArn: !Ref HTTPSListener
      Priority: 200

Outputs:
  LoadBalancerDNS:
    Description: DNS name of the load balancer
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub '${AWS::StackName}-LoadBalancerDNS'

  HTTPTargetGroupArn:
    Description: ARN of the HTTP target group
    Value: !Ref HTTPTargetGroup
    Export:
      Name: !Sub '${AWS::StackName}-HTTPTargetGroup'

  WebSocketTargetGroupArn:
    Description: ARN of the WebSocket target group
    Value: !Ref WebSocketTargetGroup
    Export:
      Name: !Sub '${AWS::StackName}-WebSocketTargetGroup'
```

## Monitoring and Observability

### Load Balancer Metrics

```typescript
// Load balancer health monitoring
export class LoadBalancerMonitoring {
  private metrics = new Map<string, any>();
  private alertThresholds = {
    errorRate: 5, // 5% error rate
    responseTime: 1000, // 1 second
    unhealthyServers: 50 // 50% of servers
  };

  recordRequest(serverId: string, duration: number, statusCode: number) {
    const key = `server:${serverId}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        requests: 0,
        errors: 0,
        totalDuration: 0,
        lastSeen: Date.now()
      });
    }

    const serverMetrics = this.metrics.get(key);
    serverMetrics.requests++;
    serverMetrics.totalDuration += duration;
    serverMetrics.lastSeen = Date.now();

    if (statusCode >= 400) {
      serverMetrics.errors++;
    }

    // Check thresholds and alert if necessary
    this.checkAlerts(serverId, serverMetrics);
  }

  private checkAlerts(serverId: string, metrics: any) {
    const errorRate = (metrics.errors / metrics.requests) * 100;
    const avgResponseTime = metrics.totalDuration / metrics.requests;

    if (errorRate > this.alertThresholds.errorRate) {
      this.sendAlert('high_error_rate', {
        serverId,
        errorRate,
        threshold: this.alertThresholds.errorRate
      });
    }

    if (avgResponseTime > this.alertThresholds.responseTime) {
      this.sendAlert('high_response_time', {
        serverId,
        responseTime: avgResponseTime,
        threshold: this.alertThresholds.responseTime
      });
    }
  }

  private sendAlert(type: string, data: any) {
    console.error(`ALERT [${type}]:`, JSON.stringify(data));
    
    // Send to monitoring service
    if (process.env.SLACK_WEBHOOK) {
      this.sendSlackAlert(type, data);
    }
  }

  private async sendSlackAlert(type: string, data: any) {
    try {
      await fetch(process.env.SLACK_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Load Balancer Alert: ${type}`,
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

  getServerMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, metrics] of this.metrics.entries()) {
      const serverId = key.replace('server:', '');
      result[serverId] = {
        requests: metrics.requests,
        errorRate: (metrics.errors / metrics.requests) * 100,
        avgResponseTime: metrics.totalDuration / metrics.requests,
        lastSeen: metrics.lastSeen
      };
    }
    
    return result;
  }
}
```

## Best Practices

### 1. **Health Check Design**
- Implement comprehensive health checks that verify all dependencies
- Use different health check URLs for different types of checks
- Include gradual degradation indicators

### 2. **Session Management**
- Use sticky sessions for WebSocket connections
- Implement session replication for stateful applications
- Consider using external session stores (Redis)

### 3. **Protocol Considerations**
- Different load balancing strategies for different protocols
- WebSocket connections require sticky sessions
- UDP/TCP require different load balancing approaches

### 4. **Monitoring**
- Monitor load balancer performance metrics
- Track server health and response times
- Set up alerting for load balancer failures

### 5. **Capacity Planning**
- Plan for traffic spikes and scaling events
- Monitor connection limits and server capacity
- Implement graceful degradation strategies

This comprehensive load balancing guide provides enterprise-ready strategies for scaling Verb applications across multiple protocols and deployment scenarios.