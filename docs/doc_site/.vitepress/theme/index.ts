// .vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import InlineIcon from './components/InlineIcon.vue'
import IconGitHub from './components/IconGitHub.vue'
import IconFile from './components/IconFile.vue'

// Local FontAwesome-free assets bundled natively by Vite
import '@fortawesome/fontawesome-free/css/all.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register both clean variations for markdown use
    app.component('InlineIcon', InlineIcon)
    app.component('IconGitHub', IconGitHub)
    app.component('IconFile', IconFile)
  }
}
