import type { Plugin } from 'vite'

/** Start the measured critical route downloads with the document, not after app JS. */
export function criticalRoutePreload(): Plugin {
  return {
    name: 'atlas-critical-route-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        const assets = Object.values(context.bundle ?? {})
        const today = assets.find(
          (asset) => asset.type === 'chunk' && asset.name === 'today',
        )
        if (!today) return []
        return [
          {
            tag: 'link',
            attrs: {
              rel: 'modulepreload',
              crossorigin: '',
              href: `/${today.fileName}`,
            },
            injectTo: 'head',
          },
          ...assets
            .filter(
              (asset) =>
                asset.type === 'asset' &&
                /^assets\/today-.*\.css$/.test(asset.fileName),
            )
            .map((asset) => ({
              tag: 'link',
              attrs: {
                rel: 'preload',
                as: 'style',
                crossorigin: '',
                href: `/${asset.fileName}`,
              },
              injectTo: 'head' as const,
            })),
        ]
      },
    },
  }
}
