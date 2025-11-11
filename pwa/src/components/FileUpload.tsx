import { useState, useRef } from 'react'
import { attachmentsService } from '../services/api'

interface FileUploadProps {
  patientId?: string
  encounterId?: string
  onUploadSuccess?: () => void
  accept?: string
  maxSizeMB?: number
}

export const FileUpload = ({
  patientId,
  encounterId,
  onUploadSuccess,
  accept = 'image/*,.pdf,.doc,.docx',
  maxSizeMB = 50,
}: FileUploadProps) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Vérifier la taille
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      setError(`Fichier trop volumineux. Maximum: ${maxSizeMB} MB`)
      return
    }

    setError(null)
    setSuccess(null)
    setUploading(true)

    try {
      await attachmentsService.upload(file, patientId, encounterId)
      setSuccess(`✅ ${file.name} uploadé avec succès`)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      if (onUploadSuccess) {
        onUploadSuccess()
      }

      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Erreur upload:', err)
      setError(err.response?.data?.detail || 'Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Ajouter un fichier</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={uploading}
          className="mt-1 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </label>

      {uploading && (
        <div className="text-sm text-blue-600">
          ⏳ Upload en cours...
        </div>
      )}

      {success && (
        <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
          {success}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
          ⚠️ {error}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Formats acceptés : Images, PDF, Documents | Max: {maxSizeMB} MB
      </p>
    </div>
  )
}
