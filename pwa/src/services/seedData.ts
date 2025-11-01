import { db } from '../db'
import type { Patient } from '../db'

// Noms et prénoms typiquement maliens
const NOMS_MALIENS = [
  'TRAORÉ', 'DIARRA', 'COULIBALY', 'KEITA', 'KONÉ', 'SANGARÉ', 'DIALLO',
  'SISSOKO', 'DEMBÉLÉ', 'BAH', 'TOURÉ', 'KONATÉ', 'CAMARA', 'OUATTARA',
  'SAMAKÉ', 'SIDIBÉ', 'CISSÉ', 'MAÏGA', 'DIAKITÉ', 'FOFANA'
]

const PRENOMS_MASCULINS = [
  'Amadou', 'Mamadou', 'Ibrahim', 'Ousmane', 'Seydou', 'Moussa', 'Bakary',
  'Abdoulaye', 'Modibo', 'Souleymane', 'Boubacar', 'Adama', 'Mahamadou',
  'Youssouf', 'Cheick', 'Drissa', 'Lassine', 'Fodé', 'Siaka', 'Kalifa'
]

const PRENOMS_FEMININS = [
  'Fatoumata', 'Aminata', 'Mariam', 'Aissata', 'Kadiatou', 'Oumou', 'Ramata',
  'Safiatou', 'Rokia', 'Hawa', 'Awa', 'Djénéba', 'Assétou', 'Salimata',
  'Nana', 'Korotoumou', 'Bintu', 'Fanta', 'Tenin', 'Yacou ba'
]

const VILLAGES = [
  'Koulikoro', 'Kati', 'Dioïla', 'Kangaba', 'Banamba', 'Kolokani',
  'Nara', 'Nioro du Sahel', 'Ségou', 'San', 'Sikasso', 'Bougouni',
  'Kayes', 'Mopti', 'Tombouctou', 'Gao', 'Kidal'
]

const genererTelephone = (): string => {
  const prefixes = ['70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '90', '91']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const numero = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
  return `+223 ${prefix} ${numero.slice(0, 2)} ${numero.slice(2, 4)} ${numero.slice(4, 6)}`
}

const generatePatientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `patient-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const genererPatient = (index: number): Patient => {
  const sexe = Math.random() > 0.5 ? 'M' : 'F'
  const nom = NOMS_MALIENS[Math.floor(Math.random() * NOMS_MALIENS.length)]
  const prenom = sexe === 'M'
    ? PRENOMS_MASCULINS[Math.floor(Math.random() * PRENOMS_MASCULINS.length)]
    : PRENOMS_FEMININS[Math.floor(Math.random() * PRENOMS_FEMININS.length)]

  const age = Math.floor(Math.random() * 70) + 5 // Entre 5 et 75 ans
  const annee_naissance = new Date().getFullYear() - age

  const village = VILLAGES[Math.floor(Math.random() * VILLAGES.length)]

  const currentYear = new Date().getFullYear()
  const siteCode = 'CSKO' // Koulikoro
  const matricule = `${siteCode}-${currentYear}-${(index + 1).toString().padStart(4, '0')}`

  const now = new Date()

  return {
    id: generatePatientId(),
    nom,
    prenom,
    sexe,
    annee_naissance,
    telephone: Math.random() > 0.3 ? genererTelephone() : undefined,
    village,
    matricule,
    site_id: 'site-1',
    created_at: new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: now.toISOString(),
    version: 1,
    _synced: true,
  }
}

export const seedDatabase = async () => {
  try {
    // Vérifier si la base est déjà initialisée
    const existingPatients = await db.patients.count()

    if (existingPatients > 0) {
      console.log(`✅ Base de données déjà initialisée avec ${existingPatients} patients`)
      return
    }

    console.log('🌱 Initialisation de la base de données avec des patients...')

    // Générer 50 patients
    const patients: Patient[] = Array.from({ length: 50 }, (_, index) => genererPatient(index))

    // Insérer les patients
    await db.patients.bulkAdd(patients)

    console.log(`✅ ${patients.length} patients ajoutés avec succès`)
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la base de données:', error)
  }
}
