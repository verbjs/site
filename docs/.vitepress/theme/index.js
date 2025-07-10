import DefaultTheme from 'vitepress/theme'
import CustomHome from './CustomHome.vue'

export default {
  extends: DefaultTheme,
  Layout: CustomHome,
  enhanceApp({ app }) {
    // Any additional app enhancements
  }
}