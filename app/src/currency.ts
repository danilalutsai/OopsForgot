// A first guess of the person's currency from their browser's region; they can change it in Settings.
const EURO_REGIONS = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ')
const BY_REGION: Record<string, string> = {
  GB: 'GBP',
  US: 'USD',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  UA: 'UAH',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  IN: 'INR',
  BR: 'BRL',
  MX: 'MXN',
}

export function guessCurrency(locale = navigator.language): string {
  const region = new Intl.Locale(locale).maximize().region ?? ''
  return EURO_REGIONS.includes(region) ? 'EUR' : (BY_REGION[region] ?? 'EUR')
}
