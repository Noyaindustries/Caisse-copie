/**
 * Crée le lien apps/web/src → ../../src (évite externalDir / double React).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const linkPath = path.join(repoRoot, 'apps', 'web', 'src')
const targetPath = path.join(repoRoot, 'src')

function alreadyLinked() {
  try {
    const st = fs.lstatSync(linkPath)
    return st.isSymbolicLink() || st.isDirectory()
  } catch {
    return false
  }
}

if (alreadyLinked()) {
  console.log('[ensure-web-src-link] apps/web/src déjà présent')
  process.exit(0)
}

if (process.platform === 'win32') {
  const r = spawnSync(
    'cmd',
    ['/c', 'mklink', '/J', linkPath, targetPath],
    { encoding: 'utf8' },
  )
  if (r.status !== 0) {
    console.error(r.stdout || r.stderr || 'mklink failed')
    process.exit(1)
  }
  console.log('[ensure-web-src-link]', r.stdout.trim())
} else {
  try {
    fs.symlinkSync(path.relative(path.dirname(linkPath), targetPath), linkPath, 'dir')
    console.log('[ensure-web-src-link] symlink créé')
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') {
      console.log('[ensure-web-src-link] apps/web/src déjà présent (EEXIST)')
      process.exit(0)
    }
    throw err
  }
}
