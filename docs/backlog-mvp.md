# Backlog MVP - Santé Rurale

## Vue d'ensemble

Ce backlog détaille les **user stories** pour le MVP (Minimum Viable Product) de la PWA Santé Rurale.

**Durée estimée MVP**: 12 semaines (3 sprints de 4 semaines)

**Priorités**:
- **P0**: Critique - bloquant pour le MVP
- **P1**: Important - requis pour le MVP
- **P2**: Souhaitable - peut être reporté post-MVP

---

## Epic 1: Gestion des patients

### US-001: Créer un nouveau patient (Offline)

**Priorité**: P0

**En tant que** soignant
**Je veux** créer un nouveau dossier patient même sans connexion internet
**Afin de** ne pas perdre de temps pendant la consultation et assurer la continuité des soins

**Critères d'acceptation**:
- [ ] Le formulaire "Nouveau patient" est accessible depuis l'écran d'accueil
- [ ] Les champs obligatoires sont: Nom, Sexe
- [ ] Les champs optionnels sont: Prénom, Année de naissance, Téléphone, Village
- [ ] La validation empêche la soumission si un champ obligatoire est vide
- [ ] En mode offline, le patient est enregistré dans IndexedDB
- [ ] Un message de confirmation s'affiche: "Patient enregistré localement"
- [ ] Un badge "Non synchronisé" apparaît sur le patient
- [ ] Le patient est immédiatement visible dans la liste des patients

**Définition du "Fini" (DoD)**:
- [ ] Code implémenté et testé unitairement
- [ ] Test E2E Playwright réussi
- [ ] Revue de code approuvée
- [ ] Documentation mise à jour

**Estimation**: 5 points

---

### US-002: Rechercher un patient

**Priorité**: P0

**En tant que** soignant
**Je veux** rechercher rapidement un patient par nom, prénom ou téléphone
**Afin de** retrouver son dossier avant une consultation

**Critères d'acceptation**:
- [ ] Une barre de recherche est visible en haut de la liste des patients
- [ ] La recherche fonctionne offline (IndexedDB)
- [ ] La recherche fonctionne online (API)
- [ ] La recherche est fuzzy (tolère les fautes de frappe)
- [ ] Les résultats s'affichent au fur et à mesure de la saisie (debounce 300ms)
- [ ] Les résultats montrent: Nom, Prénom, Âge, Village
- [ ] Maximum 50 résultats affichés
- [ ] Un message s'affiche si aucun résultat: "Aucun patient trouvé"

**DoD**: Idem US-001

**Estimation**: 3 points

---

### US-003: Consulter le dossier d'un patient

**Priorité**: P0

**En tant que** soignant
**Je veux** voir l'historique complet d'un patient
**Afin de** prendre des décisions cliniques éclairées

**Critères d'acceptation**:
- [ ] Le dossier affiche: Informations démographiques, 5 dernières consultations
- [ ] Chaque consultation montre: Date, Motif, Diagnostics, Ordonnances
- [ ] Un bouton "Voir toutes les consultations" permet d'afficher l'historique complet
- [ ] Le dossier est accessible offline
- [ ] Le temps de chargement est < 2s (offline) et < 3s (online)

**DoD**: Idem US-001

**Estimation**: 5 points

---

### US-004: Modifier les informations d'un patient

**Priorité**: P1

**En tant que** soignant
**Je veux** corriger ou compléter les informations d'un patient
**Afin de** maintenir des dossiers à jour

**Critères d'acceptation**:
- [ ] Un bouton "Modifier" est accessible depuis le dossier patient
- [ ] Le formulaire est pré-rempli avec les données actuelles
- [ ] La modification fonctionne offline avec queue de synchronisation
- [ ] Si une modification simultanée a eu lieu (conflit), un avertissement s'affiche
- [ ] L'historique des modifications est enregistré (audit log)

**DoD**: Idem US-001

**Estimation**: 5 points

---

## Epic 2: Consultations médicales

### US-005: Créer une consultation (Offline)

**Priorité**: P0

**En tant que** soignant
**Je veux** enregistrer une consultation même hors-ligne
**Afin de** documenter chaque acte médical sans dépendre du réseau

**Critères d'acceptation**:
- [ ] Depuis le dossier patient, un bouton "Nouvelle consultation" est disponible
- [ ] Le formulaire permet de saisir:
  - [ ] Date (par défaut: aujourd'hui)
  - [ ] Motif de consultation
  - [ ] Signes vitaux (Température, Pouls, Pression artérielle, Poids, Taille)
  - [ ] Notes libres
- [ ] Les signes vitaux ont des validations (ex: température 30-45°C)
- [ ] En mode offline, la consultation est enregistrée localement
- [ ] La consultation enregistrée apparaît immédiatement dans l'historique du patient

**DoD**: Idem US-001

**Estimation**: 8 points

---

### US-006: Ajouter des diagnostics

**Priorité**: P0

**En tant que** soignant
**Je veux** sélectionner un ou plusieurs diagnostics CIM-10
**Afin de** documenter les pathologies identifiées

**Critères d'acceptation**:
- [ ] Dans le formulaire de consultation, une section "Diagnostics" permet d'ajouter 1 à N diagnostics
- [ ] Un champ de recherche permet de trouver rapidement un diagnostic par nom
- [ ] Une liste prédéfinie des diagnostics fréquents est disponible (Paludisme, IRA, Diarrhée, etc.)
- [ ] Chaque diagnostic montre son code CIM-10 et son libellé
- [ ] Il est possible d'ajouter un diagnostic personnalisé (sans code CIM-10)
- [ ] Les diagnostics sont enregistrés avec la consultation

**DoD**: Idem US-001

**Estimation**: 5 points

---

### US-007: Prescrire une ordonnance

**Priorité**: P0

**En tant que** soignant
**Je veux** prescrire des médicaments à partir de la liste des médicaments essentiels
**Afin de** garantir des prescriptions conformes au protocole national

**Critères d'acceptation**:
- [ ] Dans le formulaire de consultation, une section "Ordonnance" permet d'ajouter 1 à N médicaments
- [ ] Un champ de recherche permet de trouver rapidement un médicament
- [ ] Une liste prédéfinie des médicaments essentiels est disponible (Artésunate, Amoxicilline, ORS, etc.)
- [ ] Pour chaque médicament, on peut saisir:
  - [ ] Posologie (ex: "1-0-1")
  - [ ] Durée (en jours)
  - [ ] Quantité et unité
- [ ] L'ordonnance peut être exportée en PDF (online ou offline)
- [ ] L'ordonnance est enregistrée avec la consultation

**DoD**: Idem US-001

**Estimation**: 8 points

---

### US-008: Enregistrer des actes médicaux

**Priorité**: P1

**En tant que** soignant
**Je veux** enregistrer les actes effectués (Test rapide, Vaccination, Pansement, etc.)
**Afin de** tracer tous les soins prodigués

**Critères d'acceptation**:
- [ ] Dans le formulaire de consultation, une section "Actes" permet d'ajouter des actes
- [ ] Une liste prédéfinie est disponible: TDR Paludisme, Vaccination (BCG, Polio...), Pansement, etc.
- [ ] Pour chaque acte, on peut saisir un résultat (ex: TDR Positif/Négatif)
- [ ] Les actes sont enregistrés avec la consultation

**DoD**: Idem US-001

**Estimation**: 3 points

---

## Epic 3: Références (Transferts)

### US-009: Créer une référence vers un centre supérieur

**Priorité**: P1

**En tant que** soignant
**Je veux** référer un patient vers l'hôpital de district
**Afin de** garantir une prise en charge adaptée pour les cas graves

**Critères d'acceptation**:
- [ ] Depuis une consultation, un bouton "Référer le patient" est disponible
- [ ] Le formulaire demande:
  - [ ] Destination (ex: Hôpital de Ségou)
  - [ ] Raison de la référence
  - [ ] Heure d'arrivée estimée (ETA)
- [ ] Un SMS/WhatsApp de confirmation est envoyé au tuteur du patient (si téléphone renseigné) - **sans contenu clinique**
- [ ] Le SMS contient uniquement: "Votre proche a été référé vers [destination]. Présentez-vous à [ETA]."
- [ ] La référence est visible dans le dossier patient avec son statut (En attente, Confirmé, Complété)

**DoD**: Idem US-001

**Estimation**: 8 points

---

## Epic 4: Synchronisation Offline

### US-010: Synchroniser automatiquement quand le réseau revient

**Priorité**: P0

**En tant que** soignant
**Je veux** que mes enregistrements offline se synchronisent automatiquement
**Afin de** ne pas avoir à le faire manuellement et éviter les pertes de données

**Critères d'acceptation**:
- [ ] Un indicateur visuel montre le statut: "Hors ligne" (rouge) ou "En ligne" (vert)
- [ ] Quand le réseau revient, la synchronisation démarre automatiquement dans les 30 secondes
- [ ] Un indicateur de progression s'affiche pendant la sync: "Synchronisation en cours... (3/10)"
- [ ] En cas d'erreur de sync, un message s'affiche: "Erreur de synchronisation. Réessai dans 5 min."
- [ ] Les opérations réussies sont retirées de la queue locale (outbox)
- [ ] Le nombre d'opérations en attente est visible: "3 modifications non synchronisées"

**DoD**: Idem US-001 + Test E2E de synchronisation offline→online

**Estimation**: 13 points

---

### US-011: Gérer les conflits de synchronisation

**Priorité**: P1

**En tant que** soignant
**Je veux** être averti si mes modifications entrent en conflit avec une autre modification
**Afin de** résoudre les conflits sans perdre de données

**Critères d'acceptation**:
- [ ] Si un conflit est détecté (versions différentes), un écran de résolution s'affiche
- [ ] L'écran montre les deux versions: locale et serveur (côte à côte)
- [ ] L'utilisateur peut choisir: "Garder ma version", "Garder la version serveur", ou "Fusionner"
- [ ] La résolution est enregistrée et synchronisée
- [ ] Les conflits résolus sont tracés dans l'audit log

**DoD**: Idem US-001

**Estimation**: 8 points

---

### US-012: Forcer une synchronisation manuelle

**Priorité**: P2

**En tant que** soignant
**Je veux** pouvoir déclencher manuellement une synchronisation
**Afin de** m'assurer que mes données sont bien envoyées avant de partir en mission

**Critères d'acceptation**:
- [ ] Un bouton "Synchroniser maintenant" est accessible depuis le menu
- [ ] Le bouton est désactivé si déjà en cours de sync
- [ ] Un message de confirmation s'affiche après sync réussie
- [ ] Le timestamp de dernière sync est affiché: "Dernière sync: il y a 5 min"

**DoD**: Idem US-001

**Estimation**: 3 points

---

## Epic 5: Rapports & Exports

### US-013: Consulter les statistiques du site

**Priorité**: P1

**En tant que** Major du CSCOM
**Je veux** voir un résumé des activités de mon site
**Afin de** suivre la performance et préparer les rapports

**Critères d'acceptation**:
- [ ] Un écran "Rapports" est accessible depuis le menu
- [ ] Le rapport affiche pour la période sélectionnée (semaine/mois):
  - [ ] Nombre total de consultations
  - [ ] Nombre de nouveaux patients
  - [ ] Consultations enfants < 5 ans
  - [ ] Top 5 des diagnostics
  - [ ] Nombre de références
- [ ] Les données sont calculées localement (offline OK)
- [ ] Le rapport peut être exporté en CSV

**DoD**: Idem US-001

**Estimation**: 8 points

---

### US-014: Exporter vers DHIS2 (mensuel)

**Priorité**: P1

**En tant que** Major du CSCOM
**Je veux** exporter les données agrégées vers DHIS2
**Afin de** remplir mes obligations de rapportage national

**Critères d'acceptation**:
- [ ] Un bouton "Exporter vers DHIS2" est disponible dans l'écran Rapports
- [ ] L'export demande de sélectionner:
  - [ ] Période (mois)
  - [ ] Option "Simulation" (dry-run) pour valider sans envoyer
- [ ] Une pré-validation locale s'exécute avant l'envoi
- [ ] Si des erreurs sont détectées, elles sont affichées avec des suggestions de correction
- [ ] Un récapitulatif de l'export est affiché: "456 consultations, 89 cas de paludisme, etc."
- [ ] Le statut de l'export est visible: "En cours", "Réussi", "Échoué"
- [ ] En cas d'échec, l'erreur DHIS2 est affichée clairement

**DoD**: Idem US-001 + Test d'intégration avec instance DHIS2 de test

**Estimation**: 13 points

---

## Epic 6: Authentification & Sécurité

### US-015: Se connecter à l'application

**Priorité**: P0

**En tant que** soignant
**Je veux** me connecter avec mon email et mot de passe
**Afin de** accéder à l'application de manière sécurisée

**Critères d'acceptation**:
- [ ] Un écran de connexion est affiché au démarrage si non connecté
- [ ] Le formulaire demande: Email et Mot de passe
- [ ] Un message d'erreur s'affiche si les identifiants sont incorrects
- [ ] Après 5 tentatives échouées, le compte est verrouillé pour 30 minutes
- [ ] Un message de bienvenue s'affiche après connexion: "Bienvenue, [Nom]"
- [ ] Le token JWT est stocké localement (avec sécurité)
- [ ] L'accès reste possible en mode offline (token local valide)

**DoD**: Idem US-001

**Estimation**: 5 points

---

### US-016: Se déconnecter

**Priorité**: P0

**En tant que** soignant
**Je veux** me déconnecter de l'application
**Afin de** protéger la confidentialité des patients si je partage mon appareil

**Critères d'acceptation**:
- [ ] Un bouton "Déconnexion" est accessible depuis le menu
- [ ] Une confirmation est demandée: "Voulez-vous vraiment vous déconnecter ?"
- [ ] L'utilisateur est averti s'il reste des modifications non synchronisées
- [ ] Après déconnexion, toutes les données locales sensibles sont effacées (tokens, cache IndexedDB optionnel)
- [ ] L'utilisateur est redirigé vers l'écran de connexion

**DoD**: Idem US-001

**Estimation**: 3 points

---

## Epic 7: Interface Utilisateur

### US-017: Navigation intuitive

**Priorité**: P0

**En tant que** soignant
**Je veux** naviguer facilement entre les différentes sections
**Afin de** gagner du temps pendant les consultations

**Critères d'acceptation**:
- [ ] Un menu de navigation (bottom nav ou sidebar) est toujours accessible
- [ ] Les sections principales sont: Accueil, Patients, Rapports, Mon compte
- [ ] Le nombre de modifications en attente de sync est affiché sur l'icône Sync
- [ ] Le bouton "Retour" fonctionne de manière cohérente
- [ ] Les transitions entre écrans sont fluides (< 100ms)

**DoD**: Idem US-001

**Estimation**: 5 points

---

### US-018: Interface adaptée aux écrans mobiles

**Priorité**: P0

**En tant que** soignant utilisant un smartphone Android
**Je veux** une interface optimisée pour mon écran 5-7 pouces
**Afin de** pouvoir utiliser l'app confortablement

**Critères d'acceptation**:
- [ ] Toute l'interface est responsive (mobile-first)
- [ ] Les boutons ont une taille minimale de 44x44 px (tap targets)
- [ ] Les polices sont lisibles (≥ 14px)
- [ ] Les formulaires utilisent les claviers appropriés (numérique pour âge, etc.)
- [ ] Le contraste des couleurs respecte les normes AA (accessibilité)

**DoD**: Idem US-001 + Test sur 3 appareils différents (petit/moyen/grand écran)

**Estimation**: 5 points

---

## Récapitulatif du Backlog MVP

| Epic | User Stories | Total Points | Priorité |
|------|--------------|--------------|----------|
| Gestion des patients | US-001 à US-004 | 18 | P0-P1 |
| Consultations | US-005 à US-008 | 24 | P0-P1 |
| Références | US-009 | 8 | P1 |
| Synchronisation | US-010 à US-012 | 24 | P0-P1 |
| Rapports & Exports | US-013 à US-014 | 21 | P1 |
| Authentification | US-015 à US-016 | 8 | P0 |
| Interface | US-017 à US-018 | 10 | P0 |
| **Total** | **18 stories** | **113 points** | - |

**Vélocité estimée**: 30-40 points/sprint (4 semaines)

**Durée MVP**: 3 sprints (12 semaines)

---

## Planification par Sprint

### Sprint 1 (Fondations)
- US-001, US-002, US-003 (Patients)
- US-015, US-016 (Auth)
- US-017, US-018 (UI)
- **Total**: ~35 points

### Sprint 2 (Consultations & Sync)
- US-005, US-006, US-007, US-008 (Consultations)
- US-010 (Sync auto)
- **Total**: ~37 points

### Sprint 3 (Rapports & Polissage)
- US-004 (Modifier patient)
- US-009 (Références)
- US-011, US-012 (Conflits sync)
- US-013, US-014 (Rapports DHIS2)
- **Total**: ~41 points

---

## Post-MVP (V2)

Stories candidates pour la version 2:
- Gestion de stock pharmacie
- Télésanté (photos, store-and-forward)
- Courbes de croissance enfants
- Suivi prénatal
- Carnet de vaccination
- Notifications push (rappels RDV)
- Support multilingue (Bambara, Tamasheq)
