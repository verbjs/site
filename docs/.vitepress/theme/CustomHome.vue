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
    <template v-if="isHomePage" #home-features-after></template>
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
const isHomePage = frontmatter.value.layout === 'home'

const codeSnippet = computed(() => {
  return `<div class="language-ts"><div class="language-id">ts</div><pre class="shiki material-theme-palenight"><code><span class="line"><span style="color:#C792EA">import</span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">{</span><span style="color:#A6ACCD"> verb </span><span style="color:#89DDFF">}</span><span style="color:#A6ACCD"> </span><span style="color:#C792EA">from</span><span style="color:#A6ACCD"> </span><span style="color:#C3E88D">'verb'</span><span style="color:#89DDFF">;</span></span>
<span class="line"></span>
<span class="line"><span style="color:#C792EA">const</span><span style="color:#A6ACCD"> server </span><span style="color:#89DDFF">=</span><span style="color:#A6ACCD"> </span><span style="color:#82AAFF">verb</span><span style="color:#89DDFF">()</span></span>
<span class="line"><span style="color:#A6ACCD">  </span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">get</span><span style="color:#89DDFF">(</span><span style="color:#C3E88D">'/'</span><span style="color:#89DDFF">,</span><span style="color:#A6ACCD"> </span><span style="color:#89DDFF">()</span><span style="color:#A6ACCD"> </span><span style="color:#C792EA">=></span><span style="color:#A6ACCD"> </span><span style="color:#C792EA">new</span><span style="color:#A6ACCD"> </span><span style="color:#FFCB6B">Response</span><span style="color:#89DDFF">(</span><span style="color:#C3E88D">'Hello World!'</span><span style="color:#89DDFF">))</span></span>
<span class="line"><span style="color:#A6ACCD">  </span><span style="color:#89DDFF">.</span><span style="color:#82AAFF">listen</span><span style="color:#89DDFF">(</span><span style="color:#F78C6C">3000</span><span style="color:#89DDFF">);</span></span>
<span class="line"></span>
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
}
</style>