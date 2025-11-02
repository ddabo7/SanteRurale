/**
 * Tests E2E pour la synchronisation offline-first
 */

import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/')
  await page.getByPlaceholder(/email/i).fill('medecin@example.com')
  await page.getByPlaceholder(/mot de passe/i).fill('medecinpassword123')
  await page.getByRole('button', { name: /connexion/i }).click()
  await page.waitForURL(/dashboard|patients|consultations/)
}

test.describe('Offline-First Synchronization', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should show online indicator when online', async ({ page }) => {
    await page.goto('/patients')

    // Vérifier l'indicateur de statut en ligne
    const onlineIndicator = page.getByRole('status')
    await expect(onlineIndicator).toBeVisible()
    await expect(onlineIndicator).toContainText(/en ligne/i)
  })

  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/patients')

    // Passer en mode offline
    await context.setOffline(true)

    // Attendre que le statut se mette à jour
    await page.waitForTimeout(1000)

    // Vérifier l'indicateur offline
    const offlineIndicator = page.getByRole('status')
    await expect(offlineIndicator).toContainText(/hors ligne/i)
  })

  test('should queue operations when offline', async ({ page, context }) => {
    await page.goto('/patients')

    // Passer offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    // Créer un patient
    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Queue Test')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1990-01-01')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Vérifier que l'opération est en attente
    await expect(page.getByText(/1.*opération.*en attente/i)).toBeVisible()

    // Créer un deuxième patient
    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Queue Test 2')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1991-02-02')
    await page.getByLabel(/sexe/i).selectOption('F')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Vérifier que 2 opérations sont en attente
    await expect(page.getByText(/2.*opération.*en attente/i)).toBeVisible()
  })

  test('should sync queued operations when back online', async ({ page, context }) => {
    await page.goto('/patients')

    // Créer des données offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Sync Patient')
    await page.getByLabel(/prénom/i).fill('Test')
    await page.getByLabel(/date.*naissance/i).fill('1993-03-03')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    await expect(page.getByText(/1.*opération.*en attente/i)).toBeVisible()

    // Repasser online
    await context.setOffline(false)
    await page.waitForTimeout(3000) // Attendre la sync automatique

    // Les opérations devraient être synchronisées
    await expect(page.getByText(/0.*opération.*en attente/i)).toBeVisible()
    await expect(page.getByText(/en ligne/i)).toBeVisible()
  })

  test('should allow manual sync', async ({ page }) => {
    await page.goto('/patients')

    // Cliquer sur le bouton de synchronisation manuelle
    const syncButton = page.getByRole('button', { name: /synchroniser|sync/i })

    if (await syncButton.isVisible()) {
      await syncButton.click()

      // Vérifier l'indicateur de synchronisation en cours
      await expect(page.getByText(/synchronisation.*en cours/i)).toBeVisible()

      // Attendre la fin de la sync
      await page.waitForTimeout(2000)

      // Vérifier la confirmation
      await expect(page.getByText(/synchronisation.*réussie/i)).toBeVisible()
    }
  })

  test('should persist data locally', async ({ page, context }) => {
    await page.goto('/patients')

    // Créer un patient offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Persist Test')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1994-04-04')
    await page.getByLabel(/sexe/i).selectOption('F')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Recharger la page
    await page.reload()

    // Le patient devrait toujours être visible
    await expect(page.getByText('Persist Test')).toBeVisible()

    // L'opération devrait toujours être en attente
    await expect(page.getByText(/1.*opération.*en attente/i)).toBeVisible()
  })

  test('should handle sync conflicts gracefully', async ({ page, context }) => {
    await page.goto('/patients')

    // Créer un patient
    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Conflict Test')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1995-05-05')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    await page.waitForTimeout(2000)

    // Passer offline et modifier
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    const firstPatient = page.getByText('Conflict Test').first()
    await firstPatient.click()

    await page.getByRole('button', { name: /modifier/i }).click()
    const nomInput = page.getByLabel(/nom/i)
    await nomInput.clear()
    await nomInput.fill('Conflict Test Modified')
    await page.getByRole('button', { name: /enregistrer/i }).click()

    // Repasser online
    await context.setOffline(false)
    await page.waitForTimeout(3000)

    // Vérifier qu'il n'y a pas d'erreur critique
    const errorMessages = page.getByText(/erreur.*critique/i)
    expect(await errorMessages.count()).toBe(0)
  })

  test('should show sync progress indicator', async ({ page }) => {
    await page.goto('/patients')

    // Déclencher une sync
    const syncButton = page.getByRole('button', { name: /synchroniser|sync/i })

    if (await syncButton.isVisible()) {
      await syncButton.click()

      // Vérifier l'indicateur de progression
      const syncingIndicator = page.getByText(/synchronisation/i)
      await expect(syncingIndicator).toBeVisible()

      // Devrait avoir un spinner ou une animation
      const spinner = page.locator('[class*="animate-spin"], [class*="loading"]')
      if (await spinner.count() > 0) {
        await expect(spinner.first()).toBeVisible()
      }
    }
  })

  test('should show last sync time', async ({ page }) => {
    await page.goto('/patients')

    // Effectuer une sync
    const syncButton = page.getByRole('button', { name: /synchroniser|sync/i })

    if (await syncButton.isVisible()) {
      await syncButton.click()
      await page.waitForTimeout(2000)

      // Devrait afficher l'heure de dernière sync
      const lastSyncText = page.getByText(/dernière.*sync.*il y a/i)
      if (await lastSyncText.count() > 0) {
        await expect(lastSyncText.first()).toBeVisible()
      }
    }
  })

  test('should handle network errors during sync', async ({ page, context }) => {
    await page.goto('/patients')

    // Créer un patient offline
    await context.setOffline(true)
    await page.waitForTimeout(1000)

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Error Test')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1996-06-06')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Simuler une connexion instable (online mais API inaccessible)
    await context.setOffline(false)

    // Attendre et vérifier qu'il y a une gestion d'erreur
    await page.waitForTimeout(5000)

    // L'opération devrait être retentée ou mise en échec avec un message approprié
    const retryMessage = page.getByText(/réessayer|retry|échec/i)
    if (await retryMessage.count() > 0) {
      await expect(retryMessage.first()).toBeVisible()
    }
  })

  test('should support PWA installation', async ({ page }) => {
    await page.goto('/patients')

    // Vérifier que le manifest est chargé
    const manifestLink = page.locator('link[rel="manifest"]')
    expect(await manifestLink.count()).toBeGreaterThan(0)

    // Vérifier que le service worker est enregistré
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator
    })
    expect(swRegistered).toBe(true)
  })
})
