// Comisia: ADMIN_TOKEN e „rădăcina”, iar membrii au token propriu și un rol.
// `comisie` poate face orice; `observator` doar citește (lista, jurnalul de audit).

export type AdminRole = 'comisie' | 'observator'

/** Cine e autentificat pe rutele comisiei; apare ca actor în jurnalul de audit. */
export interface AdminIdentity {
  id: string
  name: string
  role: AdminRole
}

export interface CommissionMember extends AdminIdentity {
  createdAt: string
  revokedAt: string | null
}

export interface CreateMemberInput {
  name: string
  role: AdminRole
}

/** Token-ul membrului se afișează o singură dată. */
export interface CreatedMember extends CommissionMember {
  token: string
}
