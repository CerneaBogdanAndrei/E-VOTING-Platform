package ro.udjg.evoting.nfc

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import net.sf.scuba.smartcards.CardService
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.jmrtd.PACEKeySpec
import org.jmrtd.PassportService
import org.jmrtd.lds.CardAccessFile
import org.jmrtd.lds.PACEInfo
import java.security.Security

/**
 * Citirea cărții electronice de identitate (CEI) prin NFC, cu JMRTD:
 * canal securizat PACE pe baza CAN-ului, apoi DG1 (MRZ-ul) și SOD (hash-urile
 * semnate de stat). Poza (DG2) nu se citește. Verificarea semnăturii (Passive
 * Authentication) se face pe server, nu aici: o aplicație modificată ar putea
 * pretinde orice.
 *
 * Nu se încearcă niciodată PIN-ul cardului: doar CAN-ul tipărit pe față.
 */
class EvotingNfcModule : Module() {
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("EvotingNfc")

    OnCreate {
      // Android vine cu o versiune redusă a BouncyCastle; PACE pe curbe eliptice cere varianta completă.
      Security.removeProvider("BC")
      Security.insertProviderAt(BouncyCastleProvider(), 1)
    }

    Function("isSupported") {
      val activity = appContext.currentActivity ?: return@Function false
      NfcAdapter.getDefaultAdapter(activity) != null
    }

    Function("isEnabled") {
      val activity = appContext.currentActivity ?: return@Function false
      NfcAdapter.getDefaultAdapter(activity)?.isEnabled == true
    }

    AsyncFunction("readDocument") { can: String, promise: Promise ->
      if (!Regex("^\\d{6}$").matches(can)) {
        promise.reject(CodedException("INVALID_CAN", "CAN-ul are exact 6 cifre", null))
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      val adapter = activity?.let { NfcAdapter.getDefaultAdapter(it) }
      if (activity == null || adapter == null) {
        promise.reject(CodedException("NFC_UNAVAILABLE", "Telefonul nu are NFC", null))
        return@AsyncFunction
      }
      pending?.reject(CodedException("CANCELLED", "O nouă citire a înlocuit-o pe cea veche", null))
      pending = promise
      val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
      val extras = Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 1000) }
      adapter.enableReaderMode(activity, { tag -> onTag(tag, can) }, flags, extras)
    }

    Function("cancel") {
      pending?.reject(CodedException("CANCELLED", "Citire anulată", null))
      pending = null
      stopReader()
    }

    OnActivityEntersBackground {
      stopReader()
    }
  }

  private fun stopReader() {
    val activity = appContext.currentActivity ?: return
    NfcAdapter.getDefaultAdapter(activity)?.disableReaderMode(activity)
  }

  private fun onTag(tag: Tag, can: String) {
    val promise = pending ?: return
    try {
      val isoDep = IsoDep.get(tag) ?: throw IllegalStateException("Cipul nu este un document ISO 14443-4")
      isoDep.timeout = 10_000
      val cardService = CardService.getInstance(isoDep)
      cardService.open()
      val service = PassportService(
        cardService,
        PassportService.NORMAL_MAX_TRANCEIVE_LENGTH,
        PassportService.DEFAULT_MAX_BLOCKSIZE,
        false,
        false,
      )
      service.open()

      // PACE cu CAN: parametrii vin din EF.CardAccess, singurul fișier citibil fără autentificare
      val cardAccess = CardAccessFile(service.getInputStream(PassportService.EF_CARD_ACCESS, PassportService.DEFAULT_MAX_BLOCKSIZE))
      val pace = cardAccess.securityInfos.filterIsInstance<PACEInfo>().firstOrNull()
        ?: throw IllegalStateException("Cipul nu anunță PACE în EF.CardAccess")
      try {
        service.doPACE(PACEKeySpec.createCANKey(can), pace.objectIdentifier, PACEInfo.toParameterSpec(pace.parameterId), pace.parameterId)
      } catch (e: Exception) {
        throw IllegalStateException("PACE a eșuat: verifică CAN-ul de pe fața buletinului", e)
      }
      service.sendSelectApplet(true)

      val dg1 = service.getInputStream(PassportService.EF_DG1, PassportService.DEFAULT_MAX_BLOCKSIZE).use { it.readBytes() }
      val sod = service.getInputStream(PassportService.EF_SOD, PassportService.DEFAULT_MAX_BLOCKSIZE).use { it.readBytes() }
      promise.resolve(
        mapOf(
          "dg1" to Base64.encodeToString(dg1, Base64.NO_WRAP),
          "sod" to Base64.encodeToString(sod, Base64.NO_WRAP),
        ),
      )
    } catch (e: Exception) {
      promise.reject(CodedException("NFC_READ_FAILED", e.message ?: "Citirea cipului a eșuat; ține telefonul nemișcat și reîncearcă", e))
    } finally {
      pending = null
      stopReader()
    }
  }
}
