# Glossary

Definitions of key terms and concepts used in the Verb framework.

## A

### API Gateway
A server that acts as an entry point for microservices, routing requests to appropriate backend services. In Verb, the Protocol Gateway can serve this role across multiple protocols.

### Async/Await
Modern JavaScript pattern for handling asynchronous operations. Verb uses async/await throughout for cleaner, more readable code compared to callbacks or promise chains.

## B

### Bun
A fast JavaScript runtime, package manager, and bundler. Verb is built specifically for Bun to leverage its native APIs and performance optimizations.

### Binary Protocol
A communication protocol that transmits data in binary format rather than text. Examples include gRPC and custom TCP protocols that Verb supports.

## C

### Connection Pooling
A technique to maintain a cache of database connections to avoid the overhead of establishing new connections for each request. Verb supports connection pooling for all major databases.

### CORS (Cross-Origin Resource Sharing)
A browser security feature that controls which domains can access your API. Verb includes built-in CORS middleware for easy configuration.

### CQRS (Command Query Responsibility Segregation)
An architectural pattern that separates read and write operations. Verb's multi-protocol support makes CQRS implementations more flexible.

## D

### DNS (Domain Name System)
The system that translates domain names to IP addresses. Important for server deployment and client connections to your Verb applications.

### Dynamic Protocol Switching
Verb's ability to change communication protocols at runtime based on conditions like network state, client capabilities, or performance requirements.

## E

### Event Loop
The mechanism that handles asynchronous operations in JavaScript. Bun's event loop is optimized for performance, which Verb leverages.

### Express Compatibility
Verb's design philosophy to support most Express.js middleware and patterns, making migration easier for developers.

## F

### Framework
A software platform that provides a foundation for developing applications. Verb is a server framework that simplifies building multi-protocol applications.

### Functional Programming
A programming paradigm that emphasizes functions as first-class citizens. Verb encourages functional patterns over object-oriented approaches.

## G

### gRPC (gRPC Remote Procedure Calls)
A high-performance, language-agnostic RPC framework that uses Protocol Buffers. Verb provides native gRPC server support.

### Gateway Pattern
An architectural pattern where a single entry point manages multiple backend services or protocols. Verb's Protocol Gateway implements this pattern.

## H

### HTTP (HyperText Transfer Protocol)
The standard protocol for web communication. Verb supports HTTP/1.1 as its base protocol with full Express-style routing.

### HTTP/2
The second major version of HTTP that provides multiplexing, server push, and header compression. Verb supports HTTP/2 natively.

### HTTPS
HTTP over TLS/SSL encryption. Verb supports HTTPS with automatic certificate management options.

## I

### Idempotent
An operation that produces the same result whether performed once or multiple times. Important for HTTP methods like GET, PUT, and DELETE.

### IoT (Internet of Things)
Network of physical devices that communicate over the internet. Verb's UDP and TCP support makes it suitable for IoT applications.

## J

### JSON (JavaScript Object Notation)
A lightweight data interchange format. Verb includes built-in JSON parsing and serialization middleware.

### JWT (JSON Web Token)
A compact, URL-safe token format for securely transmitting information. Verb examples include JWT authentication patterns.

## L

### Load Balancing
Distributing incoming requests across multiple server instances. Verb applications can be load balanced using standard techniques.

### Latency
The time delay between a request and its response. Verb achieves sub-millisecond latency in optimal conditions.

## M

### Middleware
Functions that execute during the request/response cycle. Verb uses Express-compatible middleware for extensibility.

### Microservices
An architectural style that structures applications as a collection of loosely coupled services. Verb's multi-protocol support facilitates microservice communication.

### Multiplexing
The ability to send multiple streams of data over a single connection. HTTP/2 and WebSocket protocols in Verb support multiplexing.

## N

### Node.js
A JavaScript runtime built on Chrome's V8 engine. Verb is designed for Bun instead of Node.js for better performance.

### Non-blocking I/O
Asynchronous operations that don't block the execution thread. Both Bun and Verb are built around non-blocking I/O principles.

## P

### Protocol
A set of rules that defines how data is transmitted between systems. Verb supports multiple protocols: HTTP, HTTP/2, WebSocket, gRPC, UDP, and TCP.

### Protocol Gateway
Verb's core feature that allows switching between different communication protocols dynamically within the same application.

### Promise
A JavaScript object representing the eventual completion of an asynchronous operation. Verb uses Promises and async/await throughout.

## R

### REST (Representational State Transfer)
An architectural style for designing web APIs using standard HTTP methods. Verb excels at building RESTful APIs.

### Real-time Communication
Instant data exchange between client and server. Verb's WebSocket support enables real-time features like chat and live updates.

### Rate Limiting
Controlling the number of requests a client can make within a time window. Verb includes rate limiting middleware for API protection.

## S

### Server-Sent Events (SSE)
A standard for pushing data from server to client over HTTP. Verb supports SSE for real-time updates without WebSocket complexity.

### Streaming
Sending data in continuous chunks rather than waiting for complete processing. Verb supports streaming for file uploads and real-time data.

### Stateless
A design principle where servers don't store client state between requests. RESTful APIs built with Verb follow stateless principles.

## T

### TCP (Transmission Control Protocol)
A reliable, connection-oriented protocol for data transmission. Verb supports raw TCP servers for custom protocols.

### TLS/SSL (Transport Layer Security/Secure Sockets Layer)
Encryption protocols for secure communication. Verb supports TLS for HTTPS, WSS, and secure TCP connections.

### TypeScript
A typed superset of JavaScript that compiles to plain JavaScript. Verb is built with TypeScript and provides full type safety.

## U

### UDP (User Datagram Protocol)
A connectionless, lightweight protocol for fast data transmission. Verb supports UDP for applications requiring speed over reliability.

### Unified API
Verb's design philosophy of providing the same programming interface across different protocols, reducing learning curve and development time.

### URL Routing
The process of determining which code handles a particular URL request. Verb provides flexible routing with parameters and wildcards.

## V

### Verb Framework
The multi-protocol server framework for Bun that this glossary describes. Named for its focus on "action words" (verbs) like GET, POST, etc.

### Virtual Host
Running multiple domain names on a single server. Verb applications can handle multiple virtual hosts through routing configuration.

## W

### WebSocket
A protocol providing full-duplex communication over a single TCP connection. Verb includes native WebSocket server support.

### WSS (WebSocket Secure)
WebSocket over TLS encryption. Verb supports secure WebSocket connections for production applications.

## Common Acronyms

- **API**: Application Programming Interface
- **CRUD**: Create, Read, Update, Delete
- **CORS**: Cross-Origin Resource Sharing
- **DNS**: Domain Name System
- **gRPC**: gRPC Remote Procedure Calls
- **HTTP**: HyperText Transfer Protocol
- **HTTPS**: HTTP Secure
- **IoT**: Internet of Things
- **JSON**: JavaScript Object Notation
- **JWT**: JSON Web Token
- **REST**: Representational State Transfer
- **SSE**: Server-Sent Events
- **SSL**: Secure Sockets Layer
- **TCP**: Transmission Control Protocol
- **TLS**: Transport Layer Security
- **UDP**: User Datagram Protocol
- **URL**: Uniform Resource Locator
- **WSS**: WebSocket Secure

## Framework-Specific Terms

### Protocol Switching
The core Verb feature that allows changing communication protocols at runtime without restarting the server.

### createServer()
Verb's main function for creating server instances. Can accept a protocol parameter to specify the communication protocol.

### ServerProtocol
Enum containing all supported protocols: HTTP, HTTPS, HTTP2, HTTP2S, WEBSOCKET, WEBSOCKETS, GRPC, UDP, TCP, TLS, DTLS.

### createProtocolGateway()
Function that creates a Protocol Gateway instance capable of switching between multiple protocols dynamically.

### withRoutes()
Verb method for applying route definitions to servers, supporting functional programming patterns.

### VerbRequest/VerbResponse
TypeScript interfaces for request and response objects, extending standard HTTP interfaces with Verb-specific features.

## Performance Terms

### Benchmark
Standardized tests comparing framework performance. Verb consistently outperforms Express and matches/exceeds Fastify performance.

### Throughput
The number of requests a server can handle per unit time. Verb optimizes for high throughput across all supported protocols.

### Response Time
The time taken to complete a request-response cycle. Verb achieves sub-millisecond response times in optimal conditions.

### Memory Footprint
The amount of RAM a running application uses. Verb is optimized for minimal memory usage while maximizing performance.

---

**See Also:**
- [Getting Started Guide](/guide/getting-started)
- [API Reference](/api/)
- [Examples](/examples/)
- [FAQ](/faq)