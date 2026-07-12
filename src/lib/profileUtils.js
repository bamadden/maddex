export const COUNTRY_TIMEZONES = {
  'Australia': 'Australia/Sydney',
  'United States': 'America/New_York',
  'United Kingdom': 'Europe/London',
  'Canada': 'America/Toronto',
  'New Zealand': 'Pacific/Auckland',
  'Singapore': 'Asia/Singapore',
  'Hong Kong': 'Asia/Hong_Kong',
  'Japan': 'Asia/Tokyo',
  'China': 'Asia/Shanghai',
  'India': 'Asia/Kolkata',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'United Arab Emirates': 'Asia/Dubai',
  'South Africa': 'Africa/Johannesburg',
  'Brazil': 'America/Sao_Paulo',
  'South Korea': 'Asia/Seoul',
  'Thailand': 'Asia/Bangkok',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Indonesia': 'Asia/Jakarta',
  'Philippines': 'Asia/Manila',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  'Israel': 'Asia/Jerusalem',
  'Saudi Arabia': 'Asia/Riyadh',
  'Turkey': 'Europe/Istanbul',
  'Russia': 'Europe/Moscow',
  'Netherlands': 'Europe/Amsterdam',
  'Sweden': 'Europe/Stockholm',
  'Switzerland': 'Europe/Zurich',
  'Norway': 'Europe/Oslo',
  'Denmark': 'Europe/Copenhagen',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Poland': 'Europe/Warsaw',
  'Mexico': 'America/Mexico_City',
  'Argentina': 'America/Argentina/Buenos_Aires',
  'Chile': 'America/Santiago',
  'Colombia': 'America/Bogota',
  'Peru': 'America/Lima',
  'Nigeria': 'Africa/Lagos',
  'Kenya': 'Africa/Nairobi',
  'Egypt': 'Africa/Cairo',
  'Pakistan': 'Asia/Karachi',
  'Bangladesh': 'Asia/Dhaka',
}

export function getTimezoneFromCountry(country) {
  return COUNTRY_TIMEZONES[country] || 'UTC'
}

export function getInitials(profile, user) {
  if (profile?.first_name && profile?.last_name) {
    return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
  }
  if (profile?.first_name) {
    return profile.first_name.slice(0, 2).toUpperCase()
  }
  const email = profile?.email || user?.email
  if (email) return email[0].toUpperCase()
  return 'M'
}

export const EXPERIENCE_LEVELS = [
  { value: 'BEGINNER',     label: 'BEGINNER',     desc: 'New to investing, learning the basics' },
  { value: 'INTERMEDIATE', label: 'INTERMEDIATE', desc: 'Some experience with stocks and markets' },
  { value: 'ADVANCED',     label: 'ADVANCED',     desc: 'Experienced investor, complex instruments' },
  { value: 'PROFESSIONAL', label: 'PROFESSIONAL', desc: 'Finance professional or sophisticated investor' },
]

export const EXPERIENCE_CONTEXT = {
  BEGINNER:     'The user is new to investing. Explain concepts clearly, avoid jargon, and define technical terms when used.',
  INTERMEDIATE: 'The user has some investment experience. Use standard financial terminology without over-explaining basics.',
  ADVANCED:     'The user is an experienced investor. Use advanced terminology and focus on technical analysis.',
  PROFESSIONAL: 'The user is a finance professional. Use professional-grade analysis, be highly technical and concise.',
}
