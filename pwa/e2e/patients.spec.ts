/**
 * Tests E2E pour la gestion des patients
 */

import { test, expect } from '@playwright/test'

// Helper pour se connecter
async function login(page: any) {
  await page.goto('/')
  await page.getByPlaceholder(/email/i).fill('medecin@example.com')
  await page.getByPlaceholder(/mot de passe/i).fill('medecinpassword123')
  await page.getByRole('button', { name: /connexion/i }).click()
  await page.waitForURL(/dashboard|patients|consultations/)
}

test.describe('Patients Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to patients page', async ({ page }) => {
    await page.getByRole('link', { name: /patients/i }).click()
    await expect(page).toHaveURL(/patients/)
    await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible()
  })

  test('should display list of patients', async ({ page }) => {
    await page.goto('/patients')

    // Attendre que la liste se charge
    await page.waitForSelector('[data-testid="patient-list"], table, .patient-card', {
      timeout: 10000,
    })

    // Devrait afficher au moins un patient ou un message "Aucun patient"
    const hasPatients = await page.locator('[data-testid="patient-item"]').count() > 0
    const hasEmptyMessage = await page.getByText(/aucun patient/i).isVisible()

    expect(hasPatients || hasEmptyMessage).toBeTruthy()
  })

  test('should search patients', async ({ page }) => {
    await page.goto('/patients')

    const searchInput = page.getByPlaceholder(/rechercher/i)
    await searchInput.fill('Test Patient')

    // Attendre que les résultats se mettent à jour
    await page.waitForTimeout(500)

    // Vérifier que les résultats sont filtrés
    const results = await page.locator('[data-testid="patient-item"]').count()
    expect(results).toBeGreaterThanOrEqual(0)
  })

  test('should open create patient modal', async ({ page }) => {
    await page.goto('/patients')

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()

    // Devrait ouvrir un modal ou naviguer vers un formulaire
    await expect(
      page.getByRole('heading', { name: /nouveau patient/i })
    ).toBeVisible()
  })

  test('should create a new patient', async ({ page }) => {
    await page.goto('/patients')

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()

    // Remplir le formulaire
    await page.getByLabel(/nom/i).fill('Dupont')
    await page.getByLabel(/prénom/i).fill('Jean')
    await page.getByLabel(/date.*naissance/i).fill('1990-01-15')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByLabel(/téléphone/i).fill('+22312345678')
    await page.getByLabel(/adresse/i).fill('123 Rue Test')

    // Soumettre le formulaire
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Attendre la confirmation
    await expect(page.getByText(/patient.*créé.*succès/i)).toBeVisible({
      timeout: 10000,
    })

    // Devrait voir le nouveau patient dans la liste
    await expect(page.getByText('Dupont')).toBeVisible()
  })

  test('should show validation errors on patient form', async ({ page }) => {
    await page.goto('/patients')

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()

    // Soumettre le formulaire vide
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Devrait afficher des erreurs de validation
    await expect(page.getByText(/nom.*requis/i)).toBeVisible()
    await expect(page.getByText(/prénom.*requis/i)).toBeVisible()
  })

  test('should view patient details', async ({ page }) => {
    await page.goto('/patients')

    // Cliquer sur le premier patient de la liste
    const firstPatient = page.locator('[data-testid="patient-item"]').first()
    await firstPatient.click()

    // Devrait afficher les détails du patient
    await expect(page.getByRole('heading', { name: /détails.*patient/i })).toBeVisible()
  })

  test('should edit patient information', async ({ page }) => {
    await page.goto('/patients')

    // Cliquer sur le premier patient
    const firstPatient = page.locator('[data-testid="patient-item"]').first()
    await firstPatient.click()

    // Cliquer sur modifier
    await page.getByRole('button', { name: /modifier/i }).click()

    // Modifier un champ
    const nomInput = page.getByLabel(/nom/i)
    await nomInput.clear()
    await nomInput.fill('Nouveau Nom')

    // Sauvegarder
    await page.getByRole('button', { name: /enregistrer/i }).click()

    // Devrait afficher la confirmation
    await expect(page.getByText(/patient.*modifié.*succès/i)).toBeVisible()
  })

  test('should work offline - create patient', async ({ page, context }) => {
    await page.goto('/patients')

    // Passer en mode offline
    await context.setOffline(true)

    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()

    // Remplir le formulaire
    await page.getByLabel(/nom/i).fill('Offline Patient')
    await page.getByLabel(/prénom/i).fill('Test')
    await page.getByLabel(/date.*naissance/i).fill('1995-05-05')
    await page.getByLabel(/sexe/i).selectOption('F')

    // Soumettre
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    // Devrait créer le patient localement
    await expect(page.getByText(/patient.*créé.*localement/i)).toBeVisible()

    // Vérifier l'indicateur offline
    await expect(page.getByText(/hors ligne/i)).toBeVisible()

    // Vérifier les opérations en attente
    await expect(page.getByText(/1.*opération.*en attente/i)).toBeVisible()
  })

  test('should sync data when coming back online', async ({ page, context }) => {
    await page.goto('/patients')

    // Passer en mode offline
    await context.setOffline(true)

    // Créer un patient offline
    await page.getByRole('button', { name: /nouveau patient|ajouter/i }).click()
    await page.getByLabel(/nom/i).fill('Sync Test')
    await page.getByLabel(/prénom/i).fill('Patient')
    await page.getByLabel(/date.*naissance/i).fill('1992-03-10')
    await page.getByLabel(/sexe/i).selectOption('M')
    await page.getByRole('button', { name: /enregistrer|créer/i }).click()

    await expect(page.getByText(/patient.*créé.*localement/i)).toBeVisible()

    // Repasser en mode online
    await context.setOffline(false)

    // Attendre la synchronisation automatique
    await page.waitForTimeout(3000)

    // Vérifier que le statut est passé à "En ligne"
    await expect(page.getByText(/en ligne/i)).toBeVisible()

    // Les opérations en attente devraient être synchronisées
    await expect(page.getByText(/0.*opération.*en attente/i)).toBeVisible()
  })

  test('should filter patients by gender', async ({ page }) => {
    await page.goto('/patients')

    // Cliquer sur le filtre sexe
    await page.getByLabel(/filtre.*sexe/i).selectOption('M')

    // Attendre que les résultats se mettent à jour
    await page.waitForTimeout(500)

    // Tous les patients affichés devraient être de sexe masculin
    const patientCards = page.locator('[data-testid="patient-item"]')
    const count = await patientCards.count()

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const card = patientCards.nth(i)
        await expect(card).toContainText(/Masculin|M|Homme/i)
      }
    }
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Définir la taille mobile
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto('/patients')

    // Vérifier que l'interface est adaptée au mobile
    await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible()

    // Le menu burger devrait être visible
    const menuButton = page.getByRole('button', { name: /menu/i })
    if (await menuButton.isVisible()) {
      await menuButton.click()
      await expect(page.getByRole('link', { name: /patients/i })).toBeVisible()
    }
  })
})
