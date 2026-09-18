import { runWorker } from './worker'

runWorker().catch((error) => {
  console.error(error)
  process.exit(1)
})
