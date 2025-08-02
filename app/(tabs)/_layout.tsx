import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

/**
 * Tab layout configuration for the application
 * Creates a clean single-tab interface for the weather app
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          position: 'absolute',
          borderRadius: 25,
          marginHorizontal: 20,
          marginBottom: 25,
          height: 65,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Weather',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="partly-sunny" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}