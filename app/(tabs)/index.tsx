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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Animated, {
  FadeIn,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

const { width, height } = Dimensions.get('window');

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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
  const searchBarOpacity = useSharedValue(0.8);
  const mapScale = useSharedValue(1);
  
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
    setIsSearchFocused(false);
    Keyboard.dismiss();
    
    clearError();
    await fetchWeatherByCoords(city.lat, city.lon);
    setShowMap(false);
  };

  const handleSearch = async () => {
    if (searchInput.trim()) {
      setShowSuggestions(false);
      setIsSearchFocused(false);
      Keyboard.dismiss();
      
      clearError();
      await fetchWeather(searchInput.trim());
      setSearchInput('');
      setShowMap(false);
    }
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    searchBarOpacity.value = withTiming(1, { duration: 200 });
  };

  const handleSearchBlur = () => {
    if (!showSuggestions) {
      setIsSearchFocused(false);
      searchBarOpacity.value = withTiming(0.8, { duration: 200 });
    }
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

  const getWeatherGradient = (): readonly [string, string] => {
    if (!weather) return ['#4A90E2', '#7BB3F0'] as const;
    
    const condition = weather.weather[0]?.main?.toLowerCase();
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 18;
    
    switch (condition) {
      case 'clear':
        return isNight ? ['#1e3c72', '#2a5298'] as const : ['#FFE259', '#FFA751'] as const;
      case 'clouds':
        return isNight ? ['#232526', '#414345'] as const : ['#bdc3c7', '#95a5a6'] as const;
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

  // Animated styles
  const searchBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: searchBarOpacity.value,
    transform: [
      { scale: withSpring(isSearchFocused ? 1.02 : 1) }
    ],
  }));

  const mapAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mapScale.value }
    ],
  }));

  const renderInitialLoader = () => (
    <Animated.View entering={FadeIn} style={styles.loaderContainer}>
      <View style={styles.weatherLoaderIcon}>
        <Ionicons name="cloud" size={80} color="#FFFFFF" />
        <Animated.View entering={FadeIn.delay(500)}>
          <Ionicons name="sunny" size={50} color="#FFD700" style={styles.sunIcon} />
        </Animated.View>
      </View>
      <Text style={styles.loaderText}>Getting your location...</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 20 }} />
    </Animated.View>
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

  const renderSearchSuggestions = () => {
    if (!showSuggestions) return null;

    return (
      <Animated.View 
        entering={SlideInDown.duration(200)} 
        exiting={SlideOutDown.duration(200)}
        style={styles.suggestionsContainer}
      >
        <BlurView intensity={95} style={styles.suggestionsBlur}>
          {isLoadingSuggestions ? (
            <View style={styles.suggestionLoader}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.suggestionLoaderText}>Searching...</Text>
            </View>
          ) : citySuggestions.length > 0 ? (
            <FlatList
              data={citySuggestions}
              renderItem={renderCitySuggestion}
              keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          ) : (
            <View style={styles.noSuggestions}>
              <Text style={styles.noSuggestionsText}>No cities found</Text>
            </View>
          )}
        </BlurView>
      </Animated.View>
    );
  };

  const renderErrorState = () => (
    <Animated.View entering={FadeIn} style={styles.centerContainer}>
      <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => setIsInitialLoading(false)}>
        <Text style={styles.retryButtonText}>Try Again</Text>
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
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setShowSuggestions(false);
          setIsSearchFocused(false);
        }}>
          <View style={styles.mainContainer}>
            {/* Enhanced Search Bar */}
            <Animated.View style={[styles.searchContainer, searchBarAnimatedStyle]}>
              <BlurView intensity={80} style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#FFFFFF80" style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search for a city..."
                  placeholderTextColor="#FFFFFF80"
                  value={searchInput}
                  onChangeText={handleSearchInputChange}
                  onSubmitEditing={handleSearch}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {searchInput.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSearchInput('');
                      setShowSuggestions(false);
                    }}
                    style={styles.clearButton}
                  >
                    <Ionicons name="close" size={18} color="#FFFFFF80" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </BlurView>
            </Animated.View>

            {/* Search Suggestions - Outside ScrollView */}
            {renderSearchSuggestions()}

            {/* Main Content */}
            {!isSearchFocused && !showSuggestions && (
              <ScrollView 
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false} 
                style={styles.scrollContainer}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* Header */}
                <Animated.View entering={FadeIn.delay(100)} style={styles.header}>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location" size={18} color="#FFFFFF" />
                    <Text style={styles.locationText} numberOfLines={1}>{weather.name}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.mapToggleButton}
                    onPress={() => {
                      setShowMap(!showMap);
                      mapScale.value = withSpring(showMap ? 1 : 1.02);
                    }}
                  >
                    <Ionicons name={showMap ? "list" : "map"} size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </Animated.View>

                {showMap ? (
                  <Animated.View 
                    entering={FadeIn.duration(300)} 
                    style={[styles.mapContainer, mapAnimatedStyle]}
                  >
                    {mapRegion && (
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
                        loadingEnabled={true}
                        loadingBackgroundColor="#4A90E2"
                        loadingIndicatorColor="#FFFFFF"
                      >
                        {markerCoords && (
                          <Marker 
                            coordinate={markerCoords}
                            anchor={{ x: 0.5, y: 0.5 }}
                          >
                            <View style={styles.customMarker}>
                              <Ionicons name="location" size={30} color="#FF6B6B" />
                            </View>
                          </Marker>
                        )}
                      </MapView>
                    )}
                    
                    {mapMoving && (
                      <View style={styles.mapLoadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.mapLoadingText}>Loading weather...</Text>
                      </View>
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
                        ios_backgroundColor="#FFFFFF40"
                      />
                      <Text style={styles.unitLabel}>°F</Text>
                    </Animated.View>

                    {/* Weather details cards */}
                    <Animated.View entering={FadeIn.delay(500)} style={styles.detailsGrid}>
                      <Animated.View entering={FadeIn.delay(550)} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <Ionicons name="water" size={20} color="#FFFFFF" />
                          <Text style={styles.detailLabel}>HUMIDITY</Text>
                        </View>
                        <Text style={styles.detailValue}>{weather.main.humidity}%</Text>
                      </Animated.View>

                      <Animated.View entering={FadeIn.delay(600)} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <Ionicons name="leaf" size={20} color="#FFFFFF" />
                          <Text style={styles.detailLabel}>WIND</Text>
                        </View>
                        <Text style={styles.detailValue}>{weather.wind.speed} m/s</Text>
                      </Animated.View>

                      <Animated.View entering={FadeIn.delay(650)} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <Ionicons name="eye" size={20} color="#FFFFFF" />
                          <Text style={styles.detailLabel}>VISIBILITY</Text>
                        </View>
                        <Text style={styles.detailValue}>
                          {weather.visibility ? `${Math.round(weather.visibility / 1000)} km` : 'N/A'}
                        </Text>
                      </Animated.View>

                      <Animated.View entering={FadeIn.delay(700)} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <Ionicons name="speedometer" size={20} color="#FFFFFF" />
                          <Text style={styles.detailLabel}>PRESSURE</Text>
                        </View>
                        <Text style={styles.detailValue}>{weather.main.pressure} hPa</Text>
                      </Animated.View>
                    </Animated.View>
                  </>
                )}
              </ScrollView>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
    paddingTop: 45,
  },
  mainContainer: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
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
  searchContainer: {
    marginBottom: 15,
    zIndex: 1000,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  clearButton: {
    padding: 5,
    marginRight: 5,
  },
  searchButton: {
    padding: 5,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    maxHeight: 250,
    zIndex: 999,
    marginHorizontal: 5,
  },
  suggestionsBlur: {
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionsList: {
    maxHeight: 240,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  suggestionCityName: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionCountry: {
    color: '#666',
    fontSize: 13,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 6,
  },
  mapToggleButton: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapContainer: {
    height: 350,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 25,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  map: {
    flex: 1,
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
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mainWeather: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
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
    opacity: 0.9,
    marginTop: 8,
    fontWeight: '500',
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
    fontWeight: '400',
    textTransform: 'capitalize',
  },
  unitToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unitLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 18,
    width: (width - 60) / 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    opacity: 0.9,
    letterSpacing: 0.5,
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 22,
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