import { createApp, logger } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await createApp(config)
await app.listen(config.port, '0.0.0.0')
logger.log(`Backend pornit pe http://localhost:${config.port}${config.demoMode ? ' (mod demo)' : ''}`)
