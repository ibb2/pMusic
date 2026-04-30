import type { ElectrobunConfig } from 'electrobun'

const config: ElectrobunConfig = {
  app: {
    name: 'Rayna',
    identifier: 'com.ib.rayna',
    version: '0.4.0',
    description: 'Rayna',
    urlSchemes: ['rayna']
  },
  build: {
    buildFolder: 'build/electrobun',
    artifactFolder: 'dist/electrobun',
    bun: {
      entrypoint: 'src/bun/index.ts'
    },
    copy: {
      'out/renderer': 'views/main',
      'vendor/bass': 'vendor/bass'
    },
    watch: ['src/bun', 'src/shared', 'src/renderer', 'vendor/bass'],
    mac: {
      codesign: false,
      createDmg: true,
      notarize: false,
      icons: ''
    },
    win: {
      icon: 'resources/icon.png'
    },
    linux: {
      icon: 'resources/icon.png'
    }
  },
  release: {
    baseUrl: '',
    generatePatch: false
  }
}

export default config
