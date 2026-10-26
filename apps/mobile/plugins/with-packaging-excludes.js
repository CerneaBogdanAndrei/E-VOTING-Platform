// BouncyCastle (adus de JMRTD pentru NFC) are aceleași fișiere META-INF în mai multe
// jar-uri, iar Gradle refuză să le împacheteze de două ori. Proiectul android/ se
// generează la fiecare prebuild, deci excluderile se adaugă din acest plugin.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// evoting: excluderi META-INF'
const BLOCK = `
    ${MARKER}
    packaging {
        resources {
            excludes += ['META-INF/LICENSE.md', 'META-INF/LICENSE.txt', 'META-INF/NOTICE.md', 'META-INF/NOTICE.txt', 'META-INF/versions/9/OSGI-INF/MANIFEST.MF']
        }
    }
`

module.exports = function withPackagingExcludes(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(/android\s*\{/, (m) => `${m}${BLOCK}`)
    }
    return cfg
  })
}
