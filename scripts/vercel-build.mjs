/**
 * Build Vercel monorepo.
 *
 * Le projet a actuellement Root Directory = `.` (racine), donc Next doit
 * produire `.next` à la racine via CAISSECI_NEXT_DIST_ROOT=1.
 *
 * Quand Root Directory sera `apps/web`, retirez CAISSECI_NEXT_DIST_ROOT
 * et vérifiez `apps/web/.next` à la place.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    env: { ...process.env, ...env },
  })
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npx', ['prisma', 'generate'])

// Root Directory Vercel = monorepo → distDir à la racine
run('npm', ['run', 'build', '-w', '@caisseci/web'], {
  CAISSECI_NEXT_DIST_ROOT: '1',
})

const rootNext = path.join(root, '.next')
if (!existsSync(rootNext)) {
  console.error('Échec : .next introuvable à la racine du monorepo après le build.')
  process.exit(1)
}

console.log('Build Vercel OK — sortie dans /.next (racine monorepo)')
