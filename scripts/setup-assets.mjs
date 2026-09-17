import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const FACECAP_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/facecap.glb'

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`[setup-assets] File already exists: ${dest}`)
      return resolve()
    }

    console.log(`[setup-assets] Downloading ${url} to ${dest}...`)
    const file = fs.createWriteStream(dest)
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`Failed to download ${url}, status: ${response.statusCode}`))
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          console.log(`[setup-assets] Downloaded ${dest} successfully (${fs.statSync(dest).size} bytes).`)
          resolve()
        })
      })
    }).on('error', (err) => {
      file.close()
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
  })
}

async function main() {
  console.log('[setup-assets] Setting up Jasper 3D assets...')

  const assetsModelDir = path.join(rootDir, 'assets', 'models')
  const publicModelDir = path.join(rootDir, 'public', 'models')
  const publicBasisDir = path.join(rootDir, 'public', 'basis')

  ensureDir(assetsModelDir)
  ensureDir(publicModelDir)
  ensureDir(publicBasisDir)

  // 1. Download facecap.glb to assets/models/facecap.glb
  const facecapAssetPath = path.join(assetsModelDir, 'facecap.glb')
  const facecapPublicPath = path.join(publicModelDir, 'facecap.glb')

  try {
    await downloadFile(FACECAP_URL, facecapAssetPath)
    // Copy to public/models/facecap.glb for web serving
    fs.copyFileSync(facecapAssetPath, facecapPublicPath)
    console.log(`[setup-assets] Copied facecap.glb to ${facecapPublicPath}`)
  } catch (err) {
    console.error('[setup-assets] Error downloading facecap.glb:', err.message)
  }

  // 2. Copy Basis Universal transcoders from three
  const threeBasisDir = path.join(rootDir, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis')
  if (fs.existsSync(threeBasisDir)) {
    const basisFiles = ['basis_transcoder.js', 'basis_transcoder.wasm']
    for (const file of basisFiles) {
      const src = path.join(threeBasisDir, file)
      const dst = path.join(publicBasisDir, file)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dst)
        console.log(`[setup-assets] Copied ${file} to public/basis/`)
      }
    }
  } else {
    console.log('[setup-assets] Note: three/examples/jsm/libs/basis not found yet. Run again after npm install.')
  }

  // 3. Ensure electron binary and path.txt exist
  const electronDir = path.join(rootDir, 'node_modules', 'electron')
  const electronExe = path.join(electronDir, 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
  const electronPathTxt = path.join(electronDir, 'path.txt')
  if (!fs.existsSync(electronExe)) {
    const installJs = path.join(electronDir, 'install.js')
    if (fs.existsSync(installJs)) {
      console.log('[setup-assets] Electron binary missing. Running electron/install.js...')
      try {
        const { execSync } = await import('child_process')
        execSync(`node "${installJs}"`, { stdio: 'inherit' })
      } catch (err) {
        console.warn('[setup-assets] Warning: Could not auto-install electron binary:', err.message)
      }
    }
  }
  if (fs.existsSync(electronExe) && !fs.existsSync(electronPathTxt)) {
    fs.writeFileSync(electronPathTxt, process.platform === 'win32' ? 'electron.exe' : 'electron')
    console.log('[setup-assets] Configured electron/path.txt successfully.')
  }

  console.log('[setup-assets] Done!')
}

main().catch(console.error)

