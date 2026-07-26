import { defineConfig } from 'vitepress'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { normalizePath } from 'vite'

import path from 'path'
import lightbox from "vitepress-plugin-lightbox"
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'
import sddGrammar from '../../../editors/vscode-sdd/syntaxes/sdd.tmLanguage.json'
import {
  showSourceMarkdownPlugin,
  type ShowSourceMarkdownOptions
} from './markdown/showSource'

const showSourceOptions = {
  lineNumbers: true
} satisfies ShowSourceMarkdownOptions

// https://vitepress.dev/reference/site-config
export default defineConfig({

  title: "Structured Design Documents",
  description: "Semantically Defined Structural Design for Better Products",

  ignoreDeadLinks: true,
  cleanUrls: true,

    themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' }
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  },

  markdown: {
    languages: [sddGrammar],
    languageLabel: {
      sdd: 'SDD'
    },
    config: (md) => {
      // Use lightbox plugin
      md.use(lightbox, {});
      // use tabs plugin
      md.use(tabsMarkdownPlugin);
      // Render external source files, with optional excerpts and highlights.
      md.use(showSourceMarkdownPlugin, showSourceOptions);

      // Store the default link renderer
      const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };

      // Override the link renderer
      md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        const hrefIndex = tokens[idx].attrIndex('href');
        
        if (hrefIndex >= 0 && tokens[idx].attrs) {
          const href = tokens[idx].attrs[hrefIndex][1];
          
          // Detect your custom toolchain files
          if (href.endsWith('.sdd')) {
            // Inject target="_blank" to bypass the Vue SPA router
            tokens[idx].attrPush(['target', '_blank']);
            
            // Note: If you prefer it to auto-download rather than open a new tab, 
            // you can use this instead: tokens[idx].attrPush(['download', '']);
          }
        }
        return defaultRender(tokens, idx, options, env, self);
      };

      // Repo link macro, expands to:
      //   <div class="link-right">
      //     <a href="  
      //     https://github.com/knutopia/Structured-Design-Documents/tree/main/
      //     param_path">
      //     <IconGitHub/>Repo folder</a>
      //   </div>
      md.core.ruler.before('block', 'custom-directives', (state) => {
        state.src = state.src
          .replace(
            /^([ \t]*)showRepoLink[ \t]+([A-Za-z0-9._/-]+)[ \t]*$/gm,
            (_, indentation, repoPath) => {
              const url =
                'https://github.com/knutopia/Structured-Design-Documents/tree/main/' +
                repoPath.replace(/^\/+/, '')

              // Terminate the HTML block so a following Markdown block
              // directive (such as showSource) can be tokenized separately.
              return `${indentation}<div class="link-right"><a href="${url}" target="_blank" rel="noreferrer"><IconGitHub/>Repo folder</a></div>\n`
            }
          )
      })
    }
  },

  vite: {
    assetsInclude: ['**/*.sdd'], // Tells Vite to treat all .sdd files as static assets
    server: {
      fs: {
        allow: ['../../..']
      }
    },
    plugins: [
      {
        name: 'serve-sdd-files',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.endsWith('.sdd')) {
              const fs = require('fs');
              const path = require('path');
              // Reconstruct the absolute path
              const filePath = path.resolve(__dirname, '../../..', req.url.substring(1));
              
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', 'text/plain');
                return fs.createReadStream(filePath).pipe(res);
              }
            }
            next();
          });
        }
      },
      viteStaticCopy({
        targets: [
          {
            // The folder in your repo root you want to make available
            src: normalizePath(path.resolve(__dirname, '../../../real_world_exploration')),
            // Where it goes in the final build (root of the site)
            dest: './' 
          },
          {
            src: normalizePath(path.resolve(__dirname, '../../../examples')),
            dest: './'
          },
          {
            src: normalizePath(path.resolve(__dirname, '../../../definitions')),
            dest: './'
          }
        ]
      })
    ]
  }
})
