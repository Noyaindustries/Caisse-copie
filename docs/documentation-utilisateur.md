# Documentation utilisateur — CaisseCI

Guide d’utilisation pour les gérants, caissiers et administrateurs.

---

## 1. Vue d’ensemble

**CaisseCI** (Infinitecore Système) est une caisse enregistreuse et une plateforme de gestion magasin **offline-first**, adaptée aux commerces en Côte d’Ivoire.

### Ce que l’application couvre

- Encaissement en caisse (POS)
- Catalogue produits et gestion des stocks
- Commandes en ligne et livraison
- Écran cuisine (KDS)
- Tables et réservations
- Fidélité client et promotions
- Reporting, comptabilité et analytique
- Multi-magasins, CRM, RH
- Abonnement et paiements (mobile money, carte)
- Boutique en ligne publique pour vos clients

### Modes d’utilisation

| Mode | Accès | Usage |
|------|-------|-------|
| **Site commercial** | `/` | Découverte, tarifs, inscription |
| **Espace gérant** | `/inscription`, `/connexion`, `/abonnement` | Création du magasin, licence, facturation |
| **Caisse staff** | `/staff` | Connexion PIN des employés |
| **Boutique client** | `/boutique/MAG-XXXX` | Commande en ligne par les clients |

---

## 2. Premiers pas

### 2.1 Créer un magasin (gérant)

1. Aller sur **Inscription** (`/inscription`) ou cliquer sur « Créer mon compte » depuis le site.
2. Choisir un **plan** : Starter, Pro ou Business.
3. Renseigner :
   - **Nom de l’entreprise**
   - **Adresse Gmail** du gérant (`@gmail.com`)
   - **Mot de passe** (8 caractères minimum)
4. Valider — vous recevez :
   - Un **code magasin** (ex. `MAG-A1B2`)
   - Une **clé de licence** (visible dans Abonnement)
   - **1 mois d’essai gratuit**

> L’essai donne accès à tous les modules inclus dans le plan choisi, sans paiement immédiat.

### 2.2 Rejoindre un magasin existant

1. Demander le **code magasin** au gérant.
2. Sur `/inscription`, onglet **Rejoindre**.
3. Saisir le code `MAG-XXXX` et la clé de licence si demandée.

### 2.3 Se reconnecter (gérant)

1. Aller sur **Connexion** (`/connexion`).
2. Saisir votre **Gmail** et **mot de passe**.
3. Vous accédez à la page **Abonnement** puis à la caisse.

### 2.4 Connexion caissier (quotidien)

1. Ouvrir `/staff` ou cliquer sur « Connexion caisse » depuis la boutique.
2. Choisir votre **profil** (caissier, gérant, admin).
3. Saisir votre **code PIN** à 4 chiffres.

---

## 3. Abonnement et plans

### 3.1 Plans disponibles

| Plan | Prix / mois | Magasins | Utilisateurs | Idéal pour |
|------|-------------|----------|--------------|------------|
| **Starter** | 9 900 F | 1 | 3 | Boutique, épicerie |
| **Pro** | 24 900 F | 3 | 10 | Restaurant, commerce actif |
| **Business** | 49 900 F | 20 | 50 | Réseau, multi-sites |

### 3.2 Essai gratuit

- **Durée** : 1 mois sur tous les plans.
- **Sans engagement** : aucune carte bancaire requise à l’inscription.
- **Fin d’essai** : payer via mobile money (Orange Money, Wave, MTN MoMo, Moov) ou carte (Stripe) pour continuer.

### 3.3 Page Abonnement (`/abonnement`)

Depuis cette page, le gérant peut :

- Voir le plan actif et les jours restants
- Consulter le **code magasin** et le **QR code boutique**
- Changer de plan ou renouveler
- Activer les **rappels SMS** (J-3 et J-1 avant échéance)
- Consulter l’**historique des paiements**
- Copier la **clé de licence** admin

### 3.4 Modules par plan

**Starter** : caisse, catalogue, stocks, journal, tickets & factures, tableau de bord, personnel, pointage.

**Pro** (en plus) : cuisine (KDS), tables, fidélité, promotions, commandes en ligne, comptabilité, analytique.

**Business** (en plus) : multi-magasins, CRM, RH, intégrations & webhooks.

Les modules non inclus dans votre plan apparaissent verrouillés dans le menu.

---

## 4. Connexion et profils

| Profil | Droits principaux |
|--------|-------------------|
| **Caissier** | Caisse, cuisine, commandes web, journal, pointage |
| **Gérant** | Supervision, validation, modules avancés (sauf personnel admin) |
| **Admin** | Configuration complète, personnel, intégrations |

Le menu latéral s’adapte automatiquement au rôle connecté.

---

## 5. Encaissement (module Caisse)

### 5.1 Ajouter des articles

- Rechercher un article dans la barre de recherche
- Scanner un code-barres
- Cliquer sur un produit pour l’ajouter au panier

### 5.2 Gérer le panier

- Ajuster les quantités avec `+` et `-`
- Retirer une ligne
- Vider le panier
- Annuler la transaction en cours (journalisée dans l’audit)

### 5.3 Remises et fidélité

- Saisir un code promo
- Associer un client fidélité via téléphone
- Renseigner les points à utiliser

### 5.4 Paiement

Modes disponibles :

- Espèces
- Carte
- Mobile money (Orange, MTN, Wave)
- Mixte (répartition espèces / carte / mobile)

**Important :**

- En **mode hors ligne**, seuls les paiements **espèces** sont autorisés.
- Si le terminal de paiement est désactivé dans les intégrations, carte et mobile money sont bloqués.

### 5.5 Ticket / reçu

- Le reçu est généré après validation d’encaissement.
- Si l’imprimante ticket est active, l’impression peut être automatique.
- Sinon, le reçu reste visible à l’écran.

---

## 6. Catalogue et stocks

### Catalogue

- Créer et modifier des articles (nom, prix, TVA, code-barres, image)
- Organiser par catégories
- Importer une image produit

### Stocks

- Décrémentation automatique à la vente
- Seuils d’alerte et inventaire manuel
- Badges de rupture dans le menu latéral

---

## 7. Commandes en ligne et livraison

Dans le module **Commandes en ligne** :

- Voir les commandes en attente (web, boutique publique)
- Valider ou rejeter
- Suivre les événements livraison (ETA, statut)
- Importer des commandes distantes (selon configuration)

Les commandes validées déclenchent la décrémentation stock et peuvent alimenter le KDS.

---

## 8. KDS (Écran cuisine)

Le module **Cuisine** permet :

- Transmission des commandes validées vers la cuisine
- Suivi des statuts : `En file`, `Préparation`, `Prêt`, `Servi`
- Gestion des priorités (basse, normale, haute)
- Mode **SLA automatique** : escalade en priorité haute au dépassement du délai

**Si les écrans cuisine (KDS) sont désactivés** dans Intégrations :

- Alertes sonores suspendues
- Escalade SLA automatique suspendue
- Transmission auto KDS suspendue

---

## 9. Tables et réservations

- Plan de salle interactif
- Suivi d’occupation des tables
- Création et suivi des réservations
- Mise à jour des statuts (`Libre`, `Occupée`, `Réservée`, etc.)

---

## 10. Boutique en ligne client

Chaque magasin dispose d’une vitrine publique :

- URL : `/boutique/MAG-XXXX` (code magasin)
- QR code téléchargeable depuis la page Abonnement
- Catalogue, panier et commande par le client
- Validation en caisse dans le module Commandes en ligne

---

## 11. Multi-magasins (plan Business)

- Créer et basculer entre plusieurs points de vente
- Vue consolidée pour le gérant
- Transferts de stock entre magasins

---

## 12. Intégrations et équipements

Dans **Intégrations > API partenaires** :

- Plateformes de commandes (Shopify, Glovo, Uber Eats, etc.)
- Mode de synchronisation (webhook / pull)
- Connecteur livraison
- Équipements matériels (mode démo) :
  - Terminaux de prise de commande
  - Imprimantes tickets
  - Écrans cuisine (KDS)
  - Tiroir-caisse
  - Terminaux de paiement

### Effets des équipements désactivés

| Équipement OFF | Comportement |
|----------------|--------------|
| Terminaux de paiement | Carte et mobile money bloqués |
| Imprimantes tickets | Reçu à l’écran uniquement |
| Tiroir-caisse | Confirmation explicite avant encaissement espèces |
| Écrans cuisine (KDS) | Alertes sonores et SLA suspendus |

---

## 13. Mode hors ligne

CaisseCI fonctionne **sans connexion internet** :

- Caisse et données locales via IndexedDB
- Licence en cache **7 jours** sans réseau
- File de synchronisation des ventes au retour du réseau
- Paiements espèces uniquement hors ligne

Un bandeau « Hors ligne » s’affiche en haut de l’écran quand le réseau est coupé.

---

## 14. Bonnes pratiques opérationnelles

### Ouverture de service

- Vérifier la connexion réseau (ou confirmer le mode hors ligne)
- Ouvrir la session staff avec le bon profil
- Vérifier le magasin actif (si multi-magasins)
- Contrôler les équipements dans Intégrations
- Test rapide : ajout article, impression ticket, affichage KDS

### Pendant le service

- Surveiller commandes en attente et tickets KDS
- Contrôler les alertes rupture stock
- En mode dégradé : privilégier l’encaissement espèces

### Fermeture de service

- Finaliser ou annuler les paniers en cours
- Vérifier ventes et journal du jour
- Contrôler la file de synchronisation
- Exporter si nécessaire (compta / journal)
- Fermer la session staff

---

## 15. Dépannage rapide

| Problème | Solution |
|----------|----------|
| Paiement carte/mobile indisponible | Vérifier « Terminaux de paiement » et le réseau |
| Ticket non imprimé | Vérifier « Imprimantes tickets » |
| KDS silencieux / SLA inactif | Vérifier « Écrans cuisine (KDS) » |
| Commande invisible en cuisine | Vérifier validation commande + module cuisine actif |
| Module verrouillé | Vérifier le plan d’abonnement ou renouveler |
| Connexion gérant impossible | Vérifier Gmail + mot de passe ; comptes anciens sans mot de passe doivent être recréés |
| Essai expiré | Payer via Abonnement (mobile money ou carte) |

---

## 16. Support

Pour toute question commerciale ou technique, contactez **Infinitecore Système**.

Documentation technique (développeurs) : [documentation-technique.md](documentation-technique.md)
