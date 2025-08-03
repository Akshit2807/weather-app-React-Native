import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Animated, {
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

const { width } = Dimensions.get('window');

interface CitySuggestion {
  name: string;
  country: string;
  lat: number;
  lon: number;
  state?: string;
}

export default function WeatherScreen() {
  const [searchInput, setSearchInput] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [markerCoords, setMarkerCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mapMoving, setMapMoving] = useState(false);
  
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapMoveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Animated values
  const searchAnimation = useSharedValue(0);
  const mapAnimation = useSharedValue(0);
  
  const { 
    weather, 
    isLoading, 
    error, 
    unit, 
    fetchWeather, 
    fetchWeatherByCoords,
    setUnit, 
    clearError, 
  } = useWeather();

  useEffect(() => {
    initializeApp();
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

  const initializeApp = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await fetchWeatherByCoords(location.coords.latitude, location.coords.longitude);
      } else {
        Alert.alert('Permission needed', 'Location permission is required for weather data');
      }
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const searchCities = async (query: string): Promise<CitySuggestion[]> => {
    if (query.length < 2) return [];
    
    try {
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=dd3eed2b572cd5929a9f50b77007248d`
      );
      const data = await response.json();
      
      return data.map((item: any) => ({
        name: item.name,
        country: item.country,
        state: item.state,
        lat: item.lat,
        lon: item.lon,
      }));
    } catch (error) {
      console.error('City search error:', error);
      return [];
    }
  };

  const handleSearchInputChange = (text: string) => {
    setSearchInput(text);
    
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    if (text.length >= 2) {
      setIsLoadingSuggestions(true);
      debounceTimeout.current = setTimeout(async () => {
        const suggestions = await searchCities(text);
        setCitySuggestions(suggestions);
        setShowSuggestions(true);
        setIsLoadingSuggestions(false);
      }, 300);
    } else {
      setShowSuggestions(false);
      setCitySuggestions([]);
      setIsLoadingSuggestions(false);
    }
  };

  const handleCitySelect = async (city: CitySuggestion) => {
    setSearchInput('');
    setShowSuggestions(false);
    hideSearchOverlay();
    
    clearError();
    await fetchWeatherByCoords(city.lat, city.lon);
  };

  const handleSearch = async () => {
    if (searchInput.trim()) {
      setShowSuggestions(false);
      hideSearchOverlay();
      
      clearError();
      await fetchWeather(searchInput.trim());
      setSearchInput('');
    }
  };

  const showSearchOverlay = () => {
    setShowSearchModal(true);
    searchAnimation.value = withSpring(1, { damping: 15, stiffness: 150 });
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 200);
  };

  const hideSearchOverlay = () => {
    Keyboard.dismiss();
    searchAnimation.value = withSpring(0, { damping: 15, stiffness: 150 });
    setTimeout(() => {
      setShowSearchModal(false);
      setShowSuggestions(false);
    }, 200);
  };

  const toggleMap = () => {
    setShowMap(!showMap);
    mapAnimation.value = withSpring(showMap ? 0 : 1, { damping: 15, stiffness: 150 });
  };

  const handleMapPress = useCallback((event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkerCoords({ latitude, longitude });
    setMapMoving(true);
    
    if (mapMoveTimeout.current) {
      clearTimeout(mapMoveTimeout.current);
    }
    
    mapMoveTimeout.current = setTimeout(async () => {
      try {
        await fetchWeatherByCoords(latitude, longitude);
        setMapMoving(false);
      } catch (error) {
        setMapMoving(false);
      }
    }, 800);
  }, [fetchWeatherByCoords]);

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
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

  const getWeatherGradient = (): readonly [string, string, string] => {
    if (!weather) return ['#1e3c72', '#2a5298', '#4A90E2'] as const;
    
    const condition = weather.weather[0]?.main?.toLowerCase();
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 18;
    
    switch (condition) {
      case 'clear':
        return isNight 
          ? ['#0f0c29', '#24243e', '#313862'] as const 
          : ['#ff9a9e', '#fecfef', '#fecfef'] as const;
      case 'clouds':
        return isNight 
          ? ['#232526', '#414345', '#5C5C5C'] as const 
          : ['#bdc3c7', '#95a5a6', '#7f8c8d'] as const;
      case 'rain':
      case 'drizzle':
        return ['#3a6186', '#89253e', '#2c3e50'] as const;
      case 'thunderstorm':
        return ['#2C3E50', '#4A6741', '#27AE60'] as const;
      case 'snow':
        return ['#E8F4FD', '#D6EAF8', '#AED6F1'] as const;
      default:
        return ['#667eea', '#764ba2', '#667eea'] as const;
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

  // Animated styles
  const searchBarAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(searchAnimation.value, [0, 1], [0, 1]);
    const translateY = interpolate(searchAnimation.value, [0, 1], [-50, 0]);
    
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const mapAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(mapAnimation.value, [0, 1], [0, 300]);
    const opacity = interpolate(mapAnimation.value, [0, 1], [0, 1]);
    
    return {
      height,
      opacity,
    };
  });

  const renderInitialLoader = () => (
    <View style={styles.loaderContainer}>
      <View style={styles.weatherLoaderIcon}>
        <Ionicons name="cloud" size={80} color="#FFFFFF" />
        <Animated.View entering={FadeIn.delay(500)}>
          <Ionicons name="sunny" size={50} color="#FFD700" style={styles.sunIcon} />
        </Animated.View>
      </View>
      <Text style={styles.loaderText}>Getting your location...</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 20 }} />
    </View>
  );

  const renderCitySuggestion = ({ item }: { item: CitySuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleCitySelect(item)}
    >
      <Ionicons name="location-outline" size={16} color="#666" />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionCityName}>{item.name}</Text>
        <Text style={styles.suggestionCountry}>
          {item.state ? `${item.state}, ${item.country}` : item.country}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSearchOverlay = () => {
    if (!showSearchModal) return null;

    return (
      <Animated.View style={[styles.searchOverlay, searchBarAnimatedStyle]}>
        <TouchableWithoutFeedback onPress={hideSearchOverlay}>
          <View style={styles.searchOverlayBackground} />
        </TouchableWithoutFeedback>
        
        <View style={styles.searchContainer}>
          <BlurView intensity={95} style={styles.searchBlur}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Search Cities</Text>
              <TouchableOpacity onPress={hideSearchOverlay}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#666" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Type city name..."
                value={searchInput}
                onChangeText={handleSearchInputChange}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {searchInput.length > 0 && (
                <TouchableOpacity onPress={() => setSearchInput('')}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {isLoadingSuggestions ? (
              <View style={styles.suggestionLoader}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.suggestionLoaderText}>Searching...</Text>
              </View>
            ) : showSuggestions && citySuggestions.length > 0 ? (
              <FlatList
                data={citySuggestions}
                renderItem={renderCitySuggestion}
                keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
                style={styles.suggestionsList}
                keyboardShouldPersistTaps="handled"
              />
            ) : searchInput.length >= 2 && !isLoadingSuggestions ? (
              <View style={styles.noSuggestions}>
                <Text style={styles.noSuggestionsText}>No cities found</Text>
              </View>
            ) : null}
          </BlurView>
        </View>
      </Animated.View>
    );
  };

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => setIsInitialLoading(false)}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWeatherData = () => {
    if (!weather) return null;

    return (
      <View style={styles.container}>
        {/* Top Navigation */}
        <View style={styles.topNav}>
          <View style={styles.unitToggle}>
            <Text style={[styles.unitText, unit === 'C' && styles.unitTextActive]}>°C</Text>
            <Switch
              value={unit === 'F'}
              onValueChange={(value) => setUnit(value ? 'F' : 'C')}
              trackColor={{ false: '#FFFFFF30', true: '#FFFFFF30' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#FFFFFF30"
              style={styles.switch}
            />
            <Text style={[styles.unitText, unit === 'F' && styles.unitTextActive]}>°F</Text>
          </View>
          
          <TouchableOpacity style={styles.searchButton} onPress={showSearchOverlay}>
            <Ionicons name="search" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          removeClippedSubviews={true}
        >
          {/* Location Header */}
          <Animated.View entering={FadeIn.delay(100)} style={styles.locationHeader}>
            <Ionicons name="location" size={20} color="#FFFFFF80" />
            <Text style={styles.locationText}>{weather.name}</Text>
          </Animated.View>

          {/* Main Weather Display */}
          <Animated.View entering={FadeIn.delay(200)} style={styles.mainWeatherContainer}>
            <View style={styles.temperatureSection}>
              <Text style={styles.mainTemperature}>
                {convertTemperature(weather.main.temp)}°
              </Text>
              <Text style={styles.condition}>
                {weather.weather[0].description}
              </Text>
              <Text style={styles.feelsLike}>
                Feels like {convertTemperature(weather.main.feels_like || weather.main.temp)}°
              </Text>
            </View>
            
            <View style={styles.iconSection}>
              <Ionicons 
                name={getWeatherIcon(weather.weather[0].icon) as any} 
                size={100} 
                color="#FFFFFF" 
              />
            </View>
          </Animated.View>

          {/* Weather Details */}
          <Animated.View entering={FadeIn.delay(300)} style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="water" size={24} color="#FFFFFF80" />
                <Text style={styles.detailLabel}>Humidity</Text>
                <Text style={styles.detailValue}>{weather.main.humidity}%</Text>
              </View>
              
              <View style={styles.detailItem}>
                <Ionicons name="leaf" size={24} color="#FFFFFF80" />
                <Text style={styles.detailLabel}>Wind</Text>
                <Text style={styles.detailValue}>{weather.wind.speed} m/s</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Ionicons name="eye" size={24} color="#FFFFFF80" />
                <Text style={styles.detailLabel}>Visibility</Text>
                <Text style={styles.detailValue}>
                  {weather.visibility ? `${Math.round(weather.visibility / 1000)} km` : 'N/A'}
                </Text>
              </View>
              
              <View style={styles.detailItem}>
                <Ionicons name="speedometer" size={24} color="#FFFFFF80" />
                <Text style={styles.detailLabel}>Pressure</Text>
                <Text style={styles.detailValue}>{weather.main.pressure} hPa</Text>
              </View>
            </View>
          </Animated.View>

          {/* Map Toggle Button */}
          <Animated.View entering={FadeIn.delay(400)} style={styles.mapToggleContainer}>
            <TouchableOpacity style={styles.mapToggleButton} onPress={toggleMap}>
              <Ionicons name={showMap ? "list" : "map"} size={20} color="#FFFFFF" />
              <Text style={styles.mapToggleText}>
                {showMap ? "Hide Map" : "Show Map"}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Google Maps Container */}
          <Animated.View style={[styles.mapContainer, mapAnimatedStyle]}>
            {mapRegion && showMap && (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={mapRegion}
                onPress={handleMapPress}
                showsUserLocation={true}
                showsMyLocationButton={false}
                scrollEnabled={true}
                zoomEnabled={true}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                {markerCoords && (
                  <Marker coordinate={markerCoords}>
                    <View style={styles.customMarker}>
                      <Ionicons name="location" size={30} color="#FF6B6B" />
                    </View>
                  </Marker>
                )}
              </MapView>
            )}
            
            {mapMoving && showMap && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.mapLoadingText}>Loading weather...</Text>
              </View>
            )}
            
            {showMap && (
              <TouchableOpacity style={styles.locateButton} onPress={getCurrentLocation}>
                <Ionicons name="locate" size={20} color="#007AFF" />
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>

        {/* Search Overlay */}
        {renderSearchOverlay()}
      </View>
    );
  };

  return (
    <LinearGradient colors={getWeatherGradient()} style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={styles.safeArea}>
        {isInitialLoading && renderInitialLoader()}
        {error && !isInitialLoading && !weather && renderErrorState()}
        {!isInitialLoading && renderWeatherData()}
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
    paddingTop : 35,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  weatherLoaderIcon: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  sunIcon: {
    position: 'absolute',
    top: -60,
    right: -40,
  },
  loaderText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: '500',
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  unitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  unitText: {
    color: '#FFFFFF60',
    fontSize: 14,
    fontWeight: '600',
  },
  unitTextActive: {
    color: '#FFFFFF',
  },
  switch: {
    marginHorizontal: 8,
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  searchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 10,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 8,
  },
  mainWeatherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  temperatureSection: {
    flex: 1,
  },
  mainTemperature: {
    color: '#FFFFFF',
    fontSize: 80,
    fontWeight: '100',
    lineHeight: 80,
  },
  condition: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '400',
    textTransform: 'capitalize',
    marginTop: 5,
  },
  feelsLike: {
    color: '#FFFFFF80',
    fontSize: 16,
    fontWeight: '400',
    marginTop: 5,
  },
  iconSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    flex: 0.48,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  detailLabel: {
    color: '#FFFFFF80',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  mapToggleContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  mapToggleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  mapToggleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  mapContainer: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    height: 300,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  locateButton: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  searchOverlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  searchContainer: {
    margin: 20,
    marginTop: 80,
    maxHeight: '70%',
  },
  searchBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  suggestionsList: {
    maxHeight: 250,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  suggestionCityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  suggestionCountry: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  suggestionLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  suggestionLoaderText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  noSuggestions: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noSuggestionsText: {
    color: '#666',
    fontSize: 14,
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
    marginTop: 20,
    marginBottom: 25,
    lineHeight: 26,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});