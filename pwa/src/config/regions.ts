/**
 * Configuration multi-pays pour Santé Rurale
 * Permet d'adapter l'application selon le contexte de déploiement
 */

export interface RegionConfig {
  /** Nom du pays */
  country: string

  /** Code pays ISO 3166-1 alpha-2 */
  countryCode: string

  /** Langue(s) supportée(s) */
  languages: string[]

  /** Langue par défaut */
  defaultLanguage: string

  /** Nomenclature des divisions administratives */
  divisions: {
    level1: string // Ex: "Région", "Province", "État"
    level2: string // Ex: "District", "Département", "Comté"
    level3: string // Ex: "Site", "Centre de santé", "Poste de santé"
  }

  /** Format de téléphone */
  phoneFormat: string

  /** Exemple de numéro de téléphone */
  phoneExample: string

  /** Configuration DHIS2 (optionnel) */
  dhis2?: {
    enabled: boolean
    endpoint?: string
    orgUnitLevel?: number
  }

  /** Devise locale */
  currency: string

  /** Fuseau horaire */
  timezone: string
}

/**
 * Configurations disponibles par pays
 */
export const REGION_CONFIGS: Record<string, RegionConfig> = {
  // Mali (déploiement pilote)
  'mali': {
    country: 'Mali',
    countryCode: 'ML',
    languages: ['fr', 'bm'], // français, bambara
    defaultLanguage: 'fr',
    divisions: {
      level1: 'Région',
      level2: 'District',
      level3: 'CSCOM'
    },
    phoneFormat: '+223 XX XX XX XX',
    phoneExample: '+223 76 12 34 56',
    dhis2: {
      enabled: true,
      endpoint: process.env.VITE_DHIS2_ENDPOINT,
      orgUnitLevel: 3
    },
    currency: 'XOF', // Franc CFA
    timezone: 'Africa/Bamako'
  },

  // Sénégal
  'senegal': {
    country: 'Sénégal',
    countryCode: 'SN',
    languages: ['fr', 'wo'], // français, wolof
    defaultLanguage: 'fr',
    divisions: {
      level1: 'Région',
      level2: 'Département',
      level3: 'Poste de santé'
    },
    phoneFormat: '+221 XX XXX XX XX',
    phoneExample: '+221 77 123 45 67',
    dhis2: {
      enabled: true,
      endpoint: process.env.VITE_DHIS2_ENDPOINT,
      orgUnitLevel: 3
    },
    currency: 'XOF',
    timezone: 'Africa/Dakar'
  },

  // Burkina Faso
  'burkina': {
    country: 'Burkina Faso',
    countryCode: 'BF',
    languages: ['fr', 'mos'], // français, mooré
    defaultLanguage: 'fr',
    divisions: {
      level1: 'Région',
      level2: 'Province',
      level3: 'CSPS'
    },
    phoneFormat: '+226 XX XX XX XX',
    phoneExample: '+226 70 12 34 56',
    dhis2: {
      enabled: true,
      endpoint: process.env.VITE_DHIS2_ENDPOINT,
      orgUnitLevel: 3
    },
    currency: 'XOF',
    timezone: 'Africa/Ouagadougou'
  },

  // Niger
  'niger': {
    country: 'Niger',
    countryCode: 'NE',
    languages: ['fr', 'ha'], // français, haoussa
    defaultLanguage: 'fr',
    divisions: {
      level1: 'Région',
      level2: 'Département',
      level3: 'Case de santé'
    },
    phoneFormat: '+227 XX XX XX XX',
    phoneExample: '+227 90 12 34 56',
    dhis2: {
      enabled: true,
      endpoint: process.env.VITE_DHIS2_ENDPOINT,
      orgUnitLevel: 3
    },
    currency: 'XOF',
    timezone: 'Africa/Niamey'
  },

  // Configuration générique (par défaut)
  'generic': {
    country: 'Pays',
    countryCode: 'XX',
    languages: ['fr', 'en'],
    defaultLanguage: 'fr',
    divisions: {
      level1: 'Région',
      level2: 'District',
      level3: 'Centre de santé'
    },
    phoneFormat: '+XXX XX XX XX XX',
    phoneExample: '+000 00 00 00 00',
    dhis2: {
      enabled: false
    },
    currency: 'USD',
    timezone: 'UTC'
  }
}

/**
 * Récupère la configuration active selon l'environnement
 */
export function getActiveConfig(): RegionConfig {
  const region = import.meta.env.VITE_DEPLOYMENT_REGION || 'generic'
  return REGION_CONFIGS[region] || REGION_CONFIGS.generic
}

/**
 * Hook pour accéder à la configuration régionale
 */
export function useRegionConfig(): RegionConfig {
  return getActiveConfig()
}
