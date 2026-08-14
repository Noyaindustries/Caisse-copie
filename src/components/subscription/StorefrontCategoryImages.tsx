import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { db, setProductCategoryImage } from '../../db/db'
import { resolveProductImageFields } from '../../lib/uploads/blob'
import { Button } from '../../ui/Button'
import { cn } from '../../ui/cn'
import { useToast } from '../../ui/Toast'

const MAX_IMAGE_BYTES = 500 * 1024

type Props = {
  online: boolean
  usable: boolean
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Lecture image impossible.'))
    }
    reader.onerror = () => reject(new Error('Lecture image impossible.'))
    reader.readAsDataURL(file)
  })
}

export function StorefrontCategoryImages({ online, usable }: Props) {
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const categories =
    useLiveQuery(() => db.productCategories.orderBy('sortOrder').toArray(), []) ??
    []

  const pickImage = useCallback(
    async (categoryId: string, file: File | null) => {
      if (!file) return
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error('Image trop volumineuse', 'Maximum 500 Ko.')
        return
      }
      setBusyId(categoryId)
      try {
        const dataUrl = await fileToDataUrl(file)
        const fields = await resolveProductImageFields(categoryId, dataUrl)
        await setProductCategoryImage(categoryId, fields)
        toast.success('Photo de catégorie enregistrée')
      } catch (err) {
        toast.error(
          'Image non enregistrée',
          err instanceof Error ? err.message : String(err),
        )
      } finally {
        setBusyId(null)
      }
    },
    [toast],
  )

  const clearImage = useCallback(
    async (categoryId: string) => {
      setBusyId(categoryId)
      try {
        await setProductCategoryImage(categoryId, null)
        toast.success('Photo de catégorie retirée')
      } catch (err) {
        toast.error(
          'Retrait impossible',
          err instanceof Error ? err.message : String(err),
        )
      } finally {
        setBusyId(null)
      }
    },
    [toast],
  )

  const canEdit = online && usable

  return (
    <div className="sm:col-span-2 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-ink">Catégories du menu</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Photos affichées sur la boutique publique (cartes de catégories). Sans
        photo, l’initiale du nom est utilisée.
      </p>
      {categories.length === 0 ? (
        <p className="mt-3 text-sm text-ink-subtle">
          Aucune catégorie. Créez-en dans Catalogue → Catégories.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {categories.map((category) => {
            const src =
              category.imageUrl?.trim() ||
              category.imageDataUrl?.trim() ||
              undefined
            const busy = busyId === category.id
            return (
              <li
                key={category.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-white px-3 py-2.5"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-border bg-zinc-50">
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-sm font-bold text-zinc-400">
                      {category.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {category.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <label
                      className={cn(
                        'ui-btn ui-btn-secondary cursor-pointer text-[12px]',
                        (!canEdit || busy) && 'pointer-events-none opacity-50',
                      )}
                    >
                      {src ? 'Changer' : 'Ajouter photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        disabled={!canEdit || busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          e.target.value = ''
                          void pickImage(category.id, file)
                        }}
                      />
                    </label>
                    {src ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={!canEdit || busy}
                        onClick={() => void clearImage(category.id)}
                      >
                        Retirer
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
