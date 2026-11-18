/** Eroare întoarsă de API, cu codul HTTP (0 = serverul nu răspunde). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
