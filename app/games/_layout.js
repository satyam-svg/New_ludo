// app/games/_layout.js
import { Stack } from 'expo-router';

export default function GamesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="six-king" />
      <Stack.Screen name="lucky-number" />
    </Stack>
  );
}