import { useState } from 'react'
import { shortHash } from '../../lib/format'

/** Hash afișat trunchiat; la click se copiază întreg. */
export function Hash({ value, head, tail }: { value: string; head?: number; tail?: number }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }
  return (
    <button type="button" className="hash" title={value} onClick={copy}>
      {copied ? 'copiat' : shortHash(value, head, tail)}
    </button>
  )
}
