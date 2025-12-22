# WebSocket

Verb provides native WebSocket support using Bun's built-in WebSocket server.

## Create WebSocket Server

```typescript
import { server } from "verb"

const ws = server.ws()

ws.on("connection", (socket) => {
  console.log("Client connected")

  socket.on("message", (data) => {
    console.log("Received:", data)
    socket.send(`Echo: ${data}`)
  })

  socket.on("close", () => {
    console.log("Client disconnected")
  })
})

ws.listen(3001)
```

## With HTTP Server

Run WebSocket alongside HTTP:

```typescript
import { server } from "verb"

const app = server.http()

app.get("/", (req, res) => {
  res.send("HTTP endpoint")
})

app.ws("/chat", {
  open(ws) {
    console.log("WebSocket connected")
  },
  message(ws, message) {
    ws.send(`Echo: ${message}`)
  },
  close(ws) {
    console.log("WebSocket closed")
  }
})

app.listen(3000)
```

## Broadcasting

Send messages to all connected clients:

```typescript
const clients = new Set()

app.ws("/chat", {
  open(ws) {
    clients.add(ws)
  },
  message(ws, message) {
    // Broadcast to all clients
    for (const client of clients) {
      client.send(message)
    }
  },
  close(ws) {
    clients.delete(ws)
  }
})
```

## Rooms / Channels

Organize clients into rooms:

```typescript
const rooms = new Map()

app.ws("/chat/:room", {
  open(ws, req) {
    const room = req.params.room
    if (!rooms.has(room)) {
      rooms.set(room, new Set())
    }
    rooms.get(room).add(ws)
    ws.data = { room }
  },
  message(ws, message) {
    const room = ws.data.room
    for (const client of rooms.get(room)) {
      client.send(message)
    }
  },
  close(ws) {
    const room = ws.data.room
    rooms.get(room)?.delete(ws)
  }
})
```

## Binary Data

```typescript
app.ws("/binary", {
  message(ws, message) {
    if (message instanceof ArrayBuffer) {
      // Handle binary data
      const bytes = new Uint8Array(message)
      ws.send(bytes)
    }
  }
})
```

## Client Example

```javascript
const ws = new WebSocket("ws://localhost:3000/chat")

ws.onopen = () => {
  ws.send("Hello!")
}

ws.onmessage = (event) => {
  console.log("Received:", event.data)
}
```
