/**
 * Tests pour le composant Layout
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Layout } from '../../components/Layout'
import { AuthProvider } from '../../contexts/AuthContext'
import { SyncProvider } from '../../contexts/SyncContext'

const renderLayout = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <Layout>
            <div>Test Content</div>
          </Layout>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('Layout Component', () => {
  it('should render the application header', () => {
    renderLayout()

    // Devrait afficher le titre de l'application
    expect(screen.getByText(/Santé Rurale/i)).toBeInTheDocument()
  })

  it('should render children content', () => {
    renderLayout()

    expect(screen.getByText('Test Content')).toBeInTheDocument()
  })

  it('should render navigation links', () => {
    renderLayout()

    // Vérifier la présence de liens de navigation
    const navLinks = screen.getAllByRole('link')
    expect(navLinks.length).toBeGreaterThan(0)
  })

  it('should render footer', () => {
    renderLayout()

    // Devrait afficher le footer avec copyright
    expect(screen.getByText(/© 2025 Santé Rurale/i)).toBeInTheDocument()
  })

  it('should have responsive layout classes', () => {
    const { container } = renderLayout()

    // Vérifier que le layout a des classes responsive
    const layoutElement = container.firstChild as HTMLElement
    expect(layoutElement.className).toBeTruthy()
  })

  it('should render sync indicator', () => {
    renderLayout()

    // Devrait afficher l'indicateur de synchronisation
    const syncIndicator = screen.getByRole('status')
    expect(syncIndicator).toBeInTheDocument()
  })
})
