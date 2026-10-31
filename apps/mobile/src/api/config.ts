/**
 * URL-ul backend-ului (EXPO_PUBLIC_API_URL în .env.local).
 * Pe telefon, folosește IP-ul calculatorului din rețea (ex. http://192.168.1.20:3000), nu localhost.
 * În emulatorul Android, calculatorul e la http://10.0.2.2:3000.
 */
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
