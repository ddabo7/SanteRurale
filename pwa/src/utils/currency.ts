/**
 * Utilitaires pour la gestion des devises
 */

// Mapping des codes ISO 4217 vers les symboles/noms de devises
const CURRENCY_SYMBOLS: { [key: string]: string } = {
  XOF: 'FCFA',      // Franc CFA (Afrique de l'Ouest)
  GNF: 'GNF',       // Franc Guinéen
  EUR: '€',         // Euro
  USD: '$',         // Dollar US
  XAF: 'FCFA',      // Franc CFA (Afrique Centrale)
  MAD: 'MAD',       // Dirham Marocain
  TND: 'TND',       // Dinar Tunisien
  DZD: 'DZD',       // Dinar Algérien
}

// Taux de conversion depuis l'Euro (base de données stocke en EUR)
// Ces taux sont approximatifs et devraient être mis à jour régulièrement
const EXCHANGE_RATES: { [key: string]: number } = {
  EUR: 1,           // Euro (devise de base)
  XOF: 655.957,     // 1 EUR = 655.957 FCFA
  XAF: 655.957,     // 1 EUR = 655.957 FCFA (même taux que XOF)
  GNF: 10500,       // 1 EUR ≈ 10500 GNF
  USD: 1.08,        // 1 EUR ≈ 1.08 USD
  MAD: 10.5,        // 1 EUR ≈ 10.5 MAD
  TND: 3.3,         // 1 EUR ≈ 3.3 TND
  DZD: 145,         // 1 EUR ≈ 145 DZD
}

/**
 * Convertit un montant en euros vers une autre devise
 * @param amountInEur - Le montant en euros (tel que stocké en base de données)
 * @param targetCurrency - La devise cible (XOF, GNF, USD, etc.)
 * @returns Le montant converti
 */
export function convertFromEuro(amountInEur: number, targetCurrency: string): number {
  const rate = EXCHANGE_RATES[targetCurrency] || 1
  return Math.round(amountInEur * rate)
}

/**
 * Formate un montant avec la devise appropriée
 * @param amountInEur - Le montant en euros (tel que stocké en base de données)
 * @param currencyCode - Code ISO 4217 de la devise cible (XOF, EUR, USD, etc.)
 * @returns Le montant converti et formaté avec la devise
 */
export function formatCurrency(
  amountInEur: number,
  currencyCode: string = 'XOF'
): string {
  // Convertir le montant vers la devise cible
  const convertedAmount = convertFromEuro(amountInEur, currencyCode)

  // Formater le montant avec séparateurs de milliers
  const formattedAmount = convertedAmount.toLocaleString('fr-FR')
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode

  // Pour EUR et USD, on met le symbole avant
  if (currencyCode === 'EUR' || currencyCode === 'USD') {
    return `${symbol}${formattedAmount}`
  }

  // Pour les autres devises (FCFA, GNF, etc.), on met après
  return `${formattedAmount} ${symbol}`
}

/**
 * Récupère le symbole de la devise
 * @param currencyCode - Code ISO 4217 de la devise
 * @returns Le symbole ou le code de la devise
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode
}
