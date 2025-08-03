import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 25,
          left: 20,
          right: 20,
          elevation: 0,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
          borderRadius: 25,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.3,
          shadowRadius: 25,
        },
        tabBarBackground: () => (
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={85}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                borderRadius: 25,
                overflow: 'hidden',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            />
          ) : null
        ),
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginBottom: -3,
        },
        tabBarItemStyle: {
          paddingVertical: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Weather',
          tabBarIcon: ({ color, size, focused }) => {
            const scale = useSharedValue(focused ? 1.1 : 1);
            
            const animatedStyle = useAnimatedStyle(() => ({
              transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 150 }) }],
            }));

            return (
              <Animated.View style={animatedStyle}>
                <Ionicons 
                  name={focused ? "partly-sunny" : "partly-sunny-outline"} 
                  size={size + 2} 
                  color={color} 
                />
              </Animated.View>
            );
          },
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: 'Locations',
          tabBarIcon: ({ color, size, focused }) => {
            const scale = useSharedValue(focused ? 1.1 : 1);
            
            const animatedStyle = useAnimatedStyle(() => ({
              transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 150 }) }],
            }));

            return (
              <Animated.View style={animatedStyle}>
                <Ionicons 
                  name={focused ? "location" : "location-outline"} 
                  size={size + 2} 
                  color={color} 
                />
              </Animated.View>
            );
          },
        }}
      />
    </Tabs>
  );
}