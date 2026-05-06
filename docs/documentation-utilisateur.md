# Documentation utilisateur

## 1) Vue d'ensemble

Infinitecore Système est une application de caisse et de gestion magasin.
Elle couvre notamment:

- Encaissement en caisse (POS)
- Gestion du catalogue et des stocks
- Commandes en ligne et livraison
- Écran cuisine (KDS)
- Tables et réservations
- Reporting et exports
- Intégrations et équipements matériels

## 2) Connexion et profils

Selon votre profil (caissier, gérant, admin), certains menus sont visibles ou non.

- **Caissier**: encaissement et opérations quotidiennes
- **Gérant**: supervision, validation, modules avancés
- **Admin**: configuration complète

## 3) Encaissement (module Caisse)

### 3.1 Ajouter des articles

- Rechercher un article dans la barre de recherche
- Scanner un code-barres
- Cliquer sur un produit pour l'ajouter au panier

### 3.2 Gérer le panier

- Ajuster les quantités avec `+` et `-`
- Retirer une ligne
- Vider le panier
- Annuler la transaction en cours (journalisée dans l'audit)

### 3.3 Remises et fidélité

- Saisir un code promo
- Associer un client fidélité via téléphone
- Renseigner les points à utiliser

### 3.4 Paiement

Modes disponibles:

- Espèces
- Carte
- Mobile money
- Mixte (répartition espèces/carte/mobile)

Important:

- En mode hors ligne, seuls les paiements espèces sont autorisés
- Si le terminal de paiement est désactivé dans les intégrations, carte/mobile sont bloqués

### 3.5 Ticket / reçu

- Le reçu est généré après validation d'encaissement
- Si l'imprimante ticket est active, l'impression peut être automatique
- Si l'imprimante est désactivée, le reçu reste visible à l'écran

## 4) Commandes en ligne et livraison

Dans le module des commandes en ligne, vous pouvez:

- Voir les commandes en attente
- Valider ou rejeter
- Suivre les événements livraison (ETA, statut)
- Importer des commandes distantes (selon configuration)

## 5) KDS (Écran cuisine)

Le module KDS permet:

- Transmission des commandes validées vers la cuisine
- Suivi des statuts (`En file`, `Préparation`, `Prêt`, `Servi`)
- Gestion des priorités
- Priorité SLA automatique (si activée)

Comportement matériel:

- Si **Écrans cuisine (KDS)** est OFF dans les intégrations:
  - alertes sonores KDS suspendues
  - escalade SLA automatique suspendue
  - actions liées au son/SLA marquées indisponibles

## 6) Tables et réservations

Le module permet:

- Plan de salle interactif
- Suivi d'occupation des tables
- Création et suivi des réservations
- Mise à jour des statuts de réservation

## 7) Intégrations et équipements de caisse

Dans `Intégrations > API partenaires`, vous pouvez configurer:

- Plateformes de commandes (Shopify, Glovo, Uber Eats, etc.)
- Mode de synchronisation (webhook / pull)
- Connecteur livraison
- Intégration cuisine
- Équipements matériels:
  - Terminaux de prise de commande
  - Imprimantes tickets
  - Écrans cuisine (KDS)
  - Tiroir-caisse
  - Terminaux de paiement

## 8) Bonnes pratiques opérationnelles

- Vérifier l'état du réseau avant forte affluence
- Tester impression ticket en début de service
- Vérifier les équipements activés dans les intégrations
- Clôturer proprement les sessions de caisse
- Contrôler les alertes stock et commandes en attente

## 9) Dépannage rapide

- **Paiement carte/mobile indisponible**: vérifier "Terminaux de paiement" et la connectivité réseau
- **Ticket non imprimé**: vérifier "Imprimantes tickets"
- **KDS silencieux / SLA inactif**: vérifier "Écrans cuisine (KDS)"
- **Commande non visible en cuisine**: vérifier que la commande est validée et que le module cuisine est actif

## 10) Procédures d'exploitation quotidiennes

### 10.1 Ouverture de service (checklist)

- Vérifier la connexion réseau (ou confirmer le mode hors ligne)
- Ouvrir la session staff avec le bon profil
- Vérifier le magasin actif (si multi-magasins)
- Contrôler les équipements dans `Intégrations > API partenaires`:
  - Terminaux de prise de commande
  - Imprimantes tickets
  - Écrans cuisine (KDS)
  - Tiroir-caisse
  - Terminaux de paiement
- Faire un test rapide:
  - ajout d'article au panier
  - test d'impression ticket (si imprimante active)
  - vérification affichage KDS (si module cuisine actif)

### 10.2 Pendant le service

- Surveiller les commandes en attente et les tickets KDS
- Contrôler les alertes rupture stock
- Vérifier les refus de paiement (réseau, terminal OFF, saisie incomplète)
- En cas de mode dégradé:
  - privilégier l'encaissement espèces
  - informer le responsable en cas d'incident persistant

### 10.3 Fermeture de service

- Finaliser les paniers en cours ou annuler proprement les transactions
- Vérifier les ventes et le journal de la journée
- Contrôler la file de synchronisation si du hors ligne a été utilisé
- Effectuer les exports nécessaires (compta / journal selon profil)
- Fermer la session staff

### 10.4 Incident réseau (procédure rapide)

- Confirmer l'état réseau local/Internet
- Continuer en mode espèces si nécessaire
- Éviter les opérations dépendantes d'API externes tant que la liaison n'est pas rétablie
- Dès retour réseau:
  - lancer une synchronisation
  - vérifier la remontée des ventes en file
  - contrôler les commandes en ligne et le KDS

