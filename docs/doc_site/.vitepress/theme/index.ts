// .vitepress/theme/index.ts
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import InlineIcon from './components/InlineIcon.vue'
import IconGitHub from './components/IconGitHub.vue'
import IconFile from './components/IconFile.vue'
import DropdownSwitch from './components/DropdownSwitch.vue'
import SideBySide from './components/SideBySide.vue'
import Layout from "./Layout.vue";
import { enhanceAppWithTabs } from 'vitepress-plugin-tabs/client'
// Title/display font (Absans). Imported before style.css/custom.css so the
// @font-face is registered first and cascade order stays predictable.
import './title-font.css'
import './style.css'
import './custom.css'

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
    app.component('DropdownSwitch', DropdownSwitch)
    app.component('SideBySide', SideBySide)
    enhanceAppWithTabs(app)
  }
} satisfies Theme
