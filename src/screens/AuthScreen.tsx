'use client'

import { Button } from '../ui/Button'
import { Card, CardContent } from '../ui/Card'
import { ROUTES, signupUrl, useSitePath } from '../lib/siteRoutes'
import { useSubscription } from '../context/SubscriptionContext'
import { useStaffSession } from '../context/StaffSessionContext'
import { OrganizationSetup } from '../components/OrganizationSetup'
import { AlreadyConnectedGate } from './AlreadyConnectedGate'
import { SubscriptionLoadingGate } from './SubscriptionLoadingGate'

export function AuthScreen() {
  const { organization, disconnect } = useSubscription()
  const { clearStaff } = useStaffSession()
  const [, navigate] = useSitePath()

  return (
    <SubscriptionLoadingGate>
      {organization ? (
        <AlreadyConnectedGate
          orgName={organization.name}
          onSwitchAccount={() => {
            clearStaff()
            disconnect()
            navigate(ROUTES.login)
          }}
        />
      ) : (
        <OrganizationSetup onNavigate={navigate} />
      )}
    </SubscriptionLoadingGate>
  )
}

export function NoOrgStaffGate() {
  const [, navigate] = useSitePath()

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-xl font-bold text-ink">Connexion caisse</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            Votre magasin doit d’abord être activé. Créez un compte ou rejoignez une
            équipe existante avec le code magasin.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button type="button" onClick={() => navigate(signupUrl('pro'))}>
              Créer mon magasin
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.login)}>
              Connexion Gmail
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`${ROUTES.signup}#rejoindre`)}
            >
              Rejoindre un magasin
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
