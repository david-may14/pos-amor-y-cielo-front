import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...preset,
    maskable: {
      ...preset.maskable,
      resizeOptions: { background: '#2d3d1f', fit: 'contain' },
    },
  },
  images: ['assets/favicon.svg'],
})
