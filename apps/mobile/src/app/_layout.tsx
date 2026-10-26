import '../lib/polyfills'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '../lib/session'
import { colors } from '../lib/theme'

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '600' },
          headerShadowVisible: false,
          headerBackTitle: 'Înapoi',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Vot verificabil' }} />
        <Stack.Screen name="scrutin/[id]/index" options={{ title: 'Scrutin' }} />
        <Stack.Screen name="scrutin/[id]/inregistrare" options={{ title: 'Înregistrare' }} />
        <Stack.Screen name="scrutin/[id]/ocr" options={{ title: 'Scanare buletin' }} />
        <Stack.Screen name="scrutin/[id]/nfc" options={{ title: 'Citire CEI prin NFC' }} />
        <Stack.Screen name="scrutin/[id]/vot" options={{ title: 'Vot' }} />
        <Stack.Screen name="scrutin/[id]/confirmare" options={{ title: 'Vot înregistrat', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="scrutin/[id]/verifica" options={{ title: 'Verifică votul' }} />
      </Stack>
    </SessionProvider>
  )
}
