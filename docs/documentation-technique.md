# Documentation technique — CaisseCI

Guide pour développeurs, intégrateurs et DevOps.

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Navigateur (PWA)                                           │
│  React 19 + Vite + Dexie (IndexedDB)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Site public │  │ Caisse staff │  │ Boutique client  │  │
│  │ /, /tarifs  │  │ /staff       │  │ /boutique/MAG-XX │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP /api/*
┌───────────────────────────▼─────────────────────────────────┐
│  Express (Node.js) — server/server.ts                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────┐ │
│  │ billing  │ │ storefront│ │ mobileMoney│ │ sync/webhooks │ │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └───────┬───────┘ │
└───────┼────────────┼─────────────┼────────────────┼─────────┘
        │            │             │                │
        ▼            ▼             ▼                ▼
   MongoDB      CinetPay       Stripe          Partenaires
   (Prisma)     (MM CI)        (carte)         (webhooks)
```

### Principes

- **Offline-first** : la caisse fonctionne sans réseau ; Dexie stocke ventes, produits, stocks localement.
- **Licence cloud** : l’abonnement est vérifié via l’API ; cache local 7 jours (`OFFLINE_GRACE_HOURS = 168`).
- **Monolithe déployable** : en production, Express sert `dist/` (SPA) + API sur le même port.

---

## 2. Stack technique

| Couche | Technologies |
|--------|--------------|
| Frontend | React 19, TypeScript, Vite 7, Tailwind CSS 4 |
| Stockage local | Dexie 4 (IndexedDB), localStorage (config intégrations) |
| PWA | vite-plugin-pwa, service worker Workbox |
| Backend | Express 4, tsx (dev), Node ESM |
| ORM / DB | Prisma 6, MongoDB |
| Paiements | Stripe, CinetPay |
| Validation | Zod |

---

## 3. Structure du projet

```
CaisseCI/
├── prisma/schema.prisma      # Schéma MongoDB
├── server/
│   ├── server.ts             # Point d’entrée Express
│   ├── routes/
│   │   ├── billing.ts        # Abonnement, register, login, Stripe
│   │   ├── mobileMoney.ts    # CinetPay checkout & notify
│   │   ├── storefront.ts     # Boutique en ligne API
│   │   ├── sync.ts           # Réception lots sync cloud
│   │   └── webhooks.ts       # Webhooks commandes / SMS
│   └── lib/
│       ├── subscriptionPlans.ts
│       ├── ownerAuth.ts      # Hash scrypt Gmail gérant
│       ├── cinetpay.ts, stripe.ts, sms.ts
│       └── prisma.ts
├── src/
│   ├── App.tsx               # Routage SPA (marketing, caisse, abonnement)
│   ├── Shell.tsx             # Orchestrateur modules caisse
│   ├── navigation.ts         # Modules, rôles, menus
│   ├── views/                # Écrans métiers
│   ├── components/           # UI réutilisable
│   ├── context/              # Subscription, ActiveStore
│   ├── db/                   # Dexie schema & types
│   ├── lib/                  # API client, subscription, routes
│   └── auth/                 # Session staff, permissions
├── public/                   # Assets statiques, branding, marketing
└── docs/                     # Documentation
```

---

## 4. Routage frontend

Défini dans `src/lib/siteRoutes.ts` et `src/App.tsx`.

| Chemin | Composant | Condition |
|--------|-----------|-----------|
| `/boutique/:code` | `PublicStorefrontPage` | Toujours public |
| `/inscription`, `/connexion` | `OrganizationSetup` | Sans organisation |
| `/`, `/tarifs` | `MarketingSiteView` | Sans organisation |
| `/abonnement` | `SubscriptionManagementPage` | Organisation connectée |
| `/staff` | `LoginScreen` → `Shell` | Organisation + staff PIN |

La navigation interne caisse utilise un état `NavViewId` dans `Shell.tsx` (pas de React Router).

---

## 5. Authentification

### Gérant (organisation)

- **Inscription** : `POST /api/billing/register` — Gmail obligatoire, mot de passe hashé (scrypt).
- **Connexion** : `POST /api/billing/login` — retourne un snapshot abonnement.
- **Credentials** : stockés en `localStorage` via `SubscriptionContext`.
- **Header API** : `x-license-key` pour les appels authentifiés.

Fichiers : `server/lib/ownerAuth.ts`, `src/lib/subscription/ownerAuth.ts`.

### Staff (caisse)

- Profils locaux Dexie avec **PIN** à 4 chiffres.
- Session : `src/auth/session.ts` (`caisseci-staff-session`).
- Rôles : `caissier`, `gerant`, `admin` — permissions dans `src/auth/permissions.ts`.

---

## 6. Abonnement

### Plans (`server/lib/subscriptionPlans.ts`)

| ID | Prix FCFA | Magasins | Staff |
|----|-----------|----------|-------|
| `starter` | 9 900 | 1 | 3 |
| `pro` | 24 900 | 3 | 10 |
| `business` | 49 900 | 20 | 50 |

- `TRIAL_DAYS = 30` (1 mois d’essai)
- Statuts : `trialing`, `active`, `past_due`, `canceled`, `expired`

### Feature gating

`src/lib/subscription/plans.ts` — `VIEW_MIN_PLAN` associe chaque module à un plan minimum.

`SubscriptionContext` bloque l’accès aux vues non incluses dans le plan actif.

### Paiements

| Canal | Fichiers | Webhook |
|-------|----------|---------|
| Stripe (carte) | `server/lib/stripe.ts` | `POST /api/billing/webhook` |
| CinetPay (MM) | `server/lib/cinetpay.ts` | `POST /api/billing/cinetpay/notify` |

Opérateurs CI : Orange Money, Wave, MTN MoMo, Moov.

---

## 7. API REST

Base : `/api` (proxy Vite → `:4000` en dev).

### Billing

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/billing/plans` | Liste des plans + `trialDays` |
| POST | `/billing/register` | Créer organisation |
| POST | `/billing/login` | Connexion gérant |
| POST | `/billing/attach` | Rejoindre magasin par code |
| GET | `/billing/status` | État abonnement (`x-license-key`) |
| PATCH | `/billing/settings` | SMS, téléphone facturation |
| GET | `/billing/payments/history` | Historique paiements |
| POST | `/billing/checkout` | Session Stripe Checkout |
| POST | `/billing/portal` | Portail client Stripe |

### Mobile money

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/billing/mobile-money/channels` | Opérateurs disponibles |
| POST | `/billing/mobile-money/checkout` | Initier paiement CinetPay |
| GET | `/billing/mobile-money/verify/:id` | Vérifier statut transaction |
| GET | `/billing/mobile-money/demo` | Page simulation (dev) |

### Boutique en ligne

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/billing/storefront/:storeCode` | Infos magasin public |
| GET | `/billing/storefront/:storeCode/menu` | Catalogue publié |
| POST | `/billing/storefront/:storeCode/orders` | Passer commande |
| POST | `/billing/storefront/publish` | Publier menu (`x-license-key`) |
| GET | `/billing/storefront/orders/inbox` | Boîte commandes gérant |
| PATCH | `/billing/storefront/orders/:id` | Mettre à jour statut |

### Sync & webhooks

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/caisseci/sync` | Réception lot sync ventes/stocks |
| POST | `/webhooks/orders` | Commandes partenaires |
| POST | `/webhooks/caisseci` | Webhook historique |
| POST | `/webhooks/sms` | Accusés SMS |

### Santé

| Méthode | Route |
|---------|-------|
| GET | `/health` |

---

## 8. Base de données (Prisma / MongoDB)

Schéma : `prisma/schema.prisma`.

### Modèles principaux

| Modèle | Rôle |
|--------|------|
| `Organization` | Compte entreprise, plan, licence, code magasin |
| `MobileMoneyPayment` | Transactions CinetPay |
| `StorefrontOrder` | Commandes boutique en ligne |
| `SubscriptionReminderLog` | SMS rappels J-3 / J-1 |
| `SyncBatch` / `SyncItem` | Lots synchronisation cloud |
| `WebhookEvent` | Événements entrants |

### Commandes Prisma

```bash
npm run prisma:generate   # Générer le client
npm run prisma:push       # Pousser le schéma vers MongoDB
npm run db:up             # MongoDB local (Docker Compose)
```

---

## 9. Données locales (Dexie)

Fichier principal : `src/db/db.ts`.

Tables IndexedDB :

- Produits, catégories, stocks
- Ventes, lignes de vente
- Commandes en ligne
- Tables, réservations
- Personnel, pointages
- File de synchronisation (`syncQueue`)
- Journaux d’audit

Le seed initial est chargé par `ensureSeed()` au démarrage.

---

## 10. Synchronisation cloud

Variable : `VITE_CLOUD_SYNC_URL` → `POST /api/caisseci/sync`.

Payload :

```json
{
  "batchId": "uuid",
  "sentAt": 1234567890,
  "items": [
    { "kind": "sale", "createdAt": "...", "payload": { } }
  ]
}
```

Sans URL configurée, la file est vidée en mode démo (latence simulée).

---

## 11. PWA et mode offline

- Manifest : `vite.config.ts` → `VitePWA`
- Service worker : cache assets, fallback `index.html`
- `useOnlineStatus` : détection réseau + bandeau
- Mode kiosk : `npm run dev:offline` / `npm run build:offline`

---

## 12. Intégrations matérielles (démo)

Configuration : `src/lib/integrationsConfig.ts` (localStorage).

Clés :

- `caisseci-device-order-terminals`
- `caisseci-device-receipt-printers`
- `caisseci-device-kds-screens`
- `caisseci-device-cash-drawer`
- `caisseci-device-payment-terminals`

Logique checkout : `src/lib/checkoutPayment.ts`, `src/components/CartPanel.tsx`.

---

## 13. Variables d’environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Prod | URI MongoDB |
| `PORT` | Non | Port serveur (défaut 4000) |
| `APP_URL` | Prod paiements | URL publique HTTPS |
| `STRIPE_SECRET_KEY` | Optionnel | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Optionnel | Signature webhooks |
| `STRIPE_CURRENCY` | Non | Défaut `xof` |
| `CINETPAY_API_KEY` | Optionnel | API CinetPay |
| `CINETPAY_SITE_ID` | Optionnel | Site CinetPay |
| `CINETPAY_DEMO_MODE` | Non | `true` = simulation locale |
| `SMS_PROVIDER_URL` | Optionnel | Endpoint envoi SMS |
| `SMS_PROVIDER_TOKEN` | Optionnel | Token SMS |
| `SUBSCRIPTION_REMINDER_INTERVAL_HOURS` | Non | Planificateur rappels (défaut 6) |
| `VITE_CLOUD_SYNC_URL` | Non | URL sync côté client |

---

## 14. Développement

```bash
# Installation
npm install
cp .env.example .env

# MongoDB + schéma
npm run db:up
npm run prisma:generate
npm run prisma:push

# Dev fullstack
npm run dev:full
# → API http://localhost:4000
# → App http://localhost:5173 (proxy /api)
```

### Scripts utiles

| Script | Usage |
|--------|-------|
| `npm run lint` | ESLint |
| `npm run build` | tsc + vite build + compile serveur |
| `npm start` | Production (`server-dist/server.js`) |
| `npm run dev:kiosk` | API + frontend offline |

---

## 15. Déploiement

### Build

```bash
npm run build
NODE_ENV=production npm start
```

### Checklist production

1. `DATABASE_URL` MongoDB Atlas configuré
2. `APP_URL` en HTTPS (obligatoire Stripe / CinetPay)
3. Webhooks Stripe et CinetPay pointant vers `/api/billing/webhook` et `/api/billing/cinetpay/notify`
4. `prisma db push` ou migration sur la base cible
5. Health check : `GET /health`

### Hébergement

Compatible Render, Railway, VPS, etc. Un seul service web suffit (API + fichiers statiques `dist/`).

---

## 16. Sécurité

- Ne jamais exposer `STRIPE_SECRET_KEY`, `CINETPAY_API_KEY` côté client.
- Mots de passe gérant : hash scrypt, validation Gmail côté serveur.
- Webhooks : vérifier signatures (Stripe) et tokens partenaires.
- `x-license-key` : traiter comme secret organisation.
- Journaliser annulations, remises et validations sensibles.

---

## 17. Extensions recommandées

- Drivers matériels réels (TPE, imprimantes ESC/POS réseau)
- Tests E2E (Playwright) sur parcours caisse et abonnement
- Migration script pour comptes sans `passwordHash`
- Monitoring (`/health`, logs structurés, Sentry)
- CI : `npm run build && npm run lint`

---

## 18. Références code

| Sujet | Fichiers clés |
|-------|---------------|
| Checkout caisse | `Shell.tsx`, `CartPanel.tsx`, `checkoutPayment.ts` |
| KDS | `KitchenView.tsx` |
| Abonnement UI | `SubscriptionView.tsx`, `SubscriptionContext.tsx` |
| Onboarding | `OrganizationSetup.tsx` |
| Boutique luxe | `LuxuryStorefrontView.tsx`, `PublicStorefrontPage.tsx` |
| Marketing | `MarketingSiteView.tsx`, `src/components/marketing/` |
| Modules catalogue | `src/lib/subscription/moduleCatalog.ts` |
