import jsPDF from 'jspdf'

interface Patient {
  nom: string
  prenom?: string
  sexe: string
  annee_naissance?: number
  telephone?: string
  village?: string
}

interface Medication {
  medicament: string
  posologie: string
  duree_jours?: number
  notes?: string
}

interface Condition {
  libelle: string
  notes?: string
}

interface PrescriptionData {
  patient: Patient
  date: string
  conditions: Condition[]
  medications: Medication[]
  notes?: string
  doctorName: string
  siteName: string
}

/**
 * Génère un PDF d'ordonnance médicale
 */
export const generatePrescriptionPDF = (data: PrescriptionData) => {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDONNANCE MÉDICALE', 105, 20, { align: 'center' })

  // Informations du centre
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(data.siteName, 105, 30, { align: 'center' })
  doc.text(`Dr. ${data.doctorName}`, 105, 35, { align: 'center' })

  // Ligne de séparation
  doc.line(20, 40, 190, 40)

  // Informations patient
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('PATIENT', 20, 50)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const patientFullName = `${data.patient.nom} ${data.patient.prenom || ''}`.trim()
  doc.text(`Nom: ${patientFullName}`, 20, 57)

  const age = data.patient.annee_naissance
    ? new Date().getFullYear() - data.patient.annee_naissance
    : null

  doc.text(`Sexe: ${data.patient.sexe === 'M' ? 'Masculin' : 'Féminin'}`, 20, 64)
  if (age) doc.text(`Âge: ${age} ans`, 20, 71)
  if (data.patient.village) doc.text(`Village: ${data.patient.village}`, 20, 78)
  if (data.patient.telephone) doc.text(`Tél: ${data.patient.telephone}`, 20, 85)

  // Date
  doc.text(`Date: ${new Date(data.date).toLocaleDateString('fr-FR')}`, 140, 57)

  // Diagnostic
  let yPos = 100

  if (data.conditions.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('DIAGNOSTIC', 20, yPos)
    yPos += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    data.conditions.forEach((condition) => {
      doc.text(`• ${condition.libelle}`, 25, yPos)
      yPos += 6
      if (condition.notes) {
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(`  ${condition.notes}`, 30, yPos)
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
        yPos += 5
      }
    })

    yPos += 5
  }

  // Traitement
  if (data.medications.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('TRAITEMENT', 20, yPos)
    yPos += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    data.medications.forEach((med, index) => {
      // Vérifier si on a assez de place, sinon nouvelle page
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFont('helvetica', 'bold')
      doc.text(`${index + 1}. ${med.medicament}`, 25, yPos)
      yPos += 6

      doc.setFont('helvetica', 'normal')
      doc.text(`   Posologie: ${med.posologie}`, 30, yPos)
      yPos += 6

      if (med.duree_jours) {
        doc.text(`   Durée: ${med.duree_jours} jours`, 30, yPos)
        yPos += 6
      }

      if (med.notes) {
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        const lines = doc.splitTextToSize(`   Note: ${med.notes}`, 150)
        doc.text(lines, 30, yPos)
        yPos += lines.length * 5
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
      }

      yPos += 3
    })
  }

  // Notes générales
  if (data.notes) {
    yPos += 10
    if (yPos > 250) {
      doc.addPage()
      yPos = 20
    }

    doc.setFont('helvetica', 'bold')
    doc.text('REMARQUES', 20, yPos)
    yPos += 7

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const notesLines = doc.splitTextToSize(data.notes, 170)
    doc.text(notesLines, 20, yPos)
    yPos += notesLines.length * 5
  }

  // Signature
  const signatureY = Math.max(yPos + 20, 250)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Signature et cachet du médecin', 120, signatureY)
  doc.line(120, signatureY + 2, 180, signatureY + 2)

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    'Document généré par Santé Rurale - Ne peut servir de prescription sans signature',
    105,
    285,
    { align: 'center' }
  )

  return doc
}

/**
 * Télécharge le PDF d'ordonnance
 */
export const downloadPrescriptionPDF = (data: PrescriptionData, filename?: string) => {
  const doc = generatePrescriptionPDF(data)
  const defaultFilename = `ordonnance_${data.patient.nom}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename || defaultFilename)
}
