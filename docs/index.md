---
layout: page
---

<div class="landing">

<div class="hero">
  <h1>Verb Ecosystem</h1>
  <p class="tagline">Bun-first libraries for building fast, modern applications</p>
</div>

<div class="packages">
  <a href="/verb/" class="package">
    <div class="package-header">
      <span class="icon">⚡</span>
      <h2>Verb</h2>
    </div>
    <p class="desc">Multi-protocol server framework</p>
    <p class="detail">HTTP, WebSocket, gRPC, TCP, UDP — one unified API for all protocols.</p>
    <code>bun add verb</code>
  </a>

  <a href="/hull/" class="package">
    <div class="package-header">
      <span class="icon">🗄️</span>
      <h2>Hull</h2>
    </div>
    <p class="desc">Functional database toolkit</p>
    <p class="detail">Ecto-inspired queries, changesets, and schema management for Bun.sql.</p>
    <code>bun add hull</code>
  </a>

  <a href="/allow/" class="package">
    <div class="package-header">
      <span class="icon">🔐</span>
      <h2>Allow</h2>
    </div>
    <p class="desc">Authentication library</p>
    <p class="detail">Passwords, JWT, OAuth, and API tokens with Verb middleware integration.</p>
    <code>bun add allow</code>
  </a>

  <a href="/hoist/" class="package">
    <div class="package-header">
      <span class="icon">🚀</span>
      <h2>Hoist</h2>
    </div>
    <p class="desc">Self-hosted PaaS</p>
    <p class="detail">Deploy apps, manage databases, and storage on your own infrastructure.</p>
    <code>bun add -g @hoist/cli</code>
  </a>
</div>

<div class="principles">
  <div class="principle">
    <strong>Bun-Native</strong>
    <span>Built for Bun. No Node.js compat layer.</span>
  </div>
  <div class="principle">
    <strong>Functional</strong>
    <span>No classes. Pure composable functions.</span>
  </div>
  <div class="principle">
    <strong>Type-Safe</strong>
    <span>Full TypeScript inference throughout.</span>
  </div>
  <div class="principle">
    <strong>Minimal</strong>
    <span>Small APIs. Learn fast, ship faster.</span>
  </div>
</div>

<div class="example">
  <h3>Full Stack in 20 Lines</h3>

```typescript
import { server } from "verb"
import { connect, from, whereEq, one } from "hull"
import { createAllow, getMiddleware } from "allow"

const repo = connect({ url: process.env.DATABASE_URL })
const allow = createAllow({ secret: process.env.SECRET, strategies: [{ name: "jwt", type: "jwt", config: {} }] })
const { requireAuth } = getMiddleware(allow)

const app = server.http()

app.get("/api/users/:id", requireAuth, async (req, res) => {
  const user = await one(repo, whereEq(from(User), "id", req.params.id))
  res.json(user)
})

app.listen(3000)
```
</div>

<div class="cta">
  <a href="/verb/getting-started" class="btn primary">Get Started</a>
  <a href="https://github.com/verbjs" class="btn secondary">GitHub</a>
</div>

</div>

<style>
.landing {
  max-width: 1000px;
  margin: 0 auto;
  padding: 60px 24px;
}

.hero {
  text-align: center;
  margin-bottom: 60px;
}

.hero h1 {
  font-size: 48px;
  font-weight: 700;
  background: linear-gradient(120deg, #bd34fe 30%, #41d1ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 16px 0;
  padding: 8px 0;
  line-height: 1.3;
}

.hero .tagline {
  font-size: 20px;
  color: var(--vp-c-text-2);
  margin: 0;
}

.packages {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 48px;
}

@media (max-width: 640px) {
  .packages {
    grid-template-columns: 1fr;
  }
  .hero h1 {
    font-size: 36px;
  }
}

.package {
  display: block;
  padding: 28px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
}

.package:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}

.package-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.package .icon {
  font-size: 28px;
}

.package h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0;
}

.package .desc {
  font-size: 15px;
  font-weight: 500;
  color: var(--vp-c-brand);
  margin: 0 0 8px 0;
}

.package .detail {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.package code {
  display: inline-block;
  font-size: 13px;
  padding: 4px 10px;
  background: var(--vp-c-bg-mute);
  border-radius: 6px;
  color: var(--vp-c-text-2);
}

.principles {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 32px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 48px;
}

@media (max-width: 640px) {
  .principles {
    flex-wrap: wrap;
  }
  .principle {
    width: 45%;
  }
}

.principle {
  text-align: center;
}

.principle strong {
  display: block;
  font-size: 15px;
  color: var(--vp-c-text-1);
  margin-bottom: 4px;
}

.principle span {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.example {
  margin-bottom: 48px;
}

.example h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--vp-c-text-1);
}

.cta {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.btn {
  display: inline-block;
  padding: 12px 28px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s;
}

.btn.primary {
  background: var(--vp-c-brand);
  color: white;
}

.btn.primary:hover {
  background: var(--vp-c-brand-dark);
}

.btn.secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.btn.secondary:hover {
  border-color: var(--vp-c-brand);
}
</style>
