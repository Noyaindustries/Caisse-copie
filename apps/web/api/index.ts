/**
 * Entrypoint serverless Vercel — expose l’app Express sous /api/*.
 * En local, Next réécrit /api vers le process `npm run dev:api` (:4000).
 */
import { app } from '../../../server/app.js'

export default app
