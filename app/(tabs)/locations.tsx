import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

interface SavedLocation {
  id: string;
  name: string;
  country?: string;
  lat: number;
  lon: number;
  temperature: number;
  condition: string;
  icon: string;
  isCurrentLocation?: boolean;
}

export default function LocationsScreen() {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [currentLocationWeather, setCurrentLocationWeather] = useState<SavedLocation | null>(null);
  
  const { fetchWeatherByCoords, unit } = useWeather();

  useEffect(() => {
    loadCurrentLocation();
    loadSavedLocations();
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        // Fetch weather for current location
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}&appid=dd3eed2b572cd5929a9f50b77007248d&units=metric`
        );
        const data = await response.json();
        
        setCurrentLocationWeather({
          id: 'current',
          name: data.name,
          country: data.sys?.country,
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          temperature: Math.round(data.main.temp),
          condition: data.weather[0].main,
          icon: data.weather[0].icon,
          isCurrentLocation: true,
        });
      }
    } catch (error) {
      console.error('Error loading current location:', error);
    }
  };

  const loadSavedLocations = () => {
    // Mock saved locations - in real app, load from AsyncStorage
    const mockLocations: SavedLocation[] = [
      {
        id: '1',
        name: 'New York',
        country: 'US',
        lat: 40.7128,
        lon: -74.0060,
        temperature: 22,
        condition: 'Clear',
        icon: '01d',
      },
      {
        id: '2',
        name: 'London',
        country: 'GB',
        lat: 51.5074,
        lon: -0.1278,
        temperature: 15,
        condition: 'Clouds',
        icon: '03d',
      },
      {
        id: '3',
        name: 'Tokyo',
        country: 'JP',
        lat: 35.6762,
        lon: 139.6503,
        temperature: 28,
        condition: 'Rain',
        icon: '10d',
      },
    ];
    setSavedLocations(mockLocations);
  };

  const convertTemperature = (temp: number): number => {
    return unit === 'F' ? Math.round((temp * 9/5) + 32) : Math.round(temp);
  };

  const getWeatherIcon = (iconCode: string) => {
    const iconMap: { [key: string]: string } = {
      '01d': 'sunny', '01n': 'moon',
      '02d': 'partly-sunny', '02n': 'cloudy-night',
      '03d': 'cloud', '03n': 'cloud',
      '04d': 'cloudy', '04n': 'cloudy',
      '09d': 'rainy', '09n': 'rainy',
      '10d': 'rainy', '10n': 'rainy',
      '11d': 'thunderstorm', '11n': 'thunderstorm',
      '13d': 'snow', '13n': 'snow',
      '50d': 'cloud', '50n': 'cloud',
    };
    return iconMap[iconCode] || 'partly-sunny';
  };

  const getConditionGradient = (condition: string): readonly [string, string] => {
    const conditionLower = condition.toLowerCase();
    switch (conditionLower) {
      case 'clear':
        return ['#FFE259', '#FFA751'] as const;
      case 'clouds':
        return ['#BDC3C7', '#95A5A6'] as const;
      case 'rain':
      case 'drizzle':
        return ['#4A6FA5', '#166BA0'] as const;
      case 'thunderstorm':
        return ['#2C3E50', '#34495E'] as const;
      case 'snow':
        return ['#E8F4FD', '#D6EAF8'] as const;
      default:
        return ['#4A90E2', '#7BB3F0'] as const;
    }
  };

  const handleLocationPress = async (location: SavedLocation) => {
    try {
      await fetchWeatherByCoords(location.lat, location.lon);
      // Navigate to weather screen - assuming you have navigation
    } catch (error) {
      Alert.alert('Error', 'Failed to load weather for this location');
    }
  };

  const removeLocation = (id: string) => {
    Alert.alert(
      'Remove Location',
      'Are you sure you want to remove this location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSavedLocations(prev => prev.filter(loc => loc.id !== id));
          },
        },
      ]
    );
  };

  const renderLocationItem = ({ item }: { item: SavedLocation }) => (
    <Animated.View entering={FadeIn} style={styles.locationCard}>
      <LinearGradient
        colors={getConditionGradient(item.condition)}
        style={styles.locationGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.locationContent}
          onPress={() => handleLocationPress(item)}
        >
          <View style={styles.locationInfo}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationName}>{item.name}</Text>
              {item.isCurrentLocation && (
                <View style={styles.currentLocationBadge}>
                  <Ionicons name="location" size={12} color="#007AFF" />
                  <Text style={styles.currentLocationText}>Current</Text>
                </View>
              )}
            </View>
            {item.country && (
              <Text style={styles.locationCountry}>{item.country}</Text>
            )}
            <Text style={styles.locationCondition}>{item.condition}</Text>
          </View>
          
          <View style={styles.weatherInfo}>
            <Text style={styles.temperature}>
              {convertTemperature(item.temperature)}°{unit}
            </Text>
            <Ionicons
              name={getWeatherIcon(item.icon) as any}
              size={40}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>
        
        {!item.isCurrentLocation && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeLocation(item.id)}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );

  return (
    <LinearGradient colors={['#4A90E2', '#7BB3F0']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeIn} style={styles.header}>
          <Text style={styles.headerTitle}>My Locations</Text>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        <FlatList
          data={[currentLocationWeather, ...savedLocations].filter((loc): loc is SavedLocation => loc !== null)}
          renderItem={renderLocationItem}
          keyExtractor={(item) => item!.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  listContainer: {
    paddingBottom: 100,
  },
  locationCard: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  locationGradient: {
    position: 'relative',
  },
  locationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  locationInfo: {
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  locationName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginRight: 10,
  },
  currentLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentLocationText: {
    color: '#007AFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  locationCountry: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 5,
  },
  locationCondition: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.9,
    textTransform: 'capitalize',
  },
  weatherInfo: {
    alignItems: 'center',
  },
  temperature: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    marginBottom: 5,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});