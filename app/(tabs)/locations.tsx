import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';
import { useWeather } from '../../context/WeatherContext';

const { width } = Dimensions.get('window');

interface SavedLocation {
  id: string;
  name: string;
  country?: string;
  state?: string;
  lat: number;
  lon: number;
  temperature: number;
  condition: string;
  icon: string;
  isCurrentLocation?: boolean;
  dateAdded: number;
}

interface CitySuggestion {
  name: string;
  country: string;
  lat: number;
  lon: number;
  state?: string;
}

const STORAGE_KEY = '@weather_saved_locations';

export default function LocationsScreen() {
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [currentLocationWeather, setCurrentLocationWeather] = useState<SavedLocation | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingCurrentLocation, setIsLoadingCurrentLocation] = useState(true);
  const [isUpdatingWeather, setIsUpdatingWeather] = useState(false);
  
  const { fetchWeatherByCoords, unit } = useWeather();
  
  // Animation values
  const modalScale = useSharedValue(0);
  
  useEffect(() => {
    loadCurrentLocation();
    loadSavedLocations();
  }, []);

  const loadCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        // Fetch weather for current location
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}&appid=dd3eed2b572cd5929a9f50b77007248d&units=metric`
        );
        
        if (response.ok) {
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
            dateAdded: Date.now(),
          });
        }
      }
    } catch (error) {
      console.error('Error loading current location:', error);
    } finally {
      setIsLoadingCurrentLocation(false);
    }
  };

  const loadSavedLocations = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const locations = JSON.parse(stored);
        setSavedLocations(locations);
        // Update weather for all saved locations
        updateSavedLocationsWeather(locations);
      }
    } catch (error) {
      console.error('Error loading saved locations:', error);
    }
  };

  const updateSavedLocationsWeather = async (locations: SavedLocation[]) => {
    try {
      const updatedLocations = await Promise.all(
        locations.map(async (location) => {
          try {
            const response = await fetch(
              `https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&appid=dd3eed2b572cd5929a9f50b77007248d&units=metric`
            );
            
            if (response.ok) {
              const data = await response.json();
              return {
                ...location,
                temperature: Math.round(data.main.temp),
                condition: data.weather[0].main,
                icon: data.weather[0].icon,
              };
            }
            return location;
          } catch (error) {
            return location;
          }
        })
      );
      
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocations));
    } catch (error) {
      console.error('Error updating weather:', error);
    }
  };

  const searchCities = async (query: string): Promise<CitySuggestion[]> => {
    if (query.length < 2) return [];
    
    try {
      const response = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=8&appid=dd3eed2b572cd5929a9f50b77007248d`
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

  const handleSearchInputChange = useCallback((text: string) => {
    setSearchInput(text);
    
    if (text.length >= 2) {
      setIsLoadingSuggestions(true);
      const debounceTimeout = setTimeout(async () => {
        const suggestions = await searchCities(text);
        setCitySuggestions(suggestions);
        setShowSuggestions(true);
        setIsLoadingSuggestions(false);
      }, 300);
      
      return () => clearTimeout(debounceTimeout);
    } else {
      setShowSuggestions(false);
      setCitySuggestions([]);
      setIsLoadingSuggestions(false);
    }
  }, []);

  const addLocation = async (city: CitySuggestion) => {
    try {
      // Check if location already exists
      const exists = savedLocations.some(
        loc => Math.abs(loc.lat - city.lat) < 0.01 && Math.abs(loc.lon - city.lon) < 0.01
      );
      
      if (exists) {
        Alert.alert('Location exists', 'This location is already in your saved locations');
        return;
      }

      // Fetch weather for the location
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=dd3eed2b572cd5929a9f50b77007248d&units=metric`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch weather data');
      }
      
      const data = await response.json();
      
      const newLocation: SavedLocation = {
        id: `${city.lat}-${city.lon}-${Date.now()}`,
        name: city.name,
        country: city.country,
        state: city.state,
        lat: city.lat,
        lon: city.lon,
        temperature: Math.round(data.main.temp),
        condition: data.weather[0].main,
        icon: data.weather[0].icon,
        dateAdded: Date.now(),
      };

      const updatedLocations = [...savedLocations, newLocation];
      setSavedLocations(updatedLocations);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocations));
      
      setShowAddModal(false);
      setSearchInput('');
      setShowSuggestions(false);
      
      Alert.alert('Success', `${city.name} has been added to your locations`);
    } catch (error) {
      Alert.alert('Error', 'Failed to add location. Please try again.');
      console.error('Error adding location:', error);
    }
  };

  const removeLocation = (id: string, name: string) => {
    Alert.alert(
      'Remove Location',
      `Are you sure you want to remove ${name} from your saved locations?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updatedLocations = savedLocations.filter(loc => loc.id !== id);
            setSavedLocations(updatedLocations);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocations));
          },
        },
      ]
    );
  };

  const handleLocationPress = async (location: SavedLocation) => {
    try {
      setIsUpdatingWeather(true);
      await fetchWeatherByCoords(location.lat, location.lon);
      router.push('/(tabs)/');
    } catch (error) {
      Alert.alert('Error', 'Failed to load weather for this location');
    } finally {
      setIsUpdatingWeather(false);
    }
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

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
  }));

  const showModal = () => {
    setShowAddModal(true);
    modalScale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const hideModal = () => {
    modalScale.value = withSpring(0, { damping: 15, stiffness: 150 });
    setTimeout(() => {
      setShowAddModal(false);
      setSearchInput('');
      setShowSuggestions(false);
    }, 200);
  };

  const renderCitySuggestion = ({ item }: { item: CitySuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => addLocation(item)}
    >
      <Ionicons name="location-outline" size={18} color="#666" />
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionCityName}>{item.name}</Text>
        <Text style={styles.suggestionCountry}>
          {item.state ? `${item.state}, ${item.country}` : item.country}
        </Text>
      </View>
      <Ionicons name="add" size={20} color="#007AFF" />
    </TouchableOpacity>
  );

  const renderLocationItem = ({ item }: { item: SavedLocation }) => (
    <Animated.View entering={FadeIn.delay(100)} style={styles.locationCard}>
      <LinearGradient
        colors={getConditionGradient(item.condition)}
        style={styles.locationGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity
          style={styles.locationContent}
          onPress={() => handleLocationPress(item)}
          disabled={isUpdatingWeather}
        >
          <View style={styles.locationInfo}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
              {item.isCurrentLocation && (
                <View style={styles.currentLocationBadge}>
                  <Ionicons name="location" size={10} color="#007AFF" />
                  <Text style={styles.currentLocationText}>Current</Text>
                </View>
              )}
            </View>
            {(item.country || item.state) && (
              <Text style={styles.locationCountry} numberOfLines={1}>
                {item.state ? `${item.state}, ${item.country}` : item.country}
              </Text>
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
            onPress={() => removeLocation(item.id, item.name)}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.delay(300)} style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={64} color="#FFFFFF60" />
      <Text style={styles.emptyTitle}>No Saved Locations</Text>
      <Text style={styles.emptyText}>
        Add your favorite cities to quickly check their weather
      </Text>
      <TouchableOpacity style={styles.addFirstButton} onPress={showModal}>
        <Ionicons name="add" size={20} color="#007AFF" />
        <Text style={styles.addFirstButtonText}>Add Your First Location</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const allLocations = [currentLocationWeather, ...savedLocations].filter(Boolean) as SavedLocation[];

  return (
    <LinearGradient colors={['#4A90E2', '#7BB3F0']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {isLoadingCurrentLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading your locations...</Text>
          </View>
        ) : allLocations.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={allLocations}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshing={false}
            onRefresh={() => {
              loadCurrentLocation();
              updateSavedLocationsWeather(savedLocations);
            }}
            ListHeaderComponent={
              <Animated.View entering={FadeIn} style={styles.header}>
                <Text style={styles.headerTitle}>My Locations</Text>
                <TouchableOpacity style={styles.addButton} onPress={showModal}>
                  <Ionicons name="add" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </Animated.View>
            }
          />
        )}

        {/* Add Location Modal */}
        <Modal
          visible={showAddModal}
          transparent
          animationType="fade"
          onRequestClose={hideModal}
        >
          <TouchableWithoutFeedback onPress={hideModal}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <Animated.View style={[styles.modalContainer, modalAnimatedStyle]}>
                  <BlurView intensity={95} style={styles.modalBlur}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Add Location</Text>
                      <TouchableOpacity onPress={hideModal}>
                        <Ionicons name="close" size={24} color="#333" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.searchContainer}>
                      <Ionicons name="search" size={20} color="#666" />
                      <TextInput
                        style={styles.modalSearchInput}
                        placeholder="Search for a city..."
                        value={searchInput}
                        onChangeText={handleSearchInputChange}
                        autoFocus
                        autoCorrect={false}
                        autoCapitalize="words"
                      />
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
                      <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No cities found</Text>
                      </View>
                    ) : null}
                  </BlurView>
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {isUpdatingWeather && (
          <View style={styles.updateOverlay}>
            <BlurView intensity={80} style={styles.updateBlur}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.updateText}>Loading weather...</Text>
            </BlurView>
          </View>
        )}
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
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    paddingVertical: 10,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 15,
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 120,
    paddingTop: 10,
  },
  locationCard: {
    marginBottom: 15,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    marginRight: 15,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginRight: 10,
    flex: 1,
  },
  currentLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    opacity: 0.9,
    marginBottom: 6,
  },
  locationCondition: {
    color: '#FFFFFF',
    fontSize: 16,
    opacity: 0.95,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  weatherInfo: {
    alignItems: 'center',
  },
  temperature: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    marginBottom: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
    marginBottom: 30,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addFirstButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    maxHeight: '70%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalBlur: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  suggestionsList: {
    maxHeight: 300,
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
  noResults: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#666',
    fontSize: 14,
  },
  updateOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateBlur: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  updateText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
});