// Pregătirea comună: DOM-ul și stocarea golite după fiecare test; așteptări mai lungi, pentru că
// backend-ul simulat face criptografie reală (scrutinele de demonstrație se generează la prima cerere).

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

configure({ asyncUtilTimeout: 20_000 })

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})
