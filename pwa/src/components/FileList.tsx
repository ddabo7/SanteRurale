import { useEffect, useState } from 'react'
import { attachmentsService } from '../services/api'

interface Attachment {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_at: string | null
  download_url: string | null
}

interface FileListProps {
  patientId?: string
  encounterId?: string
  refreshTrigger?: number
}

export const FileList = ({ patientId, encounterId, refreshTrigger }: FileListProps) => {
  const [files, setFiles] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadFiles = async () => {
    try {
      setLoading(true)
      const data = await attachmentsService.list(patientId, encounterId)
      setFiles(data)
    } catch (err) {
      console.error('Erreur chargement fichiers:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (fileId: string, filename: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${filename}" ?`)) {
      return
    }

    try {
      setDeletingId(fileId)
      await attachmentsService.delete(fileId)
      // Recharger la liste après suppression
      await loadFiles()
    } catch (err: any) {
      console.error('Erreur suppression fichier:', err)
      alert(err.response?.data?.detail || 'Erreur lors de la suppression du fichier')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [patientId, encounterId, refreshTrigger])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    return '📎'
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Chargement des fichiers...</div>
  }

  if (files.length === 0) {
    return <div className="text-sm text-gray-500 italic">Aucun fichier uploadé</div>
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Fichiers ({files.length})</h4>
      <div className="space-y-1">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm"
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <span>{getFileIcon(file.mime_type)}</span>
              <span className="truncate font-medium text-gray-700">{file.filename}</span>
              <span className="text-xs text-gray-500">({formatFileSize(file.size_bytes)})</span>
            </div>
            <div className="flex items-center space-x-2">
              {file.download_url && (
                <a
                  href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}${file.download_url}`}
                  download
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ⬇️ Télécharger
                </a>
              )}
              <button
                onClick={() => handleDelete(file.id, file.filename)}
                disabled={deletingId === file.id}
                className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Supprimer le fichier"
              >
                {deletingId === file.id ? '⏳' : '🗑️'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
