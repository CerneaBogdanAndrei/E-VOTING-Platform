import { BadRequestException } from '@nestjs/common'

export const bad = (message: string) => new BadRequestException(message)

export function str(value: unknown, field: string, { max = 500, allowEmpty = false } = {}): string {
  if (typeof value !== 'string') throw bad(`${field}: se așteaptă text`)
  const v = value.trim()
  if (!allowEmpty && !v) throw bad(`${field} este obligatoriu`)
  if (v.length > max) throw bad(`${field}: cel mult ${max} caractere`)
  return v
}

export function isoDate(value: unknown, field: string): Date {
  const d = new Date(typeof value === 'string' ? value : NaN)
  if (Number.isNaN(d.getTime())) throw bad(`${field}: dată invalidă`)
  return d
}

export function obj(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw bad(`${field}: se așteaptă un obiect JSON`)
  return value as Record<string, unknown>
}

export function arr(value: unknown, field: string, { min = 0, max = 1000 } = {}): unknown[] {
  if (!Array.isArray(value)) throw bad(`${field}: se așteaptă o listă`)
  if (value.length < min) throw bad(`${field}: cel puțin ${min} elemente`)
  if (value.length > max) throw bad(`${field}: cel mult ${max} elemente`)
  return value
}
