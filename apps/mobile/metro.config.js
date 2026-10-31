// Aplicația folosește pachetele comune din monorepo (@evoting/crypto, @evoting/api),
// legate prin "file:../../packages/…". Metro trebuie să urmărească și acele foldere.
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

config.watchFolders = [path.join(repoRoot, 'packages')]
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules'), path.join(repoRoot, 'node_modules')]
config.resolver.unstable_enableSymlinks = true
config.resolver.unstable_enablePackageExports = true

module.exports = config
