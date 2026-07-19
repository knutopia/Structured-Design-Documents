// .vitepress/theme/index.ts
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import InlineIcon from './components/InlineIcon.vue'
import IconGitHub from './components/IconGitHub.vue'
import IconFile from './components/IconFile.vue'
import Layout from "./Layout.vue";
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'

// Local FontAwesome-free assets bundled natively by Vite
import '@fortawesome/fontawesome-free/css/all.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    // Register both clean variations for markdown use
    app.component('InlineIcon', InlineIcon)
    app.component('IconGitHub', IconGitHub)
    app.component('IconFile', IconFile)
    enhanceAppWithTabs(app)
  }
} satisfies Theme
