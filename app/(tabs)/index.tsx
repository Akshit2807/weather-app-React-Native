import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

const { width, height } = Dimensions.get('window');

export default function WeatherScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const { 
    weather, 
    isLoading, 
    error, 
    unit, 
    fetchWeather, 
    fetchWeatherByCoords,
    setUnit, 
    clearError, 
    retryLastSearch 
  } = useWeather();

  useEffect(() => {
    requestLocationPermission();
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        await fetchWeatherByCoords(location.coords.latitude, location.coords.longitude);
      } else {
        Alert.alert('Permission needed', 'Location permission is required for weather data');
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const handleSearch = async () => {
    if (searchInput.trim()) {
      await fetchWeather(searchInput.trim());
      setSearchInput('');
    }
  };

  const handleUnitToggle = (value: boolean) => {
    setUnit(value ? 'F' : 'C');
  };

  const convertTemperature = (temp: number): number => {
    if (unit === 'F') {
      return Math.round((temp * 9/5) + 32);
    }
    return Math.round(temp);
  };

  const getWeatherGradient = (): readonly [string, string] => {
    if (!weather) return ['#4A90E2', '#7BB3F0'] as const;
    
    const condition = weather.weather[0]?.main?.toLowerCase();
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 18;
    
    switch (condition) {
      case 'clear':
        return isNight ? ['#2C3E50', '#4A6FA5'] as const : ['#FFE259', '#FFA751'] as const;
      case 'clouds':
        return isNight ? ['#34495E', '#5D6D7E'] as const : ['#BDC3C7', '#95A5A6'] as const;
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

  const formatTime = () => {
    return currentTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = () => {
    return currentTime.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderLoadingState = () => (
    <Animated.View entering={FadeIn} style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.loadingText}>Getting weather data...</Text>
    </Animated.View>
  );

  const renderErrorState = () => (
    <Animated.View entering={FadeIn} style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={retryLastSearch}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderWeatherData = () => {
    if (!weather) return null;

    return (
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollContainer}>
        {/* Header with location and search */}
        <Animated.View entering={FadeIn} style={styles.header}>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={16} color="#FFFFFF" />
            <Text style={styles.locationText}>{weather.name}</Text>
          </View>
          
          <TouchableOpacity style={styles.searchIcon}>
            <Ionicons name="search" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        {/* Main temperature display */}
        <Animated.View entering={FadeIn.delay(200)} style={styles.mainWeather}>
          <View style={styles.temperatureContainer}>
            <Text style={styles.mainTemperature}>
              {convertTemperature(weather.main.temp)}°
            </Text>
            <Text style={styles.feelsLike}>
              Feels like {convertTemperature(weather.main.feels_like || weather.main.temp)}°
            </Text>
          </View>
          
          <View style={styles.weatherIconContainer}>
            <Ionicons 
              name={getWeatherIcon(weather.weather[0].icon) as any} 
              size={120} 
              color="#FFFFFF" 
            />
          </View>
        </Animated.View>

        {/* Weather description */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.descriptionContainer}>
          <Text style={styles.weatherDescription}>
            {weather.weather[0].description}
          </Text>
          <Text style={styles.dateTime}>{formatDate()}</Text>
        </Animated.View>

        {/* Unit toggle */}
        <Animated.View entering={FadeIn.delay(400)} style={styles.unitToggleContainer}>
          <Text style={styles.unitLabel}>°C</Text>
          <Switch
            value={unit === 'F'}
            onValueChange={handleUnitToggle}
            trackColor={{ false: '#FFFFFF40', true: '#FFFFFF40' }}
            thumbColor="#FFFFFF"
          />
          <Text style={styles.unitLabel}>°F</Text>
        </Animated.View>

        {/* Weather details cards */}
        <Animated.View entering={FadeIn.delay(500)} style={styles.detailsGrid}>
          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Ionicons name="water" size={20} color="#FFFFFF" />
              <Text style={styles.detailLabel}>HUMIDITY</Text>
            </View>
            <Text style={styles.detailValue}>{weather.main.humidity}%</Text>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Ionicons name="leaf" size={20} color="#FFFFFF" />
              <Text style={styles.detailLabel}>WIND</Text>
            </View>
            <Text style={styles.detailValue}>{weather.wind.speed} m/s</Text>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Ionicons name="eye" size={20} color="#FFFFFF" />
              <Text style={styles.detailLabel}>VISIBILITY</Text>
            </View>
            <Text style={styles.detailValue}>
              {weather.visibility ? `${Math.round(weather.visibility / 1000)} km` : 'N/A'}
            </Text>
          </View>

          <View style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Ionicons name="speedometer" size={20} color="#FFFFFF" />
              <Text style={styles.detailLabel}>PRESSURE</Text>
            </View>
            <Text style={styles.detailValue}>{weather.main.pressure} hPa</Text>
          </View>
        </Animated.View>

        {/* Search input */}
        <Animated.View entering={FadeIn.delay(600)} style={styles.searchContainer}>
          <BlurView intensity={20} style={styles.searchInputContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a city..."
              placeholderTextColor="#FFFFFF80"
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity onPress={handleSearch}>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <LinearGradient colors={getWeatherGradient()} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        {isLoading && renderLoadingState()}
        {error && !isLoading && renderErrorState()}
        {weather && !isLoading && !error && renderWeatherData()}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 20,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  searchIcon: {
    padding: 8,
  },
  mainWeather: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  temperatureContainer: {
    flex: 1,
  },
  mainTemperature: {
    color: '#FFFFFF',
    fontSize: 96,
    fontWeight: '100',
    lineHeight: 96,
  },
  feelsLike: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.8,
    marginTop: 5,
  },
  weatherIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptionContainer: {
    marginBottom: 30,
  },
  weatherDescription: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    textTransform: 'capitalize',
    marginBottom: 5,
  },
  dateTime: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.8,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 15,
    alignSelf: 'center',
    marginBottom: 30,
  },
  unitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 10,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    width: (width - 50) / 2,
    marginBottom: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    opacity: 0.8,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '300',
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginRight: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});