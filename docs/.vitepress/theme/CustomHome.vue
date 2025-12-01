<template>
  <Layout>
    <template v-if="isHomePage" #home-hero-before>
      <!-- Custom Hero Section -->
      <div class="custom-hero-section">
        <div class="hero-container">
          <!-- Left Column: Text Content -->
          <div class="hero-left">
            <h1 class="hero-title">{{ hero.name || 'Verb' }}</h1>
            <p class="hero-subtitle">{{ hero.text || 'Multi-Protocol Server Framework' }}</p>
            <p class="hero-tagline">{{ hero.tagline || 'Build HTTP, HTTP/2, WebSocket, gRPC, UDP, and TCP servers with the same intuitive API' }}</p>
            
            <div class="hero-actions" v-if="hero.actions">
              <a 
                v-for="action in hero.actions" 
                :key="action.text"
                :href="action.link"
                :class="['hero-button', `hero-button--${action.theme}`]"
              >
                {{ action.text }}
              </a>
            </div>
          </div>
          
          <!-- Right Column: Code Snippet -->
          <div class="hero-right">
            <div v-html="codeSnippet"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Hide default home elements -->
    <template v-if="isHomePage" #home-hero-info></template>
    <template v-if="isHomePage" #home-hero-image></template>
    <template v-if="isHomePage" #home-features-before>
      <!-- Custom Features Section -->
      <div class="custom-features-section" v-if="features && features.length">
        <div class="features-container">
          <div class="features-grid">
            <div class="feature-item" v-for="feature in features" :key="feature.title">
              <div class="feature-box">
                <div v-if="feature.icon" class="feature-icon">{{ feature.icon }}</div>
                <h3 class="feature-title">{{ feature.title }}</h3>
                <p class="feature-details">{{ feature.details }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-if="isHomePage" #home-features-after>
      <!-- Performance Metrics Section -->
      <div class="performance-metrics-section" v-if="performance && performance.length">
        <div class="performance-container">
          <div class="performance-header">
            <h2 class="performance-title">Proven Performance</h2>
            <p class="performance-subtitle">Benchmarked against leading frameworks with real-world scenarios</p>
          </div>
          <div class="performance-grid">
            <div class="performance-metric" v-for="metric in performance" :key="metric.label">
              <div class="metric-value">{{ metric.metric }}</div>
              <div class="metric-label">{{ metric.label }}</div>
              <div class="metric-description">{{ metric.description }}</div>
            </div>
          </div>
          <div class="benchmark-note">
            <p>Results from comprehensive benchmarks on Bun 1.0+ with 10,000 requests. <a href="/guide/performance" class="benchmark-link">View detailed benchmarks →</a></p>
          </div>
        </div>
      </div>
      <!-- Quick Start Section -->
      <div class="quick-start-section">
        <div class="quick-start-container">
          <div class="quick-start-content">
            <div class="quick-start-header">
              <h2 class="quick-start-title">Quick Start</h2>
              <p class="quick-start-subtitle">Get a fullstack Verb application running in 30 seconds:</p>
            </div>
            
            <div class="quick-start-grid">
              <!-- Left: Command -->
              <div class="quick-start-command">
                <div class="command-block">
                  <div class="command-header">
                    <span class="command-title">Create a new project</span>
                  </div>
                  <div class="command-code">
                    <pre><code>bunx create-verb my-app</code></pre>
                  </div>
                </div>
                
                <div class="command-block">
                  <div class="command-header">
                    <span class="command-title">Start developing</span>
                  </div>
                  <div class="command-code">
                    <pre><code>cd my-app
bun run dev</code></pre>
                  </div>
                </div>
                
                <div class="launch-info">
                  <p><strong>Visit <a href="http://localhost:3001" target="_blank">http://localhost:3001</a> to see your app! 🚀</strong></p>
                </div>
              </div>
              
              <!-- Right: What You Get -->
              <div class="quick-start-features">
                <h3 class="features-title">What You Get</h3>
                <ul class="features-list">
                  <li class="feature-item-list">
                    <span class="feature-icon-small">⚛️</span>
                    <strong>React Frontend</strong> with TypeScript and hot reloading
                  </li>
                  <li class="feature-item-list">
                    <span class="feature-icon-small">🔥</span>
                    <strong>REST API</strong> with CRUD examples (users, products)
                  </li>
                  <li class="feature-item-list">
                    <span class="feature-icon-small">🛠️</span>
                    <strong>Interactive API Explorer</strong> at <code>/api-demo</code>
                  </li>
                  <li class="feature-item-list">
                    <span class="feature-icon-small">⚡</span>
                    <strong>Verb's withRoutes</strong> pattern using Bun's native routing
                  </li>
                  <li class="feature-item-list">
                    <span class="feature-icon-small">📦</span>
                    <strong>Zero configuration</strong> - everything works out of the box
                  </li>
                </ul>
                
                <div class="tip-box">
                  <div class="tip-header">💡 Tip</div>
                  <p>Verb is built exclusively for Bun runtime. The <code>create-verb</code> tool downloads the latest boilerplate from <a href="https://github.com/verbjs/boilerplate" target="_blank">verbjs/boilerplate</a> and sets up everything automatically with Bun.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Layout>
</template>

<script setup>
import { computed } from 'vue'
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

const Layout = DefaultTheme.Layout

const { frontmatter } = useData()
const hero = frontmatter.value.hero || {}
const features = frontmatter.value.features || []
const performance = frontmatter.value.performance || []
const isHomePage = frontmatter.value.layout === 'home'

const codeSnippet = computed(() => {
  return `<div class="language-ts"><div class="language-id">ts</div><pre class="shiki material-theme-palenight"><code><span class="line"><span style="color:#C792EA">import</span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">{</span><span style="color:#A6ACCD"> server </span><span style="color:#89DDFF">}</span><span style="color:#A6ACCD"> </span><span style="color:#C792EA">from</span><span style="color:#A6ACCD"> </span><span style="color:#C3E88D">'verb'</span><span style="color:#89DDFF">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#C792EA">const</span><span style="color:#A6ACCD"> app </span><span style="color:#89DDFF">=</span><span style="color:#A6ACCD"> </span><span style="color:#82AAFF">server</span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">http</span><span style="color:#89DDFF">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#A6ACCD">app</span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">get</span><span style="color:#89DDFF">(</span><span style="color:#C3E88D">'/'</span><span style="color:#89DDFF">,</span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">(</span><span style="color:#A6ACCD">_req</span><span style="color:#89DDFF">,</span><span style="color:#A6ACCD"> res</span><span style="color:#89DDFF">)</span><span style="color:#A6ACCD"> </span><span style="color:#C792EA">=></span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">{</span></span>
<span class="line"><span style="color:#A6ACCD">  res</span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">json</span><span style="color:#89DDFF">(</span><span style="color:#89DDFF">{</span><span style="color:#A6ACCD"> message</span><span style="color:#89DDFF">:</span><span style="color:#A6ACCD"> </span><span style="color:#C3E88D">'Hello World!'</span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">}</span><span style="color:#89DDFF">);</span></span>
<span class="line"><span style="color:#89DDFF">}</span><span style="color:#89DDFF">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#A6ACCD">app</span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">listen</span><span style="color:#89DDFF">(</span><span style="color:#F78C6C">3000</span><span style="color:#89DDFF">);</span></span>
<span class="line"><span style="color:#A6ACCD">console</span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">log</span><span style="color:#89DDFF">(</span><span style="color:#C3E88D">'Server running on http://localhost:3000'</span><span style="color:#89DDFF">);</span></span></code></pre></div>`
})
</script>

<style>
/* Hide default VitePress hero and features on home page */
.VPHome .VPHero {
  display: none !important;
}

.VPHome .VPFeatures {
  display: none !important;
}

.custom-hero-section {
  padding: 64px 24px;
  background: var(--vp-c-bg);
}

.hero-container {
  max-width: 1152px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
}

/* Left Column - Text Content */
.hero-left {
  display: flex;
  flex-direction: column;
}

.hero-title {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 16px 0;
  background: var(--vp-home-hero-name-bg, linear-gradient(120deg, #bd34fe 30%, #41d1ff));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 8px 0;
  color: var(--vp-c-text-1);
}

.hero-tagline {
  font-size: 18px;
  line-height: 1.6;
  margin: 0 0 32px 0;
  color: var(--vp-c-text-2);
}

.hero-actions {
  display: flex;
  gap: 16px;
}

.hero-button {
  display: inline-block;
  border-radius: 20px;
  padding: 0 20px;
  line-height: 38px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  text-align: center;
  transition: all 0.25s;
}

.hero-button--brand {
  background: var(--vp-c-brand-1, #646cff);
  color: var(--vp-c-white, #ffffff);
}

.hero-button--brand:hover {
  background: var(--vp-c-brand-2, #747bff);
}

.hero-button--alt {
  background: var(--vp-c-bg-alt, #f6f6f7);
  color: var(--vp-c-text-1, #213547);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}

.hero-button--alt:hover {
  background: var(--vp-c-gray-light-4, #e5e5e5);
}

/* Right Column - Code Snippet */
.hero-right .language-ts {
  position: relative;
  background: var(--vp-code-block-bg, #1e1e1e);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}

.hero-right .language-id {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 12px;
  color: var(--vp-c-text-2, #888);
  font-weight: 500;
  z-index: 1;
}

.hero-right pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  font-size: 14px;
  line-height: 1.7;
  background: transparent;
}

.hero-right code {
  font-family: var(--vp-font-family-mono, 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace);
}

/* Features Section */
.custom-features-section {
  padding: 64px 24px;
}

.features-container {
  max-width: 1152px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.feature-item {
  height: 100%;
}

.feature-box {
  background: var(--vp-c-bg-soft, #f6f6f7);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 12px;
  padding: 24px;
  height: 100%;
  transition: border-color 0.25s;
}

.feature-box:hover {
  border-color: var(--vp-c-brand-1, #646cff);
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 16px;
}

.feature-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--vp-c-text-1, #213547);
}

.feature-details {
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
  color: var(--vp-c-text-2, #555);
}

/* Performance Metrics Section */
.performance-metrics-section {
  padding: 64px 24px;
  background: var(--vp-c-bg);
}

.performance-container {
  max-width: 1152px;
  margin: 0 auto;
}

.performance-header {
  text-align: center;
  margin-bottom: 48px;
}

.performance-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--vp-c-text-1);
}

.performance-subtitle {
  font-size: 18px;
  color: var(--vp-c-text-2);
  margin: 0;
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.performance-metric {
  background: linear-gradient(135deg, var(--vp-c-brand-1) 0%, var(--vp-c-brand-2) 100%);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  color: white;
  position: relative;
  overflow: hidden;
  transition: transform 0.25s ease;
}

.performance-metric:hover {
  transform: translateY(-4px);
}

.performance-metric::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
  pointer-events: none;
}

.metric-value {
  font-size: 36px;
  font-weight: 800;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.metric-label {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  opacity: 0.95;
}

.metric-description {
  font-size: 14px;
  line-height: 1.5;
  opacity: 0.85;
}

.benchmark-note {
  text-align: center;
  padding: 24px;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
}

.benchmark-note p {
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.benchmark-link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}

.benchmark-link:hover {
  text-decoration: underline;
}

/* Quick Start Section */
.quick-start-section {
  padding: 64px 24px;
  background: var(--vp-c-bg-alt, #f6f6f7);
  border-top: 1px solid var(--vp-c-divider, #e2e2e3);
}

.quick-start-container {
  max-width: 1152px;
  margin: 0 auto;
}

.quick-start-header {
  text-align: center;
  margin-bottom: 48px;
}

.quick-start-title {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: var(--vp-c-text-1);
}

.quick-start-subtitle {
  font-size: 18px;
  color: var(--vp-c-text-2);
  margin: 0;
}

.quick-start-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: start;
}

/* Left Column - Commands */
.quick-start-command {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.command-block {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.command-header {
  background: var(--vp-c-bg-soft);
  padding: 12px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.command-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.command-code {
  padding: 0;
}

.command-code pre {
  margin: 0;
  padding: 20px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  overflow-x: auto;
}

.command-code code {
  background: transparent;
  padding: 0;
  font-size: inherit;
  color: inherit;
}

.launch-info {
  text-align: center;
  margin-top: 8px;
}

.launch-info p {
  margin: 0;
  font-size: 16px;
}

.launch-info a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}

.launch-info a:hover {
  text-decoration: underline;
}

/* Right Column - Features */
.quick-start-features {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.features-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--vp-c-text-1);
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item-list {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  transition: border-color 0.25s;
}

.feature-item-list:hover {
  border-color: var(--vp-c-brand-1);
}

.feature-icon-small {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.feature-item-list strong {
  color: var(--vp-c-text-1);
}

.feature-item-list code {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
}

.tip-box {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand-soft);
  border-radius: 12px;
  padding: 20px;
  position: relative;
}

.tip-header {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin-bottom: 8px;
  font-size: 14px;
}

.tip-box p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.tip-box code {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
}

.tip-box a {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.tip-box a:hover {
  text-decoration: underline;
}

/* Responsive Design */
@media (max-width: 768px) {
  .hero-container {
    grid-template-columns: 1fr;
    gap: 32px;
    text-align: center;
  }
  
  .hero-title {
    font-size: 36px;
  }
  
  .hero-subtitle {
    font-size: 20px;
  }
  
  .hero-right pre {
    font-size: 12px;
    padding: 16px;
  }
  
  .quick-start-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  
  .quick-start-title {
    font-size: 28px;
  }
  
  .command-code pre {
    font-size: 13px;
    padding: 16px;
  }
}
</style>