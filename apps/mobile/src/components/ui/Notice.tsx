import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../lib/theme'
import { toneColors, type Tone } from './tones'

/** Mesaj de stare (informație, avertisment, eroare). Erorile sunt anunțate cititorului de ecran. */
export function Notice({ text, tone = 'neutral' }: { text: string; tone?: Tone }) {
  const c = toneColors[tone]
  return (
    <View style={[styles.notice, { backgroundColor: c.bg, borderColor: c.border }]} accessibilityRole={tone === 'bad' ? 'alert' : undefined}>
      <Text style={{ color: tone === 'neutral' ? colors.ink2 : c.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: 12, padding: 12 },
})
