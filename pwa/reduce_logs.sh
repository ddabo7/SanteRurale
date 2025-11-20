#!/bin/bash

# 1. Réduire le log dans api.ts (402 = info au lieu d'erreur)
sed -i.bak2 "s/console\.error('❌ API Error:'/console.debug('🔍 API Error:'/" src/services/api.ts

# 2. Réduire le log dans offlineFirst.ts pour le 402
sed -i.bak3 '/❌ Échec opération/,/console\.error/ {
  /status === 402/ {
    s/console\.error/console.debug/
  }
}' src/services/offlineFirst.ts

# 3. Modifier spécifiquement la ligne 442 pour être plus silencieux sur le 402
awk '
/console\.error\(`❌ Échec opération/ {
  print "          // Log moins verbeux pour les erreurs de quota"
  print "          if (error.response?.status === 402 || error.status === 402) {"
  print "            console.debug(`ℹ️ Quota atteint pour opération ${op.id}`)"
  print "          } else {"
  print "            console.error(`❌ Échec opération ${op.id}:`, error)"
  print "          }"
  next
}
{ print }
' src/services/offlineFirst.ts > src/services/offlineFirst.ts.tmp && mv src/services/offlineFirst.ts.tmp src/services/offlineFirst.ts

echo "✅ Logs réduits pour les erreurs 402"
