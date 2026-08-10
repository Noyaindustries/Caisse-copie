import type { Product } from '../db/types'

type DescRule = {
  match: RegExp
  description: string
  highlights?: string[]
}

/**
 * Règles par mots-clés du nom/catégorie. Renvoie la première correspondance
 * pertinente, sinon une description générique par catégorie.
 */
const RULES: DescRule[] = [
  {
    match: /riz\s+gras|jollof|thieb|tchep/i,
    description:
      'Riz parfumé mijoté dans une sauce tomate épicée, avec viande ou poisson, légumes et aromates du pays. Plat signature africain, généreux et parfaitement équilibré.',
    highlights: ['Portion généreuse', 'Sauce longue cuisson', 'Épices maison'],
  },
  {
    match: /atti[eé]k[eé]/i,
    description:
      'Semoule de manioc fermentée, légère et moelleuse, servie avec poisson braisé ou fumé, oignons, tomate fraîche et piment vert.',
    highlights: ['Poisson frais du jour', 'Sans gluten', 'Accompagné d’oignons & piment'],
  },
  {
    match: /garba/i,
    description:
      'Street food ivoirienne par excellence : thon frit mariné, attiéké, oignon cru, tomate et piment rouge. Direct, authentique, addictif.',
    highlights: ['Thon grillé', 'Recette traditionnelle', 'Servi très frais'],
  },
  {
    match: /placali|foutou|sauce\s+graine|sauce\s+claire/i,
    description:
      'Pâte de manioc ou banane plantain pilée, accompagnée d’une sauce riche à la graine de palme ou claire aux aubergines, piment et poisson fumé.',
    highlights: ['Sauce mijotée', 'Poisson fumé', 'Portion généreuse'],
  },
  {
    match: /alloco/i,
    description:
      'Bananes plantain mûres frites jusqu’à caramélisation, croustillantes à l’extérieur, fondantes à l’intérieur. Servi avec omelette ou sauce pimentée.',
    highlights: ['Banane plantain mûre', 'Frit minute', 'Sauce pimentée maison'],
  },
  {
    match: /yassa/i,
    description:
      'Poulet mariné au citron et oignons longuement compotés, légèrement acidulé et parfumé à la moutarde. Servi avec riz blanc parfumé.',
    highlights: ['Marinade 24h', 'Oignons confits', 'Citron frais'],
  },
  {
    match: /maf[eé]|arachide/i,
    description:
      'Ragoût d’arachide onctueux à base de pâte de cacahuète, viande tendre, légumes et épices. Crémeux, gourmand, profondément savoureux.',
    highlights: ['Arachide fraîche', 'Légumes de saison', 'Épices douces'],
  },
  {
    match: /poulet\s+brais|poulet\s+grill/i,
    description:
      'Poulet entier mariné aux épices, grillé au charbon de bois pour une peau croustillante et une chair juteuse. Sauce oignon braisé offerte.',
    highlights: ['Grillé au charbon', 'Marinade maison', 'Sauce oignon incluse'],
  },
  {
    match: /poisson\s+brais|poisson\s+grill/i,
    description:
      'Poisson du jour ouvert, assaisonné et grillé à la perfection. Chair moelleuse, peau croustillante, servi avec citron vert.',
    highlights: ['Poisson du jour', 'Grillé au feu de bois', 'Citron vert'],
  },
  {
    match: /brochette/i,
    description:
      'Morceaux de viande marinés et grillés sur brochette, accompagnés d’oignons braisés, piment rouge et sauce au choix.',
    highlights: ['Viande marinée', 'Grillée minute', 'Sauce pimentée'],
  },

  // International
  {
    match: /spaghetti|p[aâ]tes|bolognaise|carbonara/i,
    description:
      'Pâtes al dente nappées de sauce généreuse, finement assaisonnées. Parsemées de parmesan fraîchement râpé.',
    highlights: ['Al dente', 'Parmesan frais', 'Sauce maison'],
  },
  {
    match: /burger/i,
    description:
      'Pain brioché toasté, steak de bœuf juteux, cheddar fondant, salade, tomate, cornichons et sauce maison. Servi avec frites croustillantes.',
    highlights: ['Pain brioché', 'Steak 150g', 'Frites maison'],
  },
  {
    match: /pizza/i,
    description:
      'Pâte fine cuite au four à pierre, sauce tomate maison, mozzarella fondante et basilic frais. Croûte légèrement soufflée.',
    highlights: ['Four à pierre', 'Mozzarella fondante', 'Basilic frais'],
  },
  {
    match: /tacos/i,
    description:
      'Galette dorée garnie de viande grillée, frites, fromage fondu et sauces au choix. Roulée, toastée et servie chaude.',
    highlights: ['Sauces au choix', 'Fromage fondu', 'Galette toastée'],
  },
  {
    match: /wrap/i,
    description:
      'Galette moelleuse roulée autour de poulet grillé, crudités fraîches et sauce crémeuse. Léger mais rassasiant.',
    highlights: ['Crudités fraîches', 'Poulet grillé', 'À emporter facile'],
  },
  {
    match: /club\s+sandwich|sandwich/i,
    description:
      'Pain toasté, garniture généreuse, ingrédients frais du jour. Servi avec chips ou frites selon disponibilité.',
    highlights: ['Pain toasté', 'Garniture fraîche', 'Prêt à emporter'],
  },
  {
    match: /salade/i,
    description:
      'Mélange de verdure croquante, légumes de saison, protéine au choix et vinaigrette maison. Léger et équilibré.',
    highlights: ['Légumes de saison', 'Vinaigrette maison', 'Option sans gluten'],
  },
  {
    match: /nugget/i,
    description:
      'Tendres morceaux de poulet pané croustillant, accompagnés de frites et d’une sauce au choix. Parfait pour les enfants.',
    highlights: ['Poulet tendre', 'Panure croustillante', 'Sauce au choix'],
  },

  // Boissons
  {
    match: /bissap|hibiscus/i,
    description:
      'Infusion de fleurs d’hibiscus séchées, rafraîchissante et légèrement acidulée. Parfumée à la menthe et servie glacée.',
    highlights: ['100% naturel', 'Servi glacé', 'Sans colorant'],
  },
  {
    match: /gingembre/i,
    description:
      'Boisson à base de gingembre frais pressé, citron et épices douces. Piquante et revigorante, servie bien fraîche.',
    highlights: ['Gingembre frais', 'Épices douces', 'Effet tonique'],
  },
  {
    match: /cocktail\s+fruit/i,
    description:
      'Mélange de fruits frais de saison mixés sur glace. Rafraîchissant, sans alcool, riche en vitamines.',
    highlights: ['Fruits frais', 'Sans alcool', 'Vitaminé'],
  },
  {
    match: /smoothie/i,
    description:
      'Fruits frais mixés avec yaourt ou lait, texture crémeuse et naturellement sucrée. Boisson gourmande et énergétique.',
    highlights: ['Fruits entiers', 'Crémeux', 'Sans sucre ajouté'],
  },
  {
    match: /eau\s+min[eé]rale|eau\s+plate/i,
    description:
      'Eau minérale naturelle en bouteille 50 cl, fraîche et faiblement minéralisée. Idéale à table comme en déplacement.',
    highlights: ['50 cl', 'Peu minéralisée', 'Sans gaz'],
  },
  {
    match: /cola|coca|soda/i,
    description:
      'Boisson gazeuse rafraîchissante en canette 33 cl, servie bien fraîche. Le classique indémodable.',
    highlights: ['Canette 33 cl', 'Servi très frais'],
  },
  { match: /jus/i, description: 'Jus préparé maison avec des fruits frais, sans colorant ni conservateur ajouté.' },

  // Desserts
  {
    match: /tiramisu/i,
    description:
      'Dessert italien onctueux : couches de biscuits imbibés de café, crème mascarpone et cacao amer. Préparé maison.',
    highlights: ['Mascarpone italien', 'Café arabica', 'Fait maison'],
  },
  {
    match: /cr[eê]pe/i,
    description:
      'Crêpe fine et moelleuse, garnie de chocolat fondant ou de confiture. Préparée à la demande et servie chaude.',
    highlights: ['Servi chaud', 'Chocolat fondant', 'À la demande'],
  },
  {
    match: /fruit\s+bowl|salade\s+de\s+fruit/i,
    description:
      'Mélange généreux de fruits frais de saison coupés en morceaux. Naturellement sucré, riche en vitamines, servi frais.',
    highlights: ['100% fruits', 'Sans sucre ajouté', 'Frais du jour'],
  },
]

const CATEGORY_FALLBACK: Record<string, string> = {
  Boissons:
    'Boisson rafraîchissante de notre sélection, à déguster bien fraîche. Idéale à tout moment de la journée.',
  Alimentation:
    'Préparation soignée avec des ingrédients de qualité. Servie avec attention, parfaite à emporter ou sur place.',
  Hygiène:
    'Produit d’hygiène quotidienne, sélectionné pour sa qualité et sa praticité d’usage.',
  Autre:
    'Article de notre boutique, disponible en magasin et en commande en ligne.',
}

const MAX_DESCRIPTION_CHARS = 1_000
const MAX_HIGHLIGHTS = 5
const MAX_HIGHLIGHT_CHARS = 80

/** Normalise le texte saisi par le commerçant (trim, longueur max). */
export function normalizeProductDescription(
  raw: string | undefined | null,
): string | undefined {
  const text = (raw ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[ \t]+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_DESCRIPTION_CHARS)
  return text || undefined
}

/** Une ligne = un point fort ; ignore les vides. */
export function normalizeProductHighlights(
  raw: string[] | string | undefined | null,
): string[] | undefined {
  const lines = Array.isArray(raw)
    ? raw
    : String(raw ?? '')
        .split(/\r?\n|,/)
        .map((s) => s.trim())
  const cleaned = lines
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map((s) => s.slice(0, MAX_HIGHLIGHT_CHARS))
    .slice(0, MAX_HIGHLIGHTS)
  return cleaned.length > 0 ? cleaned : undefined
}

export function productDescription(product: Product): string {
  const custom = normalizeProductDescription(product.description)
  if (custom) return custom

  const haystack = [product.name, product.category ?? ''].join(' ')
  for (const rule of RULES) {
    if (rule.match.test(haystack)) return rule.description
  }
  return (
    CATEGORY_FALLBACK[product.category] ??
    'Article disponible dans notre boutique.'
  )
}

export function productHighlights(product: Product): string[] {
  const custom = normalizeProductHighlights(product.highlights)
  if (custom) return custom

  const haystack = [product.name, product.category ?? ''].join(' ')
  for (const rule of RULES) {
    if (rule.match.test(haystack) && rule.highlights) return rule.highlights
  }
  return []
}

/** Extrait court pour les cartes boutique (uniquement si description perso). */
export function productCardBlurb(product: Product): string | undefined {
  return normalizeProductDescription(product.description)
}
