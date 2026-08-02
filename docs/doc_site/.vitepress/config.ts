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
import { showRepoLinkMarkdownPlugin } from './markdown/showRepoLink'
import { dropdownSwitchMarkdownPlugin } from './markdown/dropdownSwitch'
import { sideBySideMarkdownPlugin } from './markdown/sideBySide'
import { accordionScrollExpanderMarkdownPlugin } from './markdown/accordionScrollExpander'

const showSourceOptions = {
  lineNumbers: true
} satisfies ShowSourceMarkdownOptions

const siteBase = '/Structured-Design-Documents/'

// https://vitepress.dev/reference/site-config
export default defineConfig({

  base: siteBase,
  title: "Structured Design Documents",
  description: "Semantically Defined Structural Design for Better Products",

  srcExclude: [
    'README.md',
    '**/*_bup.md'
  ],

  ignoreDeadLinks: true,
  cleanUrls: true,

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Diagram Types', link: '/diagram_types/' },
      {
        text: 'Using SDD',
        items: [
          { text: 'Using SDD Today', link: '/using_sdd/' },
          { text: 'Command Line Tools', link: '/sdd_cli_tools/' },
          { text: 'SDD Skill for LLMs', link: '/sdd-skill/' },
          { text: 'Profiles', link:'/profiles/' }
        ]
      },
      {
        text: 'Examples',
        items: [
          {
            text: 'Service Blueprint',
            link: '/service_blueprint_slice_example/'
          }
        ]
      },
      { text: 'Impact',
        items: [
          { text: 'Strategic Potential', link: '/strategic_potential/' },
          { text: 'Practical Applications', link: '/practical_applications/' }
        ]
      }
    ],
/*
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Diagram Types', link: '/diagram_types/' },
          {
            text: 'Service Blueprint Example',
            link: '/service_blueprint_slice_example/'
          },
          {
            text: 'SDD Command Line Tools',
            link: '/sdd_cli_tools/'
          },
          { text: 'SDD Skill', link: '/sdd-skill/' },
          { text: 'SDD Helper', link: '/sdd-helper/' },
          {
            text: 'Strategic Potential',
            link: '/strategic_potential/'
          }
        ]
      }
    ],
*/
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/knutopia/Structured-Design-Documents'
      }
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
      // Link to a source directory, optionally aligned with preceding prose.
      md.use(showRepoLinkMarkdownPlugin);
      // Switch arbitrary Markdown content with an accessible in-page select.
      md.use(dropdownSwitchMarkdownPlugin);
      // Render exactly two level-three Markdown sections as responsive columns.
      md.use(sideBySideMarkdownPlugin);
      // Expand consecutive level-two sections one at a time as the page scrolls.
      md.use(accordionScrollExpanderMarkdownPlugin);

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
        name: 'restore-base-for-code-managed-assets-in-dev',
        apply: 'serve',
        configureServer(server) {
          // These directories stay at the repository root because their files are
          // generated or otherwise managed by the toolchain. viteStaticCopy below
          // exposes them without requiring a second copy under docs/doc_site.
          const codeManagedAssetPrefixes = [
            '/examples/',
            '/real_world_exploration/',
            '/definitions/'
          ]

          server.middlewares.use((req, _res, next) => {
            const url = req.url

            // Production builds turn relative Markdown images into fingerprinted
            // /assets/* files and include siteBase. In dev, VitePress currently
            // emits root-relative URLs such as /examples/rendered/example.svg.
            // With a non-root base, Vite rejects those requests before the
            // viteStaticCopy middleware can see them.
            if (
              url &&
              codeManagedAssetPrefixes.some((prefix) => url.startsWith(prefix))
            ) {
              // configureServer hooks run before Vite's internal base middleware.
              // Add the base here so Vite accepts the request; Vite then strips
              // the base again, leaving /examples/* (or another allowlisted
              // prefix) for viteStaticCopy to resolve from its explicit file map.
              req.url = `${siteBase.slice(0, -1)}${url}`
            }

            next()
          })
        }
      },
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
