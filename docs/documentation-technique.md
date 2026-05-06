# Documentation technique

## 1) Stack technique

- Frontend: React + TypeScript + Vite
- UI: composants internes + classes utilitaires CSS
- Stockage local: Dexie (IndexedDB)
- Backend (connecteurs): serveur Node/Express (routes webhook)

## 2) Structure applicative (résumé)

- `src/Shell.tsx`: orchestrateur principal de l'application et des vues
- `src/views/*`: modules métiers (caisse, KDS, intégrations, stocks, etc.)
- `src/components/*`: composants réutilisables d'interface
- `src/lib/*`: logique utilitaire et configuration
- `src/db/*`: schéma et accès aux données locales
- `server/routes/webhooks.ts`: endpoints webhook entrants

## 3) Données locales et persistance

L'application utilise Dexie pour:

- ventes
- commandes en ligne
- produits/stocks
- tables/réservations
- files de synchronisation
- journaux annexes

Les options d'intégration et d'équipement sont persistées en `localStorage` via `src/lib/integrationsConfig.ts`.

## 4) Intégrations matérielles

### 4.1 Configuration

La configuration matérielle démo est portée par:

- `getDeviceConnectivityDemo()`
- `setDeviceConnectivityDemo()`

Clés stockées:

- `caisseci-device-order-terminals`
- `caisseci-device-receipt-printers`
- `caisseci-device-kds-screens`
- `caisseci-device-cash-drawer`
- `caisseci-device-payment-terminals`

### 4.2 Effets fonctionnels branchés

- **Terminaux de paiement OFF**
  - blocage des paiements carte/mobile (et parts électroniques en mixte)
- **Imprimantes tickets OFF**
  - génération du reçu conservée, impression auto désactivée
- **Tiroir-caisse OFF**
  - confirmation explicite avant encaissement avec espèces
- **Écrans cuisine (KDS) OFF**
  - alertes sonores KDS suspendues
  - SLA auto suspendu
  - contrôles Son/SLA désactivés visuellement
  - transmission auto KDS suspendue

## 5) KDS: logique principale

Fichier principal: `src/views/KitchenView.tsx`

Capacités:

- tri des tickets par priorité puis ancienneté
- workflow statuts (`queued`, `preparing`, `ready`, `served`)
- priorité manuelle (`low`, `normal`, `high`)
- mode SLA automatique:
  - seuil configurable (minutes)
  - escalade en priorité haute au dépassement
  - notifications/alertes associées

Comportement visuel:

- badge "SLA dépassé"
- accentuation visuelle des tickets dépassés
- animation limitée au ticket SLA le plus ancien

## 6) Encaissement: logique principale

Fichiers clés:

- `src/Shell.tsx` (workflow de checkout)
- `src/components/CartPanel.tsx` (UI de paiement)
- `src/lib/checkoutPayment.ts` (validation métier paiement)

Points notables:

- validation stricte des montants (espèces, mixte, références TPE/mobile)
- confirmation utilisateur avant finalisation
- création de vente + décrément stock + fidélité + queue de sync en transaction Dexie

## 7) Webhooks et commandes en ligne

Fichier: `server/routes/webhooks.ts`

Endpoints principaux:

- `POST /api/webhooks/orders` (intégrations externes)
- `POST /api/webhooks/caisseci` (endpoint historique)

Fonctions attendues:

- validation de token (`x-webhook-token`)
- normalisation des payloads multi-plateformes
- persistance des événements entrants

## 8) Sécurité et exploitation

Recommandations:

- ne jamais exposer de secrets côté client
- protéger les endpoints webhook par token fort et rotation
- journaliser les actions sensibles (annulations, remises, validations)
- monitorer les erreurs d'intégration et files de sync

## 9) Build et qualité

Commandes courantes:

- `npm run dev` pour le développement
- `npm run build` pour validation TypeScript + bundling

Après modifications majeures:

- vérifier les diagnostics linter
- valider les parcours caisse, KDS et intégrations matérielles

## 10) Extensions recommandées

- brancher la connectivité matérielle sur des drivers réels (TPE, imprimantes réseau, ESC/POS)
- ajouter une page de santé matériel (latence, dernier heartbeat, erreurs)
- ajouter des tests E2E pour les scénarios "matériel OFF"

