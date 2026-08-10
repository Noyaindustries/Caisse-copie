/**
 * Build Vercel monorepo : génère Prisma, build Next dans apps/web,
 * et synchronise `.next` à la racine si le Root Directory Vercel n’est pas apps/web.
 */
import { cpSync, existsSync, rmSync } from 'node:fs'
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
const rootNext = path.join(root, '.next')

if (!existsSync(webNext)) {
  console.error('Échec : apps/web/.next introuvable après le build.')
  process.exit(1)
}

// Si Vercel a Root Directory = monorepo (pas apps/web), il attend /.next
if (!existsSync(rootNext)) {
  console.log('Sync apps/web/.next → .next (Root Directory monorepo)')
  cpSync(webNext, rootNext, { recursive: true })
}

console.log('Build Vercel OK — .next prêt')
