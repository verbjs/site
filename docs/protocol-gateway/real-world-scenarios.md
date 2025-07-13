# Real-World Protocol Switching Scenarios

Comprehensive guide to practical protocol switching scenarios where Verb's Protocol Gateway provides significant value in production environments.

## Overview

Protocol switching allows applications to dynamically change communication protocols at runtime, enabling flexible architectures that can adapt to different requirements, client capabilities, and network conditions. This guide explores real-world scenarios where protocol switching provides tangible benefits.

## Scenario 1: Progressive Web Application (PWA)

### Use Case: Adaptive Communication Based on Network Conditions

A progressive web application that needs to handle various network conditions and device capabilities.

```typescript
import { createProtocolGateway, ServerProtocol } from 'verb';

class AdaptivePWAServer {
  private gateway = createProtocolGateway();
  private networkConditions = new Map<string, 'fast' | 'slow' | 'unstable'>();

  constructor() {
    this.setupRoutes();
    this.setupNetworkMonitoring();
  }

  private setupRoutes() {
    this.gateway.defineRoutes((app) => {
      // Detect client capabilities and network conditions
      app.get('/api/connect', async (req, res) => {
        const clientInfo = this.analyzeClient(req);
        const protocol = this.selectOptimalProtocol(clientInfo);
        
        res.json({
          recommendedProtocol: protocol,
          endpoints: {
            websocket: `ws://localhost:3001/ws`,
            sse: `http://localhost:3000/sse`,
            polling: `http://localhost:3000/api/poll`
          },
          capabilities: clientInfo
        });
      });

      // Data synchronization endpoint that adapts to protocol
      app.get('/api/sync/:clientId', async (req, res) => {
        const clientId = req.params.clientId;
        const networkCondition = this.networkConditions.get(clientId) || 'fast';
        
        switch (networkCondition) {
          case 'fast':
            // Use WebSocket for real-time bidirectional sync
            this.switchToWebSocket(clientId);
            res.json({ syncMode: 'realtime', protocol: 'websocket' });
            break;
            
          case 'slow':
            // Use HTTP/2 with server push for efficient updates
            this.switchToHttp2(clientId);
            res.json({ syncMode: 'push', protocol: 'http2' });
            break;
            
          case 'unstable':
            // Use HTTP polling with longer intervals
            this.switchToHttp(clientId);
            res.json({ syncMode: 'polling', protocol: 'http', interval: 30000 });
            break;
        }
      });
    });
  }

  private analyzeClient(req: any) {
    const userAgent = req.headers['user-agent'] || '';
    const connection = req.headers.connection || '';
    const acceptEncoding = req.headers['accept-encoding'] || '';
    
    return {
      supportsWebSocket: connection.includes('Upgrade'),
      supportsHttp2: req.httpVersionMajor >= 2,
      supportsCompression: acceptEncoding.includes('gzip'),
      isMobile: /Mobile|Android|iPhone/.test(userAgent),
      bandwidth: this.estimateBandwidth(req)
    };
  }

  private selectOptimalProtocol(clientInfo: any): string {
    if (clientInfo.supportsWebSocket && clientInfo.bandwidth > 1000) {
      return 'websocket';
    } else if (clientInfo.supportsHttp2) {
      return 'http2';
    } else {
      return 'http';
    }
  }

  private async switchToWebSocket(clientId: string) {
    const wsServer = this.gateway.switchProtocol(ServerProtocol.WEBSOCKET);
    await this.gateway.listen(3001);
    
    // Setup WebSocket handlers for this client
    wsServer.on('connection', (ws: any) => {
      ws.clientId = clientId;
      this.setupRealtimeSync(ws);
    });
  }

  private async switchToHttp2(clientId: string) {
    this.gateway.switchProtocol(ServerProtocol.HTTP2);
    await this.gateway.listen(3002);
    
    // HTTP/2 server push implementation
    this.setupServerPush(clientId);
  }

  private async switchToHttp(clientId: string) {
    this.gateway.switchProtocol(ServerProtocol.HTTP);
    await this.gateway.listen(3000);
    
    // Long polling implementation
    this.setupLongPolling(clientId);
  }

  private setupNetworkMonitoring() {
    // Monitor network conditions and adjust protocols accordingly
    setInterval(() => {
      this.networkConditions.forEach((condition, clientId) => {
        const newCondition = this.measureNetworkCondition(clientId);
        if (newCondition !== condition) {
          this.networkConditions.set(clientId, newCondition);
          this.notifyProtocolChange(clientId, newCondition);
        }
      });
    }, 30000); // Check every 30 seconds
  }
}
```

### Benefits:
- **Optimal Performance**: Automatically selects best protocol for each client
- **Battery Efficiency**: Reduces mobile battery usage with appropriate protocols
- **Bandwidth Optimization**: Adapts to network conditions
- **Graceful Degradation**: Falls back to simpler protocols when needed

## Scenario 2: IoT Gateway with Mixed Device Types

### Use Case: Industrial IoT System with Heterogeneous Devices

An industrial IoT gateway that needs to communicate with various device types using different protocols.

```typescript
import { createProtocolGateway, ServerProtocol } from 'verb';

class IoTProtocolGateway {
  private gateway = createProtocolGateway();
  private deviceRegistry = new Map<string, DeviceProfile>();
  private protocolServers = new Map<ServerProtocol, any>();

  async initialize() {
    // Start multiple protocol servers simultaneously
    await this.startMultiProtocolServers();
    this.setupDeviceRouting();
    this.setupProtocolBridging();
  }

  private async startMultiProtocolServers() {
    // HTTP for modern smart devices
    const httpServer = this.gateway.getServer(ServerProtocol.HTTP);
    await this.gateway.listen(8080, 'localhost', ServerProtocol.HTTP);
    this.protocolServers.set(ServerProtocol.HTTP, httpServer);

    // TCP for industrial PLCs and legacy systems
    const tcpServer = this.gateway.getServer(ServerProtocol.TCP);
    await this.gateway.listen(8081, 'localhost', ServerProtocol.TCP);
    this.protocolServers.set(ServerProtocol.TCP, tcpServer);

    // UDP for high-frequency sensor data
    const udpServer = this.gateway.getServer(ServerProtocol.UDP);
    await this.gateway.listen(8082, 'localhost', ServerProtocol.UDP);
    this.protocolServers.set(ServerProtocol.UDP, udpServer);

    // WebSocket for real-time dashboards
    const wsServer = this.gateway.getServer(ServerProtocol.WEBSOCKET);
    await this.gateway.listen(8083, 'localhost', ServerProtocol.WEBSOCKET);
    this.protocolServers.set(ServerProtocol.WEBSOCKET, wsServer);
  }

  private setupDeviceRouting() {
    // HTTP routes for smart devices
    const httpServer = this.protocolServers.get(ServerProtocol.HTTP);
    httpServer?.post('/api/devices/:id/data', (req: any, res: any) => {
      const deviceId = req.params.id;
      const deviceProfile = this.deviceRegistry.get(deviceId);
      
      if (deviceProfile?.protocol === 'http') {
        this.processDeviceData(deviceId, req.body, 'http');
        res.json({ status: 'received', timestamp: Date.now() });
      } else {
        // Route to appropriate protocol
        this.routeToCorrectProtocol(deviceId, req.body);
        res.json({ status: 'routed', protocol: deviceProfile?.protocol });
      }
    });

    // TCP handler for industrial devices
    const tcpServer = this.protocolServers.get(ServerProtocol.TCP);
    tcpServer?.on('data', (data: Buffer, clientInfo: any) => {
      const deviceId = this.extractDeviceId(data);
      const parsedData = this.parseIndustrialProtocol(data);
      this.processDeviceData(deviceId, parsedData, 'tcp');
    });

    // UDP handler for sensor telemetry
    const udpServer = this.protocolServers.get(ServerProtocol.UDP);
    udpServer?.on('message', (data: Buffer, remote: any) => {
      const sensorData = this.parseSensorTelemetry(data);
      this.processHighFrequencyData(sensorData, remote);
    });

    // WebSocket for real-time monitoring
    const wsServer = this.protocolServers.get(ServerProtocol.WEBSOCKET);
    wsServer?.on('connection', (ws: any) => {
      this.setupRealtimeMonitoring(ws);
    });
  }

  private setupProtocolBridging() {
    // Bridge between different protocols for device interoperability
    this.gateway.defineRoutes((app) => {
      // Command routing endpoint
      app.post('/api/command/:deviceId', async (req, res) => {
        const deviceId = req.params.deviceId;
        const command = req.body;
        const device = this.deviceRegistry.get(deviceId);

        if (!device) {
          return res.status(404).json({ error: 'Device not found' });
        }

        try {
          const result = await this.sendCommandViaProtocol(device, command);
          res.json({ success: true, result });
        } catch (error) {
          res.status(500).json({ error: 'Command failed', details: error });
        }
      });

      // Protocol conversion endpoint
      app.post('/api/convert/:fromProtocol/:toProtocol', (req, res) => {
        const { fromProtocol, toProtocol } = req.params;
        const data = req.body;
        
        try {
          const convertedData = this.convertProtocolData(data, fromProtocol, toProtocol);
          res.json({ converted: convertedData, format: toProtocol });
        } catch (error) {
          res.status(400).json({ error: 'Conversion failed', details: error });
        }
      });
    });
  }

  private async sendCommandViaProtocol(device: DeviceProfile, command: any) {
    switch (device.protocol) {
      case 'http':
        return await this.sendHttpCommand(device, command);
      case 'tcp':
        return await this.sendTcpCommand(device, command);
      case 'udp':
        return await this.sendUdpCommand(device, command);
      default:
        throw new Error(`Unsupported device protocol: ${device.protocol}`);
    }
  }

  private convertProtocolData(data: any, from: string, to: string): any {
    // Protocol-specific data conversion logic
    const converter = this.getProtocolConverter(from, to);
    return converter.convert(data);
  }
}

interface DeviceProfile {
  id: string;
  type: 'sensor' | 'actuator' | 'controller' | 'gateway';
  protocol: 'http' | 'tcp' | 'udp' | 'websocket';
  address: string;
  port: number;
  capabilities: string[];
  dataFormat: 'json' | 'binary' | 'modbus' | 'custom';
}
```

### Benefits:
- **Protocol Interoperability**: Seamlessly bridges different device protocols
- **Legacy Integration**: Supports older industrial devices alongside modern IoT
- **Scalable Architecture**: Handles multiple protocols simultaneously
- **Centralized Management**: Single point of control for heterogeneous devices

## Scenario 3: Gaming Platform with Dynamic Requirements

### Use Case: Multiplayer Game Server with Varying Game Types

A gaming platform that hosts different types of games with varying latency and throughput requirements.

```typescript
import { createProtocolGateway, ServerProtocol } from 'verb';

class GameServerGateway {
  private gateway = createProtocolGateway();
  private gameRooms = new Map<string, GameRoom>();
  private playerConnections = new Map<string, PlayerConnection>();

  async start() {
    this.setupGameProtocols();
    this.setupPlayerMatching();
    this.setupProtocolSwitching();
  }

  private setupGameProtocols() {
    this.gateway.defineRoutes((app) => {
      // Game type selection and protocol recommendation
      app.post('/api/games/join', async (req, res) => {
        const { gameType, playerId, preferences } = req.body;
        const optimalProtocol = this.selectGameProtocol(gameType, preferences);
        
        const gameRoom = await this.findOrCreateGameRoom(gameType, optimalProtocol);
        const connectionInfo = await this.setupPlayerConnection(playerId, gameRoom);
        
        res.json({
          roomId: gameRoom.id,
          protocol: optimalProtocol,
          connectionInfo,
          gameType
        });
      });

      // Dynamic protocol switching during gameplay
      app.post('/api/games/:roomId/switch-protocol', async (req, res) => {
        const { roomId } = req.params;
        const { newProtocol, reason } = req.body;
        
        const gameRoom = this.gameRooms.get(roomId);
        if (!gameRoom) {
          return res.status(404).json({ error: 'Game room not found' });
        }

        try {
          await this.switchGameProtocol(gameRoom, newProtocol, reason);
          res.json({ success: true, newProtocol, timestamp: Date.now() });
        } catch (error) {
          res.status(500).json({ error: 'Protocol switch failed', details: error });
        }
      });
    });
  }

  private selectGameProtocol(gameType: string, preferences: any): ServerProtocol {
    const gameRequirements = this.getGameRequirements(gameType);
    
    switch (gameType) {
      case 'fps': // First-person shooter - ultra-low latency required
        if (preferences.prioritizePing && gameRequirements.maxLatency < 16) {
          return ServerProtocol.UDP; // Fastest, allows packet loss
        }
        return ServerProtocol.WEBSOCKET; // Reliable, still fast

      case 'rts': // Real-time strategy - moderate latency, high reliability
        return ServerProtocol.WEBSOCKET; // Good balance of speed and reliability

      case 'turn-based': // Turn-based games - latency less critical
        return ServerProtocol.HTTP; // Simple, cacheable, works everywhere

      case 'mmo': // Massively multiplayer - mixed requirements
        return ServerProtocol.HTTP2; // Efficient for many simultaneous connections

      case 'racing': // Racing games - consistent low latency
        return ServerProtocol.UDP; // Prioritize speed over reliability

      default:
        return ServerProtocol.WEBSOCKET; // Safe default
    }
  }

  private async switchGameProtocol(gameRoom: GameRoom, newProtocol: ServerProtocol, reason: string) {
    console.log(`Switching game room ${gameRoom.id} from ${gameRoom.protocol} to ${newProtocol}. Reason: ${reason}`);

    // Notify all players of protocol switch
    await this.notifyPlayersOfSwitch(gameRoom, newProtocol);

    // Migrate game state
    const gameState = await this.captureGameState(gameRoom);

    // Switch the protocol
    const newServer = this.gateway.switchProtocol(newProtocol);
    const newPort = this.getPortForProtocol(newProtocol);
    await this.gateway.listen(newPort);

    // Restore game state on new protocol
    await this.restoreGameState(gameRoom, gameState, newProtocol);

    // Update room protocol
    gameRoom.protocol = newProtocol;
    gameRoom.server = newServer;

    // Reconnect players
    await this.reconnectPlayersToNewProtocol(gameRoom);
  }

  private async handleDynamicProtocolSwitching() {
    // Monitor game performance and switch protocols as needed
    setInterval(async () => {
      for (const [roomId, gameRoom] of this.gameRooms) {
        const metrics = await this.analyzeGameMetrics(gameRoom);
        
        if (this.shouldSwitchProtocol(gameRoom, metrics)) {
          const newProtocol = this.recommendProtocolSwitch(gameRoom, metrics);
          await this.switchGameProtocol(gameRoom, newProtocol, metrics.reason);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private shouldSwitchProtocol(gameRoom: GameRoom, metrics: GameMetrics): boolean {
    // Switch conditions based on performance metrics
    return (
      metrics.averageLatency > gameRoom.requirements.maxLatency ||
      metrics.packetLoss > gameRoom.requirements.maxPacketLoss ||
      metrics.connectionErrors > 5 ||
      metrics.bandwidthSaturation > 0.8
    );
  }

  private recommendProtocolSwitch(gameRoom: GameRoom, metrics: GameMetrics): ServerProtocol {
    if (metrics.packetLoss > 0.01) {
      // High packet loss - switch to reliable protocol
      return ServerProtocol.WEBSOCKET;
    }
    
    if (metrics.averageLatency > 100) {
      // High latency - try UDP for speed
      return ServerProtocol.UDP;
    }
    
    if (metrics.bandwidthSaturation > 0.8) {
      // Bandwidth issues - use HTTP/2 for efficiency
      return ServerProtocol.HTTP2;
    }
    
    return gameRoom.protocol; // No change needed
  }

  private async setupAdaptiveGameplay() {
    // Adaptive protocol selection based on network conditions
    this.gateway.defineRoutes((app) => {
      app.post('/api/games/adaptive-join', async (req, res) => {
        const { gameType, playerId, networkInfo } = req.body;
        
        // Test different protocols to find the best one
        const protocolTests = await this.runProtocolTests(networkInfo);
        const bestProtocol = this.selectBestProtocol(protocolTests, gameType);
        
        const gameRoom = await this.findOrCreateGameRoom(gameType, bestProtocol);
        const connectionInfo = await this.setupPlayerConnection(playerId, gameRoom);
        
        res.json({
          roomId: gameRoom.id,
          protocol: bestProtocol,
          connectionInfo,
          testResults: protocolTests,
          adaptiveMode: true
        });
      });
    });
  }
}

interface GameRoom {
  id: string;
  gameType: string;
  protocol: ServerProtocol;
  server: any;
  players: string[];
  requirements: GameRequirements;
  state: any;
}

interface GameRequirements {
  maxLatency: number; // milliseconds
  maxPacketLoss: number; // percentage
  minBandwidth: number; // kbps
  reliabilityRequired: boolean;
}

interface GameMetrics {
  averageLatency: number;
  packetLoss: number;
  connectionErrors: number;
  bandwidthSaturation: number;
  reason: string;
}

interface PlayerConnection {
  playerId: string;
  protocol: ServerProtocol;
  connection: any;
  gameRoomId: string;
  metrics: ConnectionMetrics;
}

interface ConnectionMetrics {
  latency: number;
  packetLoss: number;
  bandwidth: number;
  stability: number;
}
```

### Benefits:
- **Optimized Performance**: Each game type uses the most appropriate protocol
- **Dynamic Adaptation**: Switches protocols based on real-time conditions
- **Player Experience**: Maintains optimal gameplay under varying network conditions
- **Resource Efficiency**: Uses bandwidth and server resources efficiently

## Scenario 4: API Gateway with Content-Type Adaptation

### Use Case: Enterprise API Gateway with Multi-Format Support

An enterprise API gateway that serves different content formats and protocols based on client requirements.

```typescript
import { createProtocolGateway, ServerProtocol } from 'verb';

class EnterpriseAPIGateway {
  private gateway = createProtocolGateway();
  private serviceRegistry = new Map<string, ServiceEndpoint>();
  private clientProfiles = new Map<string, ClientProfile>();

  async initialize() {
    this.setupContentNegotiation();
    this.setupProtocolAdaptation();
    this.setupServiceDiscovery();
  }

  private setupContentNegotiation() {
    this.gateway.defineRoutes((app) => {
      // Content-aware routing
      app.all('/api/*', async (req, res, next) => {
        const clientProfile = await this.identifyClient(req);
        const contentType = req.headers['content-type'] || 'application/json';
        const acceptType = req.headers['accept'] || 'application/json';
        
        // Determine optimal protocol based on content and client
        const optimalProtocol = this.selectProtocolForContent(contentType, acceptType, clientProfile);
        
        if (this.gateway.getCurrentProtocol() !== optimalProtocol) {
          await this.switchToOptimalProtocol(optimalProtocol, req, res);
        } else {
          next();
        }
      });

      // GraphQL endpoint - uses WebSocket for subscriptions
      app.post('/graphql', async (req, res) => {
        if (req.body?.query?.includes('subscription')) {
          // Switch to WebSocket for GraphQL subscriptions
          await this.handleGraphQLSubscription(req, res);
        } else {
          // Regular HTTP for queries and mutations
          await this.handleGraphQLOperation(req, res);
        }
      });

      // File upload endpoint - switches based on file size
      app.post('/api/upload', async (req, res) => {
        const contentLength = parseInt(req.headers['content-length'] || '0');
        
        if (contentLength > 100 * 1024 * 1024) { // 100MB
          // Large files - use HTTP/2 for better streaming
          await this.handleLargeFileUpload(req, res);
        } else {
          // Small files - regular HTTP is fine
          await this.handleRegularUpload(req, res);
        }
      });

      // Real-time data endpoint - protocol based on frequency
      app.get('/api/data/stream/:frequency', async (req, res) => {
        const frequency = parseInt(req.params.frequency);
        
        if (frequency > 10) { // More than 10 updates per second
          await this.handleHighFrequencyStream(req, res);
        } else if (frequency > 1) { // 1-10 updates per second
          await this.handleMediumFrequencyStream(req, res);
        } else {
          await this.handleLowFrequencyStream(req, res);
        }
      });
    });
  }

  private selectProtocolForContent(contentType: string, acceptType: string, client: ClientProfile): ServerProtocol {
    // Binary content optimization
    if (contentType.includes('application/octet-stream') || 
        contentType.includes('multipart/form-data')) {
      return ServerProtocol.HTTP2; // Better for binary data
    }

    // Real-time content
    if (acceptType.includes('text/event-stream')) {
      return ServerProtocol.HTTP; // Server-Sent Events
    }

    // WebSocket upgrade requests
    if (contentType.includes('application/websocket')) {
      return ServerProtocol.WEBSOCKET;
    }

    // High-frequency APIs
    if (client.requestFrequency > 100) { // requests per minute
      return ServerProtocol.HTTP2; // More efficient for high frequency
    }

    // Mobile clients
    if (client.deviceType === 'mobile') {
      return ServerProtocol.HTTP; // Better battery life
    }

    // Default
    return ServerProtocol.HTTP;
  }

  private async handleGraphQLSubscription(req: any, res: any) {
    // Switch to WebSocket for GraphQL subscriptions
    const wsServer = this.gateway.switchProtocol(ServerProtocol.WEBSOCKET);
    
    // Set up WebSocket GraphQL subscription handling
    res.json({
      subscriptionEndpoint: 'ws://localhost:4000/graphql',
      protocol: 'websocket-graphql',
      subprotocol: 'graphql-ws'
    });
  }

  private async handleHighFrequencyStream(req: any, res: any) {
    // Use UDP for high-frequency data streams
    const udpServer = this.gateway.switchProtocol(ServerProtocol.UDP);
    
    res.json({
      streamEndpoint: 'udp://localhost:5000',
      protocol: 'udp',
      format: 'binary',
      note: 'High frequency data stream via UDP'
    });
  }

  private async handleLargeFileUpload(req: any, res: any) {
    // Switch to HTTP/2 for better large file handling
    this.gateway.switchProtocol(ServerProtocol.HTTP2);
    
    // HTTP/2 specific upload handling
    res.json({
      uploadUrl: 'https://localhost:8443/upload/large',
      protocol: 'http2',
      features: ['multiplexing', 'server-push', 'header-compression']
    });
  }

  private async setupServiceDiscovery() {
    this.gateway.defineRoutes((app) => {
      // Service discovery endpoint
      app.get('/api/discover', (req, res) => {
        const services = Array.from(this.serviceRegistry.values());
        const clientProfile = this.clientProfiles.get(req.headers['x-client-id'] as string);
        
        // Filter services based on client capabilities
        const compatibleServices = services.filter(service => 
          this.isServiceCompatible(service, clientProfile)
        );
        
        res.json({
          services: compatibleServices,
          protocols: this.gateway.getAvailableProtocols(),
          recommendations: this.getProtocolRecommendations(clientProfile)
        });
      });

      // Protocol capability testing
      app.get('/api/test-protocols', async (req, res) => {
        const testResults = await this.runProtocolCapabilityTests(req);
        
        res.json({
          testResults,
          recommendations: this.analyzeTestResults(testResults),
          supportedProtocols: this.getSupportedProtocols(testResults)
        });
      });
    });
  }

  private isServiceCompatible(service: ServiceEndpoint, client?: ClientProfile): boolean {
    if (!client) return true;
    
    return (
      service.supportedProtocols.some(p => client.supportedProtocols.includes(p)) &&
      service.minBandwidth <= client.bandwidth &&
      (!service.requiresSecure || client.supportsSSL)
    );
  }

  private getProtocolRecommendations(client?: ClientProfile): ProtocolRecommendation[] {
    if (!client) return [];
    
    const recommendations: ProtocolRecommendation[] = [];
    
    if (client.deviceType === 'mobile') {
      recommendations.push({
        protocol: ServerProtocol.HTTP,
        reason: 'Better battery life on mobile devices',
        priority: 'high'
      });
    }
    
    if (client.bandwidth > 10000) { // 10 Mbps
      recommendations.push({
        protocol: ServerProtocol.HTTP2,
        reason: 'High bandwidth allows HTTP/2 benefits',
        priority: 'medium'
      });
    }
    
    if (client.supportsWebSocket && client.needsRealtime) {
      recommendations.push({
        protocol: ServerProtocol.WEBSOCKET,
        reason: 'Real-time requirements met with WebSocket',
        priority: 'high'
      });
    }
    
    return recommendations;
  }
}

interface ServiceEndpoint {
  id: string;
  name: string;
  supportedProtocols: ServerProtocol[];
  minBandwidth: number;
  requiresSecure: boolean;
  contentTypes: string[];
}

interface ClientProfile {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'server';
  supportedProtocols: ServerProtocol[];
  bandwidth: number; // kbps
  supportsSSL: boolean;
  supportsWebSocket: boolean;
  needsRealtime: boolean;
  requestFrequency: number; // requests per minute
}

interface ProtocolRecommendation {
  protocol: ServerProtocol;
  reason: string;
  priority: 'low' | 'medium' | 'high';
}
```

### Benefits:
- **Content Optimization**: Selects protocols based on data types and sizes
- **Client Adaptation**: Adapts to different client capabilities automatically
- **Bandwidth Efficiency**: Optimizes protocol choice for available bandwidth
- **Service Discovery**: Provides intelligent service and protocol discovery

## Summary

These real-world scenarios demonstrate the practical value of protocol switching in production environments:

1. **Performance Optimization**: Dynamically selecting the best protocol for current conditions
2. **Device Compatibility**: Adapting to different client capabilities and limitations
3. **Resource Efficiency**: Using appropriate protocols to minimize bandwidth and processing
4. **User Experience**: Maintaining optimal performance under varying conditions
5. **Legacy Integration**: Bridging different protocols for seamless interoperability

Protocol switching shines in environments where:
- Network conditions vary significantly
- Different client types need to be supported
- Performance requirements change dynamically
- Multiple communication patterns coexist
- Legacy systems need integration with modern protocols

The key to successful protocol switching is understanding the trade-offs and having clear criteria for when and how to switch protocols based on measurable conditions and requirements.