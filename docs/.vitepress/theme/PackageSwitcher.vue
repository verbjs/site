<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const isOpen = ref(false)

const packages = [
  { name: 'Verb', path: '/verb/', icon: '⚡', description: 'HTTP Framework' },
  { name: 'Hull', path: '/hull/', icon: '🗄️', description: 'Database Toolkit' },
  { name: 'Allow', path: '/allow/', icon: '🔐', description: 'Authentication' },
  { name: 'Hoist', path: '/hoist/', icon: '🚀', description: 'PaaS Platform' },
  { name: 'Shelves', path: '/shelves/', icon: '📦', description: 'Object Storage' },
]

const currentPackage = computed(() => {
  const path = route.path
  return packages.find(p => path.startsWith(p.path)) || packages[0]
})

const toggle = () => {
  isOpen.value = !isOpen.value
}

const close = () => {
  isOpen.value = false
}
</script>

<template>
  <div class="package-switcher" @mouseleave="close">
    <button class="switcher-button" @click="toggle">
      <span class="icon">{{ currentPackage.icon }}</span>
      <span class="name">{{ currentPackage.name }}</span>
      <svg class="chevron" :class="{ open: isOpen }" viewBox="0 0 24 24" width="14" height="14">
        <path fill="currentColor" d="M7 10l5 5 5-5z"/>
      </svg>
    </button>
    <div class="dropdown" v-show="isOpen">
      <a
        v-for="pkg in packages"
        :key="pkg.path"
        :href="pkg.path"
        class="dropdown-item"
        :class="{ active: currentPackage.path === pkg.path }"
        @click="close"
      >
        <span class="item-icon">{{ pkg.icon }}</span>
        <div class="item-content">
          <span class="item-name">{{ pkg.name }}</span>
          <span class="item-desc">{{ pkg.description }}</span>
        </div>
      </a>
    </div>
  </div>
</template>

<style scoped>
.package-switcher {
  position: relative;
}

.switcher-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  transition: all 0.2s;
}

.switcher-button:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
}

.icon {
  font-size: 18px;
}

.chevron {
  transition: transform 0.2s;
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 220px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--vp-c-bg-soft);
}

.dropdown-item.active {
  background: var(--vp-c-brand-soft);
}

.item-icon {
  font-size: 24px;
}

.item-content {
  display: flex;
  flex-direction: column;
}

.item-name {
  font-weight: 600;
  font-size: 14px;
}

.item-desc {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
