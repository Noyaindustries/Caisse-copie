// TypeScript/DOM libs de la version actuelle ne définissent pas encore
// `URLPatternInput` et `URLPatternOptions`, alors que Next les référence.
// Pour le squelette (migration progressive), on fournit un alias minimal.
export {}

declare global {
  type URLPatternInput = unknown
  type URLPatternOptions = unknown
}

