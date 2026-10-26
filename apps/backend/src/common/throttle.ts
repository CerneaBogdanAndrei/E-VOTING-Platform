// Limitarea de rată: o limită generoasă pentru toate rutele și una strictă pentru
// cele unde un atacator ar încerca ceva prin forță brută (token-ul comisiei,
// autentificarea, înregistrarea cu CNP-uri ghicite, token-urile trustees).

let sensitiveLimit = 30

export function setSensitiveLimit(limit: number) {
  sensitiveLimit = limit
}

export const SENSITIVE = { default: { limit: () => sensitiveLimit, ttl: 60_000 } }
