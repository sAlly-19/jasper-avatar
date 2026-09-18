import esbuild from 'esbuild'
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Setup temporary test directory for userData
const tempUserData = path.join(os.tmpdir(), 'jasper-test-userdata')
if (!fs.existsSync(tempUserData)) {
  fs.mkdirSync(tempUserData, { recursive: true })
}

// Create a real mock shim for Electron APIs so production classes run cleanly under Node.js test runner
const electronMockShim = `
import os from 'node:os';
import path from 'node:path';
const tempUserData = ${JSON.stringify(tempUserData)};

export const app = {
  getPath: (name) => tempUserData,
  whenReady: () => Promise.resolve(),
  quit: () => {}
};

export const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (str) => Buffer.from(str, 'utf-8'),
  decryptString: (buf) => buf.toString('utf-8')
};

export const clipboard = {
  readText: () => Promise.resolve(''),
  writeText: () => Promise.resolve()
};

export const BrowserWindow = class {
  constructor() {}
  loadURL() { return Promise.resolve(); }
  webContents = {
    setAudioMuted() {},
    getTitle() { return 'Test Page'; },
    capturePage() { return Promise.resolve({ toDataURL: () => 'data:image/png;base64,...' }); },
    executeJavaScript() { return Promise.resolve('Mocked page content'); }
  };
  destroy() {}
  isDestroyed() { return false; }
};

export const shell = {
  openExternal: () => Promise.resolve()
};

export default { app, safeStorage, clipboard, BrowserWindow, shell };
`

const mockPath = path.join(rootDir, 'test', '_electron-mock.mjs')
fs.writeFileSync(mockPath, electronMockShim, 'utf-8')

// Bundle tests with esbuild resolving real TypeScript classes and @shared aliases
console.log('[run-tests] Empacotando testes com as implementações REAIS do sistema...')
esbuild.buildSync({
  entryPoints: [path.join(rootDir, 'test', 'security-hardening.test.ts')],
  outfile: path.join(rootDir, 'test', 'security-hardening.test.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: {
    'electron': mockPath,
    '@shared': path.join(rootDir, 'src', 'shared', 'index.ts')
  },
  external: ['three', '@tensorflow/tfjs', '@tensorflow-models/speech-commands']
})

console.log('[run-tests] Executando suíte de testes de integração real...')
const res = spawnSync(process.execPath, ['--test', 'test/security-hardening.test.mjs'], {
  cwd: rootDir,
  stdio: 'inherit'
})

// Cleanup mock file
try {
  if (fs.existsSync(mockPath)) {
    fs.unlinkSync(mockPath)
  }
} catch {}

process.exit(res.status ?? 0)

