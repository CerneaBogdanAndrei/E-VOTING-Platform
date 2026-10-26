import { migrate } from './migrate.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Lipsește DATABASE_URL')
  process.exit(1)
}
const applied = await migrate(url, console.log)
console.log(applied.length ? `${applied.length} migrări aplicate` : 'Schema e la zi')
