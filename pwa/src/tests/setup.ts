/**
 * Configuration de l'environnement de test pour vitest
 */

import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Cleanup après chaque test
afterEach(() => {
  cleanup()
})

// Mock de l'API localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock as any

// Mock de l'API sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.sessionStorage = sessionStorageMock as any

// Mock de navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
})

// Mock de window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock de IndexedDB (Dexie)
// Note: Pour des tests Dexie complets, utiliser fake-indexeddb
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
} as any

// Mock de fetch
global.fetch = vi.fn()

// Variables d'environnement pour les tests
process.env.VITE_API_URL = 'http://localhost:8000/api'
