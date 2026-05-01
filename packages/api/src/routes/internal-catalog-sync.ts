import { Router } from 'express'
import { syncOpenRouterCatalog } from '@bedtime/core/openrouter/sync-catalog'

const router = Router()

router.post('/', async (req, res) => {
  const secret = process.env['CATALOG_SYNC_SECRET']
  const incoming = req.headers['x-catalog-sync-secret']

  if (!secret || incoming !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const result = await syncOpenRouterCatalog()
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('[catalog-sync] scheduled endpoint failed:', err)
    res.status(500).json({ error: 'Sync failed' })
  }
})

export default router
