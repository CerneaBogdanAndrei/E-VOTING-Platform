package ro.udjg.evoting.ocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * OCR pe telefon pentru zona MRZ: imaginea nu părăsește dispozitivul. Textul brut
 * se întoarce în JavaScript, unde parserul MRZ (packages/api) alege rândurile,
 * corectează confuziile tipice (O/0, I/1) și validează cifrele de control.
 *
 * Motorul e ML Kit (alternativa din plan la Tesseract), cu modelul latin inclus.
 */
class EvotingOcrModule : Module() {
  private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

  override fun definition() = ModuleDefinition {
    Name("EvotingOcr")

    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject(CodedException("NO_CONTEXT", "Contextul aplicației nu e disponibil", null))
        return@AsyncFunction
      }
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject(CodedException("IMAGE_ERROR", "Imaginea nu poate fi citită", e))
        return@AsyncFunction
      }
      recognizer.process(image)
        .addOnSuccessListener { result -> promise.resolve(result.text) }
        .addOnFailureListener { e -> promise.reject(CodedException("OCR_FAILED", e.message ?: "OCR eșuat", e)) }
    }
  }
}
