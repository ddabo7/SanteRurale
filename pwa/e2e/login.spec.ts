/**
 * Tests E2E pour le flux de connexion
 */

import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Santé Rurale/)
    await expect(page.getByRole('heading', { name: /Santé Rurale/i })).toBeVisible()
  })

  test('should show validation errors for empty form', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: /connexion/i })
    await loginButton.click()

    // Devrait afficher des erreurs de validation
    await expect(page.getByText(/email.*requis/i)).toBeVisible()
    await expect(page.getByText(/mot de passe.*requis/i)).toBeVisible()
  })

  test('should show error for invalid email format', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('invalid-email')
    await page.getByPlaceholder(/mot de passe/i).fill('password123')
    await page.getByRole('button', { name: /connexion/i }).click()

    await expect(page.getByText(/email.*invalide/i)).toBeVisible()
  })

  test('should show error for wrong credentials', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('wrong@example.com')
    await page.getByPlaceholder(/mot de passe/i).fill('wrongpassword')
    await page.getByRole('button', { name: /connexion/i }).click()

    // Attendre la réponse de l'API
    await page.waitForResponse(response =>
      response.url().includes('/auth/login') && response.status() === 401
    )

    await expect(page.getByText(/identifiants.*invalides/i)).toBeVisible()
  })

  test('should successfully login with valid credentials', async ({ page }) => {
    // Utiliser les credentials de test
    await page.getByPlaceholder(/email/i).fill('test@example.com')
    await page.getByPlaceholder(/mot de passe/i).fill('testpassword123')
    await page.getByRole('button', { name: /connexion/i }).click()

    // Attendre la réponse de l'API
    await page.waitForResponse(response =>
      response.url().includes('/auth/login') && response.status() === 200
    )

    // Devrait être redirigé vers le dashboard
    await expect(page).toHaveURL(/dashboard|patients|consultations/)
  })

  test('should persist session after page reload', async ({ page }) => {
    // Se connecter
    await page.getByPlaceholder(/email/i).fill('test@example.com')
    await page.getByPlaceholder(/mot de passe/i).fill('testpassword123')
    await page.getByRole('button', { name: /connexion/i }).click()

    await page.waitForURL(/dashboard|patients|consultations/)

    // Recharger la page
    await page.reload()

    // Devrait rester connecté
    await expect(page).toHaveURL(/dashboard|patients|consultations/)
    await expect(page.getByRole('button', { name: /déconnexion/i })).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    // Se connecter d'abord
    await page.getByPlaceholder(/email/i).fill('test@example.com')
    await page.getByPlaceholder(/mot de passe/i).fill('testpassword123')
    await page.getByRole('button', { name: /connexion/i }).click()

    await page.waitForURL(/dashboard|patients|consultations/)

    // Se déconnecter
    await page.getByRole('button', { name: /déconnexion/i }).click()

    // Devrait être redirigé vers la page de login
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: /connexion/i })).toBeVisible()
  })

  test('should remember email with "Remember me" checkbox', async ({ page }) => {
    const email = 'remember@example.com'

    await page.getByPlaceholder(/email/i).fill(email)
    await page.getByLabel(/se souvenir/i).check()

    // Recharger la page
    await page.reload()

    // L'email devrait être pré-rempli
    await expect(page.getByPlaceholder(/email/i)).toHaveValue(email)
  })

  test('should be accessible with keyboard navigation', async ({ page }) => {
    // Tab vers le champ email
    await page.keyboard.press('Tab')
    await expect(page.getByPlaceholder(/email/i)).toBeFocused()

    // Tab vers le champ mot de passe
    await page.keyboard.press('Tab')
    await expect(page.getByPlaceholder(/mot de passe/i)).toBeFocused()

    // Tab vers le bouton de connexion
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab') // Skip "remember me"
    await expect(page.getByRole('button', { name: /connexion/i })).toBeFocused()
  })
})
