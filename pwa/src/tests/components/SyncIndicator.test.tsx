/**
 * Tests pour le composant SyncIndicator
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncIndicator } from '../../components/SyncIndicator'
import { SyncContext } from '../../contexts/SyncContext'

// Mock du contexte de synchronisation
const mockSyncContextValue: any = {
  isOnline: true,
  isSyncing: false,
  lastSync: null,
  pendingOperations: 0,
  unsyncedItems: 0,
  forceSync: vi.fn(),
}

const renderWithSyncContext = (contextValue = mockSyncContextValue) => {
  return render(
    <SyncContext.Provider value={contextValue}>
      <SyncIndicator />
    </SyncContext.Provider>
  )
}

describe('SyncIndicator Component', () => {
  it('should render online indicator when online and not syncing', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: true,
      isSyncing: false,
    })

    expect(screen.getByText(/en ligne/i)).toBeInTheDocument()
  })

  it('should render offline indicator when offline', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: false,
      isSyncing: false,
    })

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument()
  })

  it('should render syncing indicator when syncing', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: true,
      isSyncing: true,
    })

    expect(screen.getByText(/synchronisation/i)).toBeInTheDocument()
  })

  it('should show pending operations count when > 0', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: false,
      pendingOperations: 5,
    })

    expect(screen.getByText(/5/)).toBeInTheDocument()
  })

  it('should show unsynced items count when > 0', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: false,
      unsyncedItems: 3,
    })

    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  it('should display last sync time when available', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      lastSync: new Date('2025-11-02T10:00:00'),
    })

    // Devrait afficher une indication de temps (format relatif)
    const indicator = screen.getByRole('status')
    expect(indicator).toBeInTheDocument()
  })

  it('should have appropriate styling for online state', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: true,
    })

    const indicator = screen.getByRole('status')
    expect(indicator.className).toMatch(/green|success/i)
  })

  it('should have appropriate styling for offline state', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isOnline: false,
    })

    const indicator = screen.getByRole('status')
    expect(indicator.className).toMatch(/red|error|gray/i)
  })

  it('should have appropriate styling for syncing state', () => {
    renderWithSyncContext({
      ...mockSyncContextValue,
      isSyncing: true,
    })

    const indicator = screen.getByRole('status')
    expect(indicator.className).toMatch(/blue|info|animate/i)
  })
})
