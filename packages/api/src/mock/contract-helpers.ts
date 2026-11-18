// Re-exporturi și constante mici folosite de backend-ul simulat.
export * from '../contract/index.js'

/** Sufixul ID-ului candidatului special „vot alb”. */
export const BLANK_LABEL_ID = 'alb'

/** Identitatea cu care lucrează comisia în simulator (nu există token). */
export const ROOT_ADMIN = { id: 'root', name: 'Administrator', role: 'comisie' as const }
