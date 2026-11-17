// Regions whose weeks start on Sunday or Saturday, for browsers without Intl week info (Firefox).
const SUNDAY =
  'AG AS AU BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
    ' ',
  )
const SATURDAY = 'AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' ')

/** The weekday weeks start on in the person's locale (1 = Monday … 7 = Sunday). */
export function firstDayOfWeek(language = navigator.language): number {
  const locale = new Intl.Locale(language) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number }
    weekInfo?: { firstDay: number }
  }
  const known = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay
  if (known) return known
  const region = locale.maximize().region ?? ''
  return SUNDAY.includes(region) ? 7 : SATURDAY.includes(region) ? 6 : 1
}
