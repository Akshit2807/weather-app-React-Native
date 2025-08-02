import { Stack } from 'expo-router';
import { WeatherProvider } from '../context/WeatherContext';

/**
 * Root layout component that wraps the entire application
 * with the WeatherProvider for global state management
 */
export default function RootLayout() {
  return (
    <WeatherProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </WeatherProvider>
  );
}