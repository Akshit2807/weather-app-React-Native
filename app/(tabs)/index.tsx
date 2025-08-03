import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
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
import MapView, { Marker, Region } from 'react-native-maps';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

const { width, height } = Dimensions.get('window');

export default function WeatherScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [markerCoords, setMarkerCoords] = useState<{latitude: number, longitude: number} | null>(null);
  
  const mapRef = useRef<MapView>(null);
  const moveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
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

  useEffect(() => {
    if (weather?.coord) {
      setMapRegion({
        latitude: weather.coord.lat,
        longitude: weather.coord.lon,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
      setMarkerCoords({
        latitude: weather.coord.lat,
        longitude: weather.coord.lon,
      });
    }
  }, [weather]);

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
      clearError();
      await fetchWeather(searchInput.trim());
      setSearchInput('');
      setIsSearchFocused(false);
      setShowMap(false);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleRetry = () => {
    clearError();
    setIsSearchFocused(true);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    
    if (moveTimeout.current) {
      clearTimeout(moveTimeout.current);
    }
    
    moveTimeout.current = setTimeout(() => {
      fetchWeatherByCoords(latitude, longitude);
    }, 1000);
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      setMapRegion(newRegion);
      setMarkerCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      mapRef.current?.animateToRegion(newRegion, 1000);
      await fetchWeatherByCoords(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      Alert.alert('Error', 'Could not get current location');
    }
  };

  const convertTemperature = (temp: number): number => {
    return unit === 'F' ? Math.round((temp * 9/5) + 32) : Math.round(temp);
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

  const renderWeatherLoader = () => (
    <Animated.View entering={FadeIn} style={styles.loaderContainer}>
      <View style={styles.weatherLoaderIcon}>
        <Ionicons name="cloud" size={60} color="#FFFFFF" />
        <Animated.View entering={FadeIn.delay(500)}>
          <Ionicons name="sunny" size={40} color="#FFD700" style={styles.sunIcon} />
        </Animated.View>
      </View>
      <Text style={styles.loaderText}>Getting weather for your location...</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 20 }} />
    </Animated.View>
  );

  const renderErrorState = () => (
    <Animated.View entering={FadeIn} style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
        <Text style={styles.retryButtonText}>Search Again</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderWeatherData = () => {
    if (!weather) return null;

    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false} 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Search input - moved to top */}
          <Animated.View entering={FadeIn} style={styles.searchContainer}>
            <BlurView intensity={20} style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a city..."
                placeholderTextColor="#FFFFFF80"
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmitEditing={handleSearch}
                onFocus={handleSearchFocus}
                onBlur={() => setIsSearchFocused(false)}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={handleSearch}>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </BlurView>
          </Animated.View>

          {!isSearchFocused && (
            <>
              {/* Header */}
              <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
                <View style={styles.locationContainer}>
                  <Ionicons name="location" size={16} color="#FFFFFF" />
                  <Text style={styles.locationText}>{weather.name}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.mapToggleButton}
                  onPress={() => setShowMap(!showMap)}
                >
                  <Ionicons name={showMap ? "list" : "map"} size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </Animated.View>

              {showMap ? (
                <Animated.View entering={FadeIn} style={styles.mapContainer}>
                  {mapRegion && (
                    <MapView
                      ref={mapRef}
                      style={styles.map}
                      region={mapRegion}
                      onPress={handleMapPress}
                      showsUserLocation={true}
                      showsMyLocationButton={false}
                    >
                      {markerCoords && (
                        <Marker coordinate={markerCoords} />
                      )}
                    </MapView>
                  )}
                  <TouchableOpacity style={styles.locateButton} onPress={getCurrentLocation}>
                    <Ionicons name="locate" size={24} color="#007AFF" />
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <>
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
                  </Animated.View>

                  {/* Unit toggle */}
                  <Animated.View entering={FadeIn.delay(400)} style={styles.unitToggleContainer}>
                    <Text style={styles.unitLabel}>°C</Text>
                    <Switch
                      value={unit === 'F'}
                      onValueChange={(value) => setUnit(value ? 'F' : 'C')}
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
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return (
    <LinearGradient colors={getWeatherGradient()} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {isLoading && renderWeatherLoader()}
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
  safeArea: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherLoaderIcon: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sunIcon: {
    position: 'absolute',
    top: -50,
    right: -30,
  },
  loaderText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  searchContainer: {
    marginBottom: 20,
    zIndex: 1000,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  mapToggleButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  mapContainer: {
    height: 300,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  locateButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
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
    width: (width - 70) / 2,
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
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