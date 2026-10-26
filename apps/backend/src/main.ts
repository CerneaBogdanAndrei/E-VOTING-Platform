import { createApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await createApp(config)
await app.listen(config.port, '0.0.0.0')
console.log(`Backend-ul ascultă pe http://localhost:${config.port}`)
