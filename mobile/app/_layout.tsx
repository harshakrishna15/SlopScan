import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surface.bg },
          headerTintColor: Colors.ink[900],
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: Colors.surface.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="results"
          options={{ title: 'Results', presentation: 'card' }}
        />
        <Stack.Screen
          name="product/[code]"
          options={{ title: 'Product', presentation: 'card' }}
        />
        <Stack.Screen
          name="alternatives/[code]"
          options={{ title: 'Alternatives', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}
