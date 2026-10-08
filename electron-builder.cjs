const feed = process.env.TCHIM_UPDATE_URL;
const distribution = require('./resources/distribution.json');
if (feed && new URL(feed).protocol !== 'https:') throw new Error('TCHIM_UPDATE_URL must use HTTPS');
module.exports = {
  appId: 'fr.tchim.draft',
  productName: 'Tchim Draft',
  directories: { output: 'release', buildResources: 'resources' },
  files: ['dist/**/*', 'resources/icon.png', 'package.json'],
  asar: true,
  asarUnpack: ['node_modules/better-sqlite3/**/*'],
  npmRebuild: false,
  artifactName: 'Tchim-Draft-${version}-${os}-${arch}.${ext}',
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'resources/icon.ico', signExecutable: false },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, deleteAppDataOnUninstall: false },
  mac: { target: ['dmg', 'zip'], category: 'public.app-category.utilities', icon: 'resources/icon.png' },
  publish: feed ? { provider: 'generic', url: feed } : { provider: 'github', owner: distribution.owner, repo: distribution.repo, releaseType: 'release' }
};
