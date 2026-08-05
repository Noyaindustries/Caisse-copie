'use client'

import { use } from 'react'

import { StorefrontScreen } from '../../../src/screens/StorefrontScreen'

export default function BoutiqueCodePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = use(params)
  return <StorefrontScreen storeCode={decodeURIComponent(code)} />
}
