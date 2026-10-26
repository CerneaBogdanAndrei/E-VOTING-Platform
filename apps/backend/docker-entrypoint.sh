#!/bin/sh
# Pentru demo: dacă e cerut și nu există încă, generează PKI-ul de test (CSCA + Document Signer)
# în volumul partajat, ca înregistrarea NFC cu cipuri simulate să funcționeze.
set -e
if [ "$GENERATE_TEST_PKI" = "true" ] && [ -n "$PKI_DIR" ] && [ ! -f "$PKI_DIR/test-dsc.json" ]; then
  node dist/src/nfc/test-pki-cli.js "$PKI_DIR"
fi
exec "$@"
