'use client'

import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { ROUTES, useSitePath } from '../lib/siteRoutes'

export function AlreadyConnectedGate({
  orgName,
  onSwitchAccount,
}: {
  orgName: string
  onSwitchAccount: () => void
}) {
  const [, navigate] = useSitePath()

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Déjà connecté</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Le magasin <strong className="text-ink">{orgName}</strong> est déjà actif sur cet
            appareil. Choisissez une action :
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="button" onClick={() => navigate(ROUTES.subscription)}>
              Mon abonnement
            </Button>
            <Button type="button" variant="secondary" onClick={onSwitchAccount}>
              Changer de compte
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.home)}>
              Retour au site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
