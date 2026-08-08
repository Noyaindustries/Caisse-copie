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

function removeLinkIfAny() {
  try {
    const st = fs.lstatSync(linkPath)
    if (st.isSymbolicLink()) {
      fs.unlinkSync(linkPath)
      return
    }
    if (st.isDirectory()) {
      // Ne pas supprimer un vrai dossier source (copie locale).
      return
    }
  } catch {
    // absent
  }
}

function linkPointsToSrc() {
  try {
    const st = fs.lstatSync(linkPath)
    if (st.isDirectory() && !st.isSymbolicLink()) {
      // Dossier réel (ex. copie Windows) : OK si index présent
      return fs.existsSync(path.join(linkPath, 'App.tsx'))
    }
    if (st.isSymbolicLink()) {
      const resolved = fs.realpathSync(linkPath)
      return resolved === fs.realpathSync(targetPath)
    }
  } catch {
    return false
  }
  return false
}

if (linkPointsToSrc()) {
  console.log('[ensure-web-src-link] apps/web/src OK')
  process.exit(0)
}

removeLinkIfAny()

if (process.platform === 'win32') {
  // Junction Windows
  try {
    if (fs.existsSync(linkPath)) {
      console.log('[ensure-web-src-link] apps/web/src déjà présent (win)')
      process.exit(0)
    }
  } catch {
    // continue
  }
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
  const rel = path.relative(path.dirname(linkPath), targetPath)
  fs.symlinkSync(rel, linkPath, 'dir')
  console.log('[ensure-web-src-link] symlink créé →', rel)
}
