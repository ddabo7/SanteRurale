#!/usr/bin/env python3
import re

# Lire le fichier
with open('src/services/offlineFirst.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Code à insérer
new_code = '''
          // Vérifier si c'est une erreur de quota (402)
          if (error.response?.status === 402 || error.status === 402) {
            console.warn('⚠️ Quota dépassé - arrêt des tentatives')
            await db.markOperationProcessed(op.id)
            
            // Afficher un popup pour upgrader
            const shouldUpgrade = window.confirm(
              "Quota dépassé ! Votre abonnement gratuit est limité à 50 patients. Souhaitez-vous upgrader votre abonnement ?"
            )
            
            if (shouldUpgrade) {
              window.location.href = '/subscription'
            }
            
            result.failed++
            result.errors.push(`Quota dépassé: ${error.response?.data?.detail || error.message}`)
            continue
          }
'''

# Trouver et remplacer
pattern = r"(console\.error\(`❌ Échec opération \$\{op\.id\}:`, error\)\n)"
replacement = r"\1" + new_code

content = re.sub(pattern, replacement, content)

# Écrire le fichier
with open('src/services/offlineFirst.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Modification effectuée avec succès!")
