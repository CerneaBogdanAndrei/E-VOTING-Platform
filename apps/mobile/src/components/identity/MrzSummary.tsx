import type { MrzData } from '../../api'
import { colors } from '../../lib/theme'
import { Card, H2, Notice } from '../ui'
import { KeyValueRow } from './KeyValueRow'

const formatLabel: Record<MrzData['format'], string> = { TD2: 'buletin', TD1: 'CEI', TD3: 'pașaport' }

/** Datele citite din MRZ și rezultatul fiecărei cifre de control. */
export function MrzSummary({ mrz }: { mrz: MrzData }) {
  const good = mrz.valid && !!mrz.cnp && !mrz.expired
  return (
    <Card style={{ borderColor: good ? colors.okLine : colors.line2 }}>
      <H2>Date citite ({formatLabel[mrz.format]})</H2>
      <KeyValueRow label="Nume" value={`${mrz.surname} ${mrz.givenNames}`.trim()} />
      <KeyValueRow label="Document" value={mrz.documentNumber} />
      <KeyValueRow label="Data nașterii" value={mrz.birthDate} />
      <KeyValueRow label="Expiră" value={mrz.expiryDate} bad={mrz.expired} />
      <KeyValueRow label="CNP" value={mrz.cnp ?? 'nu a putut fi reconstituit'} bad={!mrz.cnp} />
      {mrz.checks.map((c) => (
        <KeyValueRow key={c.field} label={`Control: ${c.field}`} value={c.ok ? '✓' : '✗'} bad={!c.ok} />
      ))}
      {!mrz.valid && <Notice tone="bad" text="Cifrele de control nu se potrivesc: citirea e greșită. Rescanează sau corectează textul." />}
      {mrz.expired && <Notice tone="bad" text="Documentul este expirat." />}
    </Card>
  )
}
