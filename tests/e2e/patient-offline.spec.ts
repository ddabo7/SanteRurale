/**
 * Test E2E Playwright - Créer un patient offline → synchronisation
 *
 * Scénario testé:
 * 1. Se connecter
 * 2. Passer en mode offline
 * 3. Créer un nouveau patient
 * 4. Vérifier que le patient est enregistré localement
 * 5. Revenir en mode online
 * 6. Vérifier que la synchronisation s'effectue
 * 7. Vérifier que le patient est bien sur le serveur
 */

import { test, expect, Page } from '@playwright/test'

// Configuration
const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/v1'
const APP_URL = 'http://localhost:5173'

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Se connecter à l'application
 */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${APP_URL}/login`)

  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)

  await page.click('button[type="submit"]')

  // Attendre la redirection vers l'accueil
  await page.waitForURL(`${APP_URL}/`, { timeout: 5000 })
}

/**
 * Passer en mode offline (simuler perte de réseau)
 */
async function goOffline(page: Page) {
  await page.context().setOffline(true)
  console.log('📴 Mode offline activé')
}

/**
 * Revenir en mode online
 */
async function goOnline(page: Page) {
  await page.context().setOffline(false)
  console.log('🌐 Mode online activé')
}

/**
 * Attendre que la synchronisation se termine
 */
async function waitForSync(page: Page) {
  // Attendre que l'indicateur de synchronisation apparaisse
  await page.waitForSelector('[data-testid="sync-indicator"]', {
    state: 'visible',
    timeout: 5000,
  })

  // Attendre qu'il disparaisse (sync terminée)
  await page.waitForSelector('[data-testid="sync-indicator"]', {
    state: 'hidden',
    timeout: 30000,
  })

  console.log('✅ Synchronisation terminée')
}

// ===========================================================================
// TESTS
// ===========================================================================

test.describe('Patient Offline Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Se connecter avant chaque test
    await login(page, 'infirmier@cscom-konobougou.ml', 'SecurePass123!')
  })

  test('Créer un patient offline puis synchroniser', async ({ page }) => {
    // ===========================================================================
    // ÉTAPE 1: Passer en mode offline
    // ===========================================================================
    await goOffline(page)

    // Vérifier que l'indicateur offline s'affiche
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]')
    await expect(offlineIndicator).toBeVisible()
    await expect(offlineIndicator).toHaveText(/hors ligne/i)

    // ===========================================================================
    // ÉTAPE 2: Créer un nouveau patient
    // ===========================================================================
    await page.click('[data-testid="btn-nouveau-patient"]')

    // Remplir le formulaire
    const timestamp = Date.now()
    await page.fill('input[name="nom"]', `Patient-Test-${timestamp}`)
    await page.fill('input[name="prenom"]', 'Offline')
    await page.selectOption('select[name="sexe"]', 'M')
    await page.fill('input[name="annee_naissance"]', '1990')
    await page.fill('input[name="telephone"]', '+223 70 12 34 56')
    await page.fill('input[name="village"]', 'Konobougou')

    // Soumettre
    await page.click('button[type="submit"]')

    // Attendre le message de succès
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible()
    await expect(page.locator('[data-testid="toast-success"]')).toContainText(/enregistré localement/i)

    // Vérifier que le patient apparaît dans la liste (depuis IndexedDB)
    await page.goto(`${APP_URL}/patients`)
    await expect(page.locator(`text=Patient-Test-${timestamp}`)).toBeVisible()

    // Vérifier qu'il y a une indication "non synchronisé"
    const unsyncedBadge = page.locator('[data-testid="patient-unsynced-badge"]').first()
    await expect(unsyncedBadge).toBeVisible()
    await expect(unsyncedBadge).toHaveText(/non synchronisé/i)

    // ===========================================================================
    // ÉTAPE 3: Vérifier que l'outbox contient l'opération
    // ===========================================================================
    // Ouvrir les DevTools (optionnel, pour inspection)
    const outboxCount = await page.evaluate(async () => {
      const db = (window as any).db // Accès à l'instance Dexie globale
      const operations = await db.outbox.where('processed').equals(0).toArray()
      return operations.length
    })

    expect(outboxCount).toBeGreaterThan(0)
    console.log(`📦 Outbox: ${outboxCount} opération(s) en attente`)

    // ===========================================================================
    // ÉTAPE 4: Revenir en mode online
    // ===========================================================================
    await goOnline(page)

    // Vérifier que l'indicateur offline disparaît
    await expect(offlineIndicator).not.toBeVisible()

    // Vérifier que l'indicateur online s'affiche
    const onlineIndicator = page.locator('[data-testid="online-indicator"]')
    await expect(onlineIndicator).toBeVisible()

    // ===========================================================================
    // ÉTAPE 5: Attendre la synchronisation automatique
    // ===========================================================================
    await waitForSync(page)

    // Recharger la liste des patients
    await page.reload()

    // Vérifier que le badge "non synchronisé" a disparu
    await expect(page.locator(`text=Patient-Test-${timestamp}`)).toBeVisible()
    const syncedBadge = page.locator('[data-testid="patient-unsynced-badge"]').first()
    await expect(syncedBadge).not.toBeVisible()

    // ===========================================================================
    // ÉTAPE 6: Vérifier côté serveur via API
    // ===========================================================================
    const response = await page.request.get(`${API_URL}/patients`, {
      params: {
        search: `Patient-Test-${timestamp}`,
      },
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('access_token'))}`,
      },
    })

    expect(response.ok()).toBeTruthy()

    const data = await response.json()
    expect(data.data).toBeDefined()
    expect(data.data.length).toBeGreaterThan(0)

    const patient = data.data.find((p: any) => p.nom === `Patient-Test-${timestamp}`)
    expect(patient).toBeDefined()
    expect(patient.prenom).toBe('Offline')
    expect(patient.sexe).toBe('M')
    expect(patient.village).toBe('Konobougou')

    console.log('✅ Patient synchronisé avec succès:', patient)
  })

  test('Créer plusieurs patients offline et synchroniser en batch', async ({ page }) => {
    await goOffline(page)

    // Créer 3 patients
    for (let i = 1; i <= 3; i++) {
      await page.click('[data-testid="btn-nouveau-patient"]')

      await page.fill('input[name="nom"]', `Batch-Patient-${i}`)
      await page.fill('input[name="prenom"]', `Test`)
      await page.selectOption('select[name="sexe"]', i % 2 === 0 ? 'F' : 'M')
      await page.fill('input[name="annee_naissance"]', String(1980 + i))

      await page.click('button[type="submit"]')
      await page.waitForTimeout(500)
    }

    // Vérifier l'outbox (3 opérations)
    const outboxCount = await page.evaluate(async () => {
      const db = (window as any).db
      return await db.outbox.where('processed').equals(0).count()
    })
    expect(outboxCount).toBe(3)

    // Revenir online
    await goOnline(page)

    // Attendre synchronisation
    await waitForSync(page)

    // Vérifier que l'outbox est vide
    const outboxCountAfter = await page.evaluate(async () => {
      const db = (window as any).db
      return await db.outbox.where('processed').equals(0).count()
    })
    expect(outboxCountAfter).toBe(0)

    console.log('✅ Batch de 3 patients synchronisé')
  })

  test('Gérer un conflit de version', async ({ page }) => {
    // TODO: Implémenter test de conflit
    // 1. Créer patient online (version 1)
    // 2. Modifier offline (version locale 2)
    // 3. Modifier online depuis autre device (version serveur 2)
    // 4. Synchroniser
    // 5. Vérifier la résolution de conflit (last-write-wins ou merge)

    test.skip()
  })
})
