'use client'

import { useSubscription } from '../context/SubscriptionContext'

export function SubscriptionLoadingGate({
  children,
}: {
  children: React.ReactNode
}) {
  const { ready } = useSubscription()
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    )
  }
  return children
}
