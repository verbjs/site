import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Verb Ecosystem',
  description: 'A fast, modern server framework for Bun with multi-protocol support',

  head: [
    ['link', { rel: 'icon', href: '/verb.png' }],
    ['meta', { name: 'theme-color', content: '#646cff' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: 'Verb Ecosystem | Bun-First Development' }],
    ['meta', { name: 'og:site_name', content: 'Verb' }],
    ['meta', { name: 'og:image', content: '/verb.png' }],
    ['meta', { name: 'og:url', content: 'https://verb.codes' }],
  ],

  themeConfig: {
    siteTitle: 'Verb Ecosystem',
    nav: [
      { text: 'Verb', link: '/verb/' },
      { text: 'Hull', link: '/hull/' },
      { text: 'Allow', link: '/allow/' },
      { text: 'Hoist', link: '/hoist/' },
      { text: 'GitHub', link: 'https://github.com/verbjs' }
    ],

    sidebar: {
      '/verb/': [
        {
          text: 'Verb',
          items: [
            { text: 'Overview', link: '/verb/' },
            { text: 'Getting Started', link: '/verb/getting-started' },
            { text: 'HTTP Server', link: '/verb/http' },
            { text: 'WebSocket', link: '/verb/websocket' },
            { text: 'Middleware', link: '/verb/middleware' },
            { text: 'Routing', link: '/verb/routing' },
          ]
        }
      ],
      '/hull/': [
        {
          text: 'Hull',
          items: [
            { text: 'Overview', link: '/hull/' },
            { text: 'Getting Started', link: '/hull/getting-started' },
            { text: 'Schema', link: '/hull/schema' },
            { text: 'Queries', link: '/hull/queries' },
            { text: 'Changesets', link: '/hull/changesets' },
            { text: 'Migrations', link: '/hull/migrations' },
          ]
        }
      ],
      '/allow/': [
        {
          text: 'Allow',
          items: [
            { text: 'Overview', link: '/allow/' },
            { text: 'Getting Started', link: '/allow/getting-started' },
            { text: 'Password Auth', link: '/allow/passwords' },
            { text: 'JWT Tokens', link: '/allow/jwt' },
            { text: 'API Tokens', link: '/allow/api-tokens' },
            { text: 'Middleware', link: '/allow/middleware' },
          ]
        }
      ],
      '/hoist/': [
        {
          text: 'Hoist',
          items: [
            { text: 'Overview', link: '/hoist/' },
            { text: 'Getting Started', link: '/hoist/getting-started' },
            { text: 'CLI', link: '/hoist/cli' },
            { text: 'Deployments', link: '/hoist/deployments' },
            { text: 'Databases', link: '/hoist/databases' },
            { text: 'Storage', link: '/hoist/storage' },
          ]
        }
      ],
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is Verb?', link: '/guide/' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Multi-Protocol Support', link: '/guide/multi-protocol' },
            { text: 'Unified API', link: '/guide/unified-api' },
            { text: 'Protocol Gateway', link: '/guide/protocol-gateway' }
          ]
        },
        {
          text: 'Protocols',
          items: [
            { text: 'HTTP', link: '/guide/protocols/http' },
            { text: 'HTTPS', link: '/guide/protocols/https' },
            { text: 'HTTP/2', link: '/guide/protocols/http2' },
            { text: 'WebSocket', link: '/guide/protocols/websocket' },
            { text: 'gRPC', link: '/guide/protocols/grpc' },
            { text: 'UDP', link: '/guide/protocols/udp' },
            { text: 'TCP', link: '/guide/protocols/tcp' }
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Middleware', link: '/guide/middleware' },
            { text: 'Error Handling', link: '/guide/error-handling' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Testing', link: '/guide/testing' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'createServer', link: '/api/create-server' },
            { text: 'ServerProtocol', link: '/api/server-protocol' },
            { text: 'Protocol Gateway', link: '/api/protocol-gateway' }
          ]
        },
        {
          text: 'Server Types',
          items: [
            { text: 'HTTP Server', link: '/api/servers/http' },
            { text: 'WebSocket Server', link: '/api/servers/websocket' },
            { text: 'gRPC Server', link: '/api/servers/grpc' },
            { text: 'UDP Server', link: '/api/servers/udp' },
            { text: 'TCP Server', link: '/api/servers/tcp' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Basic Usage', link: '/examples/' },
            { text: 'HTTP Server', link: '/examples/http-server' },
            { text: 'WebSocket Chat', link: '/examples/websocket-chat' },
            { text: 'gRPC Service', link: '/examples/grpc-service' },
            { text: 'Multi-Protocol App', link: '/examples/multi-protocol' },
            { text: 'Protocol Gateway', link: '/examples/protocol-gateway' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/verbjs/verb' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Verb'
    },

    search: {
      provider: 'local'
    }
  }
})
