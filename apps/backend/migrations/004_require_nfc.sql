-- Setarea per scrutin „doar NFC”: înregistrarea se face numai cu cartea electronică (CEI), prin
-- Passive Authentication. Scanarea optică (OCR) acceptă orice MRZ cu cifre de control corecte, inclusiv
-- unul printat; pentru scrutinele unde contează, comisia o poate opri.
ALTER TABLE elections
  ADD COLUMN require_nfc boolean NOT NULL DEFAULT false;
