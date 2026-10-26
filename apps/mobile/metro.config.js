// Aplicația folosește pachetele comune din monorepo (packages/crypto, packages/api),
// legate prin „file:”. Metro trebuie să urmărească și folderele lor, iar
// dependențele (de ex. @noble/curves) se rezolvă întâi din node_modules-ul aplicației.
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

config.watchFolders = [path.join(monorepoRoot, 'packages')]
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules'), path.join(monorepoRoot, 'node_modules')]

module.exports = config
