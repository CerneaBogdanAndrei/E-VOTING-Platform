/**
 * URL-ul backend-ului. Necompletat = backend simulat în memorie.
 * Pe telefon, folosește IP-ul calculatorului din rețea (ex. http://192.168.1.20:3000), nu localhost.
 */
export const API_URL: string | undefined = process.env.EXPO_PUBLIC_API_URL || undefined
