/**
 * Build Vercel pour le monorepo (Root Directory = apps/web).
 * Exécuté depuis la racine du repo via `cd ../.. && node scripts/vercel-build.mjs`.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: process.env,
  })
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npx', ['prisma', 'generate'])
run('npm', ['run', 'build', '-w', '@caisseci/web'])

const webNext = path.join(root, 'apps', 'web', '.next')
if (!existsSync(webNext)) {
  console.error('Échec : apps/web/.next introuvable après le build.')
  process.exit(1)
}

console.log('Build Vercel OK — sortie dans apps/web/.next')
