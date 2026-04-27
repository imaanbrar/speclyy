import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@speclyy/auth/server'
import { OnboardingShell } from '../../_components/shell'
import { MarketPicker } from './_components/market-picker'
import { buildCityLabel } from './_lib/city-label'

async function detectMarket(): Promise<string | null> {
  const h = await headers()
  // Vercel populates these on every prod request. Locally they're absent.
  const cityRaw = h.get('x-vercel-ip-city')
  if (!cityRaw) {
    // Localhost dev fallback so we can iterate on the detected-card flow
    // without deploying. Gated on NODE_ENV='development' so a missing
    // header in prod (e.g. behind a misconfigured proxy) still returns
    // null — never silently label every user "Calgary". The label format
    // matches what Open-Meteo returns for Calgary so picked === detected
    // string-comparison stays consistent in dev.
    if (process.env.NODE_ENV === 'development') {
      return buildCityLabel({ city: 'Calgary', region: 'Alberta', country: 'CA' })
    }
    return null
  }
  const city = decodeURIComponent(cityRaw.replace(/\+/g, ' '))
  const region = h.get('x-vercel-ip-country-region') ?? null
  const country = h.get('x-vercel-ip-country') ?? null
  const label = buildCityLabel({ city, region, country })
  return label.length > 0 ? label : null
}

export default async function OnboardingMarketPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('market')
    .eq('id', user.id)
    .maybeSingle()

  const detectedLabel = await detectMarket()
  const initialMarket = profile?.market ?? ''

  return (
    <OnboardingShell
      step={3}
      eyebrow="Your market"
      title={
        <>
          Which market <span className="italic-serif">do you work in?</span>
        </>
      }
      description="We tune the Library to your area. You can change this any time in Settings."
    >
      <MarketPicker detectedLabel={detectedLabel} initialMarket={initialMarket} />
    </OnboardingShell>
  )
}
