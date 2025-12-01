# Horizontal Scaling Guide

Comprehensive guide for horizontally scaling Verb applications including auto-scaling, service discovery, and distributed architectures.

## Auto-Scaling Strategies

### Kubernetes Horizontal Pod Autoscaler

```yaml
# kubernetes/verb-app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: verb-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: verb-app
  template:
    metadata:
      labels:
        app: verb-app
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: verb-app
        image: your-registry/verb-app:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
---
apiVersion: v1
kind: Service
metadata:
  name: verb-app-service
  namespace: production
spec:
  selector:
    app: verb-app
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: verb-app-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: verb-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "30"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 60
      selectPolicy: Max
```

### AWS Auto Scaling Group

```yaml
# cloudformation-asg.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Auto Scaling Group for Verb application'

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
  InstanceType:
    Type: String
    Default: t3.medium
  TargetGroupArn:
    Type: String

Resources:
  # IAM Role for EC2 instances
  InstanceRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
        - Effect: Allow
          Principal:
            Service: ec2.amazonaws.com
          Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
      Policies:
        - PolicyName: VerbAppPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
                - cloudwatch:PutMetricData
              Resource: '*'

  InstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref InstanceRole

  # Security Group for instances
  InstanceSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Verb app instances
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3000
          ToPort: 3000
          SourceSecurityGroupId: !Ref ALBSecurityGroup
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 10.0.0.0/8

  # Launch Template
  LaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateName: verb-app-template
      LaunchTemplateData:
        ImageId: ami-0abcdef1234567890  # Amazon Linux 2 AMI
        InstanceType: !Ref InstanceType
        KeyName: !Ref KeyPairName
        IamInstanceProfile:
          Arn: !GetAtt InstanceProfile.Arn
        SecurityGroupIds:
          - !Ref InstanceSecurityGroup
        UserData:
          Fn::Base64: !Sub |
            #!/bin/bash
            yum update -y
            
            # Install Node.js and Bun
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            yum install -y nodejs
            curl -fsSL https://bun.sh/install | bash
            
            # Install CloudWatch agent
            yum install -y amazon-cloudwatch-agent
            
            # Create app user
            useradd -m -s /bin/bash app
            
            # Setup application directory
            mkdir -p /opt/verb-app
            chown app:app /opt/verb-app
            
            # Download and setup application
            cd /opt/verb-app
            # Your application deployment script here
            
            # Create systemd service
            cat > /etc/systemd/system/verb-app.service << EOF
            [Unit]
            Description=Verb Application
            After=network.target
            
            [Service]
            Type=simple
            User=app
            WorkingDirectory=/opt/verb-app
            ExecStart=/home/app/.bun/bin/bun src/index.ts
            Restart=always
            RestartSec=10
            Environment=NODE_ENV=production
            Environment=PORT=3000
            
            [Install]
            WantedBy=multi-user.target
            EOF
            
            # Start services
            systemctl daemon-reload
            systemctl enable verb-app
            systemctl start verb-app
            
            # Configure CloudWatch agent
            cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
            {
              "metrics": {
                "namespace": "VerbApp",
                "metrics_collected": {
                  "cpu": {
                    "measurement": [
                      "cpu_usage_idle",
                      "cpu_usage_iowait",
                      "cpu_usage_user",
                      "cpu_usage_system"
                    ],
                    "metrics_collection_interval": 60
                  },
                  "disk": {
                    "measurement": [
                      "used_percent"
                    ],
                    "metrics_collection_interval": 60,
                    "resources": [
                      "*"
                    ]
                  },
                  "mem": {
                    "measurement": [
                      "mem_used_percent"
                    ],
                    "metrics_collection_interval": 60
                  }
                }
              },
              "logs": {
                "logs_collected": {
                  "files": {
                    "collect_list": [
                      {
                        "file_path": "/var/log/verb-app.log",
                        "log_group_name": "verb-app-logs",
                        "log_stream_name": "{instance_id}"
                      }
                    ]
                  }
                }
              }
            }
            EOF
            
            /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
              -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
        TagSpecifications:
          - ResourceType: instance
            Tags:
              - Key: Name
                Value: verb-app-instance
              - Key: Environment
                Value: production

  # Auto Scaling Group
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      AutoScalingGroupName: verb-app-asg
      VPCZoneIdentifier: !Ref SubnetIds
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate
        Version: !GetAtt LaunchTemplate.LatestVersionNumber
      MinSize: 2
      MaxSize: 20
      DesiredCapacity: 3
      TargetGroupARNs:
        - !Ref TargetGroupArn
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
      DefaultCooldown: 300
      Tags:
        - Key: Name
          Value: verb-app-instance
          PropagateAtLaunch: true
        - Key: Environment
          Value: production
          PropagateAtLaunch: true

  # Scaling Policies
  ScaleUpPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref AutoScalingGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ASGAverageCPUUtilization
        TargetValue: 70.0
        ScaleOutCooldown: 300
        ScaleInCooldown: 300

  # Custom Metric Scaling Policy
  RequestCountScalingPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref AutoScalingGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        CustomizedMetricSpecification:
          MetricName: RequestCountPerTarget
          Namespace: AWS/ApplicationELB
          Statistic: Sum
          Dimensions:
            - Name: TargetGroup
              Value: !Ref TargetGroupArn
        TargetValue: 1000.0

Outputs:
  AutoScalingGroupName:
    Description: Name of the Auto Scaling Group
    Value: !Ref AutoScalingGroup
    Export:
      Name: !Sub '${AWS::StackName}-ASGName'
```

## Service Discovery

### Consul Service Discovery

```typescript
// Service discovery with Consul
import Consul from 'consul';
import { server } from 'verb';

interface ServiceConfig {
  name: string;
  id: string;
  port: number;
  tags: string[];
  meta?: Record<string, string>;
  check?: {
    http?: string;
    interval?: string;
    timeout?: string;
  };
}

class ConsulServiceDiscovery {
  private consul: Consul.Consul;
  private services = new Map<string, ServiceConfig>();
  private watchHandlers = new Map<string, (services: ServiceConfig[]) => void>();

  constructor(consulUrl: string) {
    this.consul = new Consul({
      host: consulUrl,
      defaults: {
        token: process.env.CONSUL_TOKEN
      }
    });
  }

  async registerService(config: ServiceConfig): Promise<void> {
    try {
      const serviceDefinition = {
        id: config.id,
        name: config.name,
        port: config.port,
        tags: config.tags,
        meta: config.meta,
        check: config.check ? {
          http: config.check.http,
          interval: config.check.interval || '10s',
          timeout: config.check.timeout || '5s'
        } : undefined
      };

      await this.consul.agent.service.register(serviceDefinition);
      this.services.set(config.id, config);
      
      console.log(`Service ${config.name} registered with ID ${config.id}`);
    } catch (error) {
      console.error(`Failed to register service ${config.name}:`, error);
      throw error;
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    try {
      await this.consul.agent.service.deregister(serviceId);
      this.services.delete(serviceId);
      console.log(`Service ${serviceId} deregistered`);
    } catch (error) {
      console.error(`Failed to deregister service ${serviceId}:`, error);
    }
  }

  async discoverServices(serviceName: string): Promise<ServiceConfig[]> {
    try {
      const result = await this.consul.health.service({
        service: serviceName,
        passing: true
      });

      return result.map(entry => ({
        name: entry.Service.Service,
        id: entry.Service.ID,
        port: entry.Service.Port,
        tags: entry.Service.Tags,
        meta: entry.Service.Meta,
        address: entry.Service.Address || entry.Node.Address
      }));
    } catch (error) {
      console.error(`Failed to discover service ${serviceName}:`, error);
      return [];
    }
  }

  watchService(serviceName: string, callback: (services: ServiceConfig[]) => void): void {
    this.watchHandlers.set(serviceName, callback);
    
    const watcher = this.consul.watch({
      method: this.consul.health.service,
      options: {
        service: serviceName,
        passing: true
      }
    });

    watcher.on('change', (data: any) => {
      const services = data.map((entry: any) => ({
        name: entry.Service.Service,
        id: entry.Service.ID,
        port: entry.Service.Port,
        tags: entry.Service.Tags,
        meta: entry.Service.Meta,
        address: entry.Service.Address || entry.Node.Address
      }));
      
      callback(services);
    });

    watcher.on('error', (error: any) => {
      console.error(`Service watch error for ${serviceName}:`, error);
    });
  }

  async deregisterAllServices(): Promise<void> {
    const promises = Array.from(this.services.keys()).map(id => 
      this.deregisterService(id)
    );
    
    await Promise.all(promises);
  }
}

// Service discovery middleware
export const serviceDiscoveryMiddleware = (consulUrl: string) => {
  const discovery = new ConsulServiceDiscovery(consulUrl);
  
  return {
    discovery,
    
    async registerSelf(port: number, protocols: string[] = ['http']) {
      const serviceId = `${process.env.SERVICE_NAME || 'verb-app'}-${process.env.HOSTNAME || Math.random().toString(36).substr(2, 9)}`;
      
      await discovery.registerService({
        name: process.env.SERVICE_NAME || 'verb-app',
        id: serviceId,
        port,
        tags: ['verb', ...protocols, process.env.NODE_ENV || 'development'],
        meta: {
          version: process.env.npm_package_version || '1.0.0',
          protocols: protocols.join(','),
          startTime: new Date().toISOString()
        },
        check: {
          http: `http://localhost:${port}/health`,
          interval: '10s',
          timeout: '5s'
        }
      });
      
      // Graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('Deregistering service...');
        await discovery.deregisterService(serviceId);
        process.exit(0);
      });
      
      process.on('SIGINT', async () => {
        console.log('Deregistering service...');
        await discovery.deregisterService(serviceId);
        process.exit(0);
      });
      
      return serviceId;
    }
  };
};
```

### Kubernetes Service Discovery

```typescript
// Kubernetes-native service discovery
import * as k8s from '@kubernetes/client-node';

class KubernetesServiceDiscovery {
  private k8sApi: k8s.CoreV1Api;
  private namespace: string;
  private watchers = new Map<string, k8s.Watch>();

  constructor(namespace = 'default') {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.namespace = namespace;
  }

  async discoverServices(labelSelector?: string): Promise<ServiceConfig[]> {
    try {
      const response = await this.k8sApi.listNamespacedService(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        labelSelector
      );

      return response.body.items.map(service => ({
        name: service.metadata?.name || '',
        id: service.metadata?.uid || '',
        port: service.spec?.ports?.[0]?.port || 80,
        tags: Object.keys(service.metadata?.labels || {}),
        meta: service.metadata?.annotations || {},
        address: `${service.metadata?.name}.${this.namespace}.svc.cluster.local`
      }));
    } catch (error) {
      console.error('Failed to discover services:', error);
      return [];
    }
  }

  async discoverEndpoints(serviceName: string): Promise<Array<{ address: string; port: number }>> {
    try {
      const response = await this.k8sApi.readNamespacedEndpoints(
        serviceName,
        this.namespace
      );

      const endpoints: Array<{ address: string; port: number }> = [];
      
      response.body.subsets?.forEach(subset => {
        subset.addresses?.forEach(address => {
          subset.ports?.forEach(port => {
            endpoints.push({
              address: address.ip || '',
              port: port.port || 80
            });
          });
        });
      });

      return endpoints;
    } catch (error) {
      console.error(`Failed to discover endpoints for ${serviceName}:`, error);
      return [];
    }
  }

  watchServices(labelSelector: string, callback: (services: ServiceConfig[]) => void): void {
    const watch = new k8s.Watch(new k8s.KubeConfig());
    
    const watchRequest = watch.watch(
      `/api/v1/namespaces/${this.namespace}/services`,
      { labelSelector },
      (type, obj) => {
        // Refresh service list on any change
        this.discoverServices(labelSelector).then(callback);
      },
      (error) => {
        console.error('Service watch error:', error);
      }
    );
    
    this.watchers.set(labelSelector, watch);
  }

  stopWatching(labelSelector: string): void {
    const watcher = this.watchers.get(labelSelector);
    if (watcher) {
      // Note: Kubernetes client watch doesn't have a direct stop method
      // In practice, you would need to handle this differently
      this.watchers.delete(labelSelector);
    }
  }
}
```

## Distributed Session Management

### Redis Session Store

```typescript
// Distributed session management
import Redis from 'redis';
import type { VerbRequest, VerbResponse, Middleware } from 'verb';

interface SessionData {
  id: string;
  userId?: string;
  data: Record<string, any>;
  createdAt: number;
  lastAccessed: number;
  expiresAt: number;
}

class RedisSessionStore {
  private client: Redis.RedisClientType;
  private prefix: string;
  private defaultTTL: number;

  constructor(redisUrl: string, prefix = 'session:', defaultTTL = 86400000) {
    this.client = Redis.createClient({ url: redisUrl });
    this.client.connect();
    this.prefix = prefix;
    this.defaultTTL = defaultTTL;
  }

  async createSession(userId?: string, data: Record<string, any> = {}): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    
    const sessionData: SessionData = {
      id: sessionId,
      userId,
      data,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + this.defaultTTL
    };

    await this.client.setEx(
      `${this.prefix}${sessionId}`,
      Math.ceil(this.defaultTTL / 1000),
      JSON.stringify(sessionData)
    );

    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const data = await this.client.get(`${this.prefix}${sessionId}`);
      if (!data) return null;

      const session: SessionData = JSON.parse(data);
      
      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      // Update last accessed time
      session.lastAccessed = Date.now();
      await this.client.setEx(
        `${this.prefix}${sessionId}`,
        Math.ceil(this.defaultTTL / 1000),
        JSON.stringify(session)
      );

      return session;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;

      Object.assign(session, data, { lastAccessed: Date.now() });
      
      await this.client.setEx(
        `${this.prefix}${sessionId}`,
        Math.ceil(this.defaultTTL / 1000),
        JSON.stringify(session)
      );

      return true;
    } catch (error) {
      console.error('Failed to update session:', error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.client.del(`${this.prefix}${sessionId}`);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      const sessions: SessionData[] = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const session: SessionData = JSON.parse(data);
          if (session.userId === userId && session.expiresAt > Date.now()) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  }

  async cleanup(): Promise<void> {
    // This would typically be handled by Redis TTL
    // But you might want to implement batch cleanup for analytics
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          const session: SessionData = JSON.parse(data);
          if (session.expiresAt < now) {
            expiredKeys.push(key);
          }
        }
      }

      if (expiredKeys.length > 0) {
        await this.client.del(expiredKeys);
        console.log(`Cleaned up ${expiredKeys.length} expired sessions`);
      }
    } catch (error) {
      console.error('Session cleanup failed:', error);
    }
  }
}

// Session middleware
export const distributedSessionMiddleware = (options: {
  redisUrl: string;
  cookieName?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
}): Middleware => {
  const {
    redisUrl,
    cookieName = 'sessionId',
    secure = process.env.NODE_ENV === 'production',
    httpOnly = true,
    sameSite = 'lax',
    maxAge = 86400000 // 24 hours
  } = options;

  const sessionStore = new RedisSessionStore(redisUrl, 'session:', maxAge);

  return async (req: VerbRequest, res: VerbResponse, next: () => void) => {
    // Get session ID from cookie
    const sessionId = req.cookies?.[cookieName];
    
    if (sessionId) {
      // Load existing session
      const session = await sessionStore.getSession(sessionId);
      if (session) {
        req.session = {
          id: session.id,
          userId: session.userId,
          data: session.data,
          save: async (data: Record<string, any>) => {
            await sessionStore.updateSession(session.id, { data });
          },
          destroy: async () => {
            await sessionStore.deleteSession(session.id);
            res.clearCookie(cookieName);
          }
        };
      }
    }

    // Create session helper
    req.createSession = async (userId?: string, data: Record<string, any> = {}) => {
      const newSessionId = await sessionStore.createSession(userId, data);
      
      res.cookie(cookieName, newSessionId, {
        maxAge,
        secure,
        httpOnly,
        sameSite
      });
      
      req.session = {
        id: newSessionId,
        userId,
        data,
        save: async (newData: Record<string, any>) => {
          await sessionStore.updateSession(newSessionId, { data: newData });
        },
        destroy: async () => {
          await sessionStore.deleteSession(newSessionId);
          res.clearCookie(cookieName);
        }
      };
      
      return newSessionId;
    };

    next();
  };
};
```

## Database Scaling Patterns

### Database Connection Pooling

```typescript
// Advanced database connection pooling
import { Pool, PoolConfig } from 'pg';

interface DatabasePoolConfig extends PoolConfig {
  readReplicas?: string[];
  writeTimeout?: number;
  readTimeout?: number;
  healthCheckInterval?: number;
}

class DatabaseConnectionManager {
  private writePool: Pool;
  private readPools: Pool[];
  private healthCheckInterval: NodeJS.Timeout;
  private poolStats = {
    writes: { total: 0, errors: 0 },
    reads: { total: 0, errors: 0 }
  };

  constructor(config: DatabasePoolConfig) {
    // Write pool (primary database)
    this.writePool = new Pool({
      ...config,
      max: config.max || 20,
      min: config.min || 5,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000
    });

    // Read pools (read replicas)
    this.readPools = (config.readReplicas || []).map(replicaUrl => 
      new Pool({
        ...config,
        connectionString: replicaUrl,
        max: Math.ceil((config.max || 20) / 2),
        min: Math.ceil((config.min || 5) / 2)
      })
    );

    // Health check for pools
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      config.healthCheckInterval || 30000
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.writePool.on('error', (err) => {
      console.error('Write pool error:', err);
      this.poolStats.writes.errors++;
    });

    this.readPools.forEach((pool, index) => {
      pool.on('error', (err) => {
        console.error(`Read pool ${index} error:`, err);
        this.poolStats.reads.errors++;
      });
    });
  }

  async query(sql: string, params?: any[], options: { preferRead?: boolean } = {}): Promise<any> {
    const { preferRead = this.isReadQuery(sql) } = options;
    
    if (preferRead && this.readPools.length > 0) {
      return this.executeReadQuery(sql, params);
    } else {
      return this.executeWriteQuery(sql, params);
    }
  }

  private async executeWriteQuery(sql: string, params?: any[]): Promise<any> {
    const start = Date.now();
    
    try {
      this.poolStats.writes.total++;
      const result = await this.writePool.query(sql, params);
      
      // Record metrics
      if (global.verbMetrics) {
        global.verbMetrics.observeHistogram(
          'database_query_duration_seconds',
          (Date.now() - start) / 1000,
          { pool: 'write', operation: this.getQueryType(sql) }
        );
      }
      
      return result;
    } catch (error) {
      this.poolStats.writes.errors++;
      
      if (global.verbMetrics) {
        global.verbMetrics.incrementCounter('database_errors_total', {
          pool: 'write',
          error_type: 'query_error'
        });
      }
      
      throw error;
    }
  }

  private async executeReadQuery(sql: string, params?: any[]): Promise<any> {
    const start = Date.now();
    
    // Round-robin load balancing for read replicas
    const poolIndex = this.poolStats.reads.total % this.readPools.length;
    const pool = this.readPools[poolIndex];
    
    try {
      this.poolStats.reads.total++;
      const result = await pool.query(sql, params);
      
      if (global.verbMetrics) {
        global.verbMetrics.observeHistogram(
          'database_query_duration_seconds',
          (Date.now() - start) / 1000,
          { pool: 'read', operation: this.getQueryType(sql) }
        );
      }
      
      return result;
    } catch (error) {
      this.poolStats.reads.errors++;
      
      if (global.verbMetrics) {
        global.verbMetrics.incrementCounter('database_errors_total', {
          pool: 'read',
          error_type: 'query_error'
        });
      }
      
      // Fallback to write pool on read replica failure
      console.warn(`Read replica failed, falling back to write pool:`, error);
      return this.executeWriteQuery(sql, params);
    }
  }

  private isReadQuery(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.startsWith('SELECT') || 
           trimmed.startsWith('WITH') ||
           trimmed.startsWith('SHOW') ||
           trimmed.startsWith('EXPLAIN');
  }

  private getQueryType(sql: string): string {
    const trimmed = sql.trim().toUpperCase();
    return trimmed.split(' ')[0].toLowerCase();
  }

  private async performHealthChecks(): Promise<void> {
    // Check write pool
    try {
      await this.writePool.query('SELECT 1');
    } catch (error) {
      console.error('Write pool health check failed:', error);
    }

    // Check read pools
    for (const [index, pool] of this.readPools.entries()) {
      try {
        await pool.query('SELECT 1');
      } catch (error) {
        console.error(`Read pool ${index} health check failed:`, error);
      }
    }
  }

  getPoolStats(): any {
    return {
      write: {
        ...this.poolStats.writes,
        totalConnections: this.writePool.totalCount,
        idleConnections: this.writePool.idleCount,
        waitingClients: this.writePool.waitingCount
      },
      read: this.readPools.map((pool, index) => ({
        index,
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      })),
      stats: this.poolStats
    };
  }

  async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.writePool.end();
    await Promise.all(this.readPools.map(pool => pool.end()));
  }
}
```

## Monitoring Auto-Scaling Events

### Scaling Event Tracking

```typescript
// Auto-scaling event monitoring
export class AutoScalingMonitor {
  private scalingEvents: Array<{
    timestamp: number;
    type: 'scale_up' | 'scale_down';
    reason: string;
    beforeCount: number;
    afterCount: number;
    trigger: string;
  }> = [];

  recordScalingEvent(type: 'scale_up' | 'scale_down', reason: string, beforeCount: number, afterCount: number, trigger: string) {
    const event = {
      timestamp: Date.now(),
      type,
      reason,
      beforeCount,
      afterCount,
      trigger
    };

    this.scalingEvents.push(event);
    
    // Keep only last 100 events
    if (this.scalingEvents.length > 100) {
      this.scalingEvents.shift();
    }

    // Log the event
    console.log('Auto-scaling event:', JSON.stringify(event));

    // Send metrics
    if (global.verbMetrics) {
      global.verbMetrics.incrementCounter('autoscaling_events_total', {
        type,
        trigger
      });
    }

    // Send alert for rapid scaling
    this.checkRapidScaling();
  }

  private checkRapidScaling(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    const recentEvents = this.scalingEvents.filter(event => 
      event.timestamp > fiveMinutesAgo
    );

    if (recentEvents.length >= 3) {
      console.warn('Rapid auto-scaling detected:', {
        eventCount: recentEvents.length,
        timeWindow: '5 minutes',
        events: recentEvents
      });
    }
  }

  getScalingHistory(hours: number = 24): Array<any> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.scalingEvents.filter(event => event.timestamp > cutoff);
  }

  getScalingStats(): any {
    const stats = {
      totalEvents: this.scalingEvents.length,
      scaleUpEvents: 0,
      scaleDownEvents: 0,
      triggers: {} as Record<string, number>
    };

    this.scalingEvents.forEach(event => {
      if (event.type === 'scale_up') {
        stats.scaleUpEvents++;
      } else {
        stats.scaleDownEvents++;
      }

      stats.triggers[event.trigger] = (stats.triggers[event.trigger] || 0) + 1;
    });

    return stats;
  }
}
```

## Usage Examples

### Complete Horizontal Scaling Setup

```typescript
import { server } from 'verb';
import { serviceDiscoveryMiddleware } from './middleware/service-discovery';
import { distributedSessionMiddleware } from './middleware/session';
import { DatabaseConnectionManager } from './database/connection-manager';

const app = server.http();

// Service discovery setup
const { discovery, registerSelf } = serviceDiscoveryMiddleware(
  process.env.CONSUL_URL || 'localhost:8500'
);

// Distributed session management
app.use(distributedSessionMiddleware({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
}));

// Database connection with read replicas
const dbManager = new DatabaseConnectionManager({
  connectionString: process.env.DATABASE_URL,
  readReplicas: process.env.READ_REPLICA_URLS?.split(','),
  max: 20,
  min: 5
});

// Routes
app.get('/api/users', async (req, res) => {
  // This will use read replica if available
  const users = await dbManager.query('SELECT * FROM users');
  res.json(users.rows);
});

app.post('/api/users', async (req, res) => {
  // This will use write pool
  const result = await dbManager.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [req.body.name, req.body.email]
  );
  res.json(result.rows[0]);
});

// Start server and register with service discovery
const port = parseInt(process.env.PORT || '3000');
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  
  // Register with service discovery
  await registerSelf(port, ['http', 'websocket']);
  
  console.log('Service registered with discovery');
});
```

## Best Practices

### 1. **Gradual Scaling**
- Implement gradual scaling policies to avoid thundering herd
- Use stabilization windows to prevent rapid scale up/down
- Monitor scaling patterns and adjust thresholds

### 2. **Health Checks**
- Implement comprehensive health checks for auto-scaling
- Use different health check endpoints for different purposes
- Include dependency health in scaling decisions

### 3. **Session Management**
- Use distributed session stores for stateful applications
- Implement session replication strategies
- Consider using JWT tokens for stateless authentication

### 4. **Database Scaling**
- Use read replicas to distribute read load
- Implement connection pooling with proper sizing
- Monitor database performance and scaling needs

### 5. **Monitoring**
- Track auto-scaling events and patterns
- Monitor application performance during scaling
- Set up alerts for scaling anomalies

This comprehensive horizontal scaling guide provides enterprise-ready strategies for scaling Verb applications across different deployment environments with proper monitoring and observability.