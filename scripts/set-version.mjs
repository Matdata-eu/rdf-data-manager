// Sets one version on every workspace package and on the pinned
// @rdf-data-manager/* dependencies between them. The release workflow runs it
// with the version from the release tag before publishing.
import { readFileSync, writeFileSync } from 'node:fs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Not a semver version: "${process.argv[2] ?? ''}"`)
  process.exit(1)
}

const root = JSON.parse(readFileSync('package.json', 'utf8'))
for (const dir of root.workspaces) {
  const file = `${dir}/package.json`
  const pkg = JSON.parse(readFileSync(file, 'utf8'))
  pkg.version = version
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      if (name.startsWith('@rdf-data-manager/')) pkg[field][name] = version
    }
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`${pkg.name} -> ${version}`)
}
