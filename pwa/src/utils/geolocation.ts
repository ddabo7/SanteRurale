/**
 * Utilitaire pour détecter la localisation de l'utilisateur et déterminer la devise appropriée
 */

export interface GeolocationInfo {
  country: string
  countryCode: string
  currency: string
  timezone: string
}

// Mapping pays -> devise
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  // Zone FCFA (Afrique de l'Ouest - UEMOA)
  BJ: 'XOF', // Bénin
  BF: 'XOF', // Burkina Faso
  CI: 'XOF', // Côte d'Ivoire
  GW: 'XOF', // Guinée-Bissau
  ML: 'XOF', // Mali
  NE: 'XOF', // Niger
  SN: 'XOF', // Sénégal
  TG: 'XOF', // Togo

  // Zone FCFA (Afrique Centrale - CEMAC)
  CM: 'XAF', // Cameroun
  CF: 'XAF', // République Centrafricaine
  TD: 'XAF', // Tchad
  CG: 'XAF', // Congo
  GQ: 'XAF', // Guinée Équatoriale
  GA: 'XAF', // Gabon

  // Zone Euro
  FR: 'EUR', // France
  BE: 'EUR', // Belgique
  DE: 'EUR', // Allemagne
  ES: 'EUR', // Espagne
  IT: 'EUR', // Italie
  PT: 'EUR', // Portugal
  NL: 'EUR', // Pays-Bas
  AT: 'EUR', // Autriche
  GR: 'EUR', // Grèce
  IE: 'EUR', // Irlande
  LU: 'EUR', // Luxembourg
  FI: 'EUR', // Finlande

  // Autres devises africaines
  DZ: 'DZD', // Algérie
  MA: 'MAD', // Maroc
  TN: 'TND', // Tunisie
  EG: 'EGP', // Égypte
  NG: 'NGN', // Nigeria
  GH: 'GHS', // Ghana
  KE: 'KES', // Kenya
  ZA: 'ZAR', // Afrique du Sud

  // Amérique du Nord
  US: 'USD', // États-Unis
  CA: 'CAD', // Canada

  // Royaume-Uni
  GB: 'GBP', // Royaume-Uni

  // Suisse
  CH: 'CHF', // Suisse
}

// Devise par défaut (FCFA pour l'Afrique de l'Ouest)
const DEFAULT_CURRENCY = 'XOF'

/**
 * Détecte la devise basée sur le fuseau horaire du navigateur
 * Utilisé comme fallback si l'API de géolocalisation échoue
 */
function getCurrencyFromTimezone(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Fuseaux horaires africains -> FCFA
    if (timezone.startsWith('Africa/')) {
      const city = timezone.split('/')[1]
      // Zone UEMOA (XOF)
      const uemoaCities = ['Dakar', 'Abidjan', 'Bamako', 'Ouagadougou', 'Niamey', 'Lome', 'Cotonou', 'Bissau']
      if (uemoaCities.includes(city)) {
        return 'XOF'
      }
      // Zone CEMAC (XAF)
      const cemacCities = ['Douala', 'Libreville', 'Brazzaville', 'Bangui', 'Ndjamena', 'Malabo']
      if (cemacCities.includes(city)) {
        return 'XAF'
      }
      // Autres pays africains
      if (city === 'Algiers') return 'DZD'
      if (city === 'Cairo') return 'EGP'
      if (city === 'Casablanca') return 'MAD'
      if (city === 'Tunis') return 'TND'
      if (city === 'Lagos') return 'NGN'
      if (city === 'Nairobi') return 'KES'
      if (city === 'Johannesburg') return 'ZAR'
    }

    // Europe
    if (timezone.startsWith('Europe/')) {
      const euroCountries = ['Paris', 'Brussels', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Vienna', 'Athens', 'Dublin', 'Lisbon', 'Luxembourg', 'Helsinki']
      const city = timezone.split('/')[1]
      if (euroCountries.includes(city)) return 'EUR'
      if (city === 'London') return 'GBP'
      if (city === 'Zurich') return 'CHF'
    }

    // Amérique
    if (timezone.startsWith('America/')) {
      if (timezone.includes('New_York') || timezone.includes('Chicago') || timezone.includes('Los_Angeles')) {
        return 'USD'
      }
      if (timezone.includes('Toronto') || timezone.includes('Vancouver') || timezone.includes('Montreal')) {
        return 'CAD'
      }
    }

    return DEFAULT_CURRENCY
  } catch (error) {
    console.warn('Erreur détection timezone:', error)
    return DEFAULT_CURRENCY
  }
}

/**
 * Détecte le pays via l'API ipapi.co (gratuit, 30k req/mois)
 */
async function detectCountryViaIP(): Promise<string | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000), // Timeout 5s
    })

    if (!response.ok) {
      throw new Error('Erreur API ipapi.co')
    }

    const data = await response.json()
    return data.country_code || null
  } catch (error) {
    console.warn('Erreur détection IP:', error)
    return null
  }
}

/**
 * Détecte la localisation de l'utilisateur et retourne la devise appropriée
 */
export async function detectUserCurrency(): Promise<string> {
  try {
    // 1. Essayer de détecter via IP (plus précis)
    const countryCode = await detectCountryViaIP()

    if (countryCode && COUNTRY_CURRENCY_MAP[countryCode]) {
      console.log('✅ Devise détectée via IP:', countryCode, '->', COUNTRY_CURRENCY_MAP[countryCode])
      return COUNTRY_CURRENCY_MAP[countryCode]
    }

    // 2. Fallback: détecter via timezone
    const currencyFromTz = getCurrencyFromTimezone()
    console.log('✅ Devise détectée via timezone:', currencyFromTz)
    return currencyFromTz

  } catch (error) {
    console.warn('Erreur détection devise, utilisation par défaut:', error)
    return DEFAULT_CURRENCY
  }
}

/**
 * Obtient les informations complètes de géolocalisation
 */
export async function getGeolocationInfo(): Promise<GeolocationInfo> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error('Erreur API ipapi.co')
    }

    const data = await response.json()

    return {
      country: data.country_name || 'Inconnu',
      countryCode: data.country_code || 'XX',
      currency: COUNTRY_CURRENCY_MAP[data.country_code] || DEFAULT_CURRENCY,
      timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  } catch (error) {
    console.warn('Erreur géolocalisation complète:', error)

    // Fallback avec timezone seulement
    return {
      country: 'Inconnu',
      countryCode: 'XX',
      currency: getCurrencyFromTimezone(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }
}

/**
 * Stocke la devise détectée dans le localStorage pour éviter les appels répétés
 */
export function getCachedOrDetectCurrency(): Promise<string> {
  const CACHE_KEY = 'user_detected_currency'
  const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 jours

  try {
    const cached = localStorage.getItem(CACHE_KEY)

    if (cached) {
      const { currency, timestamp } = JSON.parse(cached)
      const isExpired = Date.now() - timestamp > CACHE_DURATION

      if (!isExpired) {
        console.log('✅ Devise depuis cache:', currency)
        return Promise.resolve(currency)
      }
    }
  } catch (error) {
    console.warn('Erreur lecture cache devise:', error)
  }

  // Détecter et mettre en cache
  return detectUserCurrency().then((currency) => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          currency,
          timestamp: Date.now(),
        })
      )
    } catch (error) {
      console.warn('Erreur sauvegarde cache devise:', error)
    }
    return currency
  })
}
