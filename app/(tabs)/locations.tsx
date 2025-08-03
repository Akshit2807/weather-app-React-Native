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
  View,
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
  const refreshRotation = useSharedValue(0);
  
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
      const exists = savedLocations.some(
        loc => Math.abs(loc.lat - city.lat) < 0.01 && Math.abs(loc.lon - city.lon) < 0.01
      );
      
      if (exists) {
        Alert.alert('Location exists', 'This location is already in your saved locations');
        return;
      }

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
      
      hideModal();
      setSearchInput('');
      setShowSuggestions(false);
      
    } catch (error) {
      Alert.alert('Error', 'Failed to add location. Please try again.');
      console.error('Error adding location:', error);
    }
  };

  const removeLocation = (id: string, name: string) => {
    Alert.alert(
      'Remove Location',
      `Remove ${name} from your saved locations?`,
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

  const getConditionColor = (condition: string): string => {
    const conditionLower = condition.toLowerCase();
    switch (conditionLower) {
      case 'clear': return '#FFB347';
      case 'clouds': return '#87CEEB';
      case 'rain':
      case 'drizzle': return '#4A90E2';
      case 'thunderstorm': return '#8A2BE2';
      case 'snow': return '#E0E0E0';
      default: return '#87CEEB';
    }
  };

  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
    opacity: modalScale.value,
  }));

  const refreshAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${refreshRotation.value}deg` }],
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

  const handleRefresh = () => {
    refreshRotation.value = withSpring(refreshRotation.value + 360, { damping: 15, stiffness: 150 });
    loadCurrentLocation();
    updateSavedLocationsWeather(savedLocations);
  };

  const renderCitySuggestion = ({ item }: { item: CitySuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => addLocation(item)}
    >
      <View style={styles.suggestionIcon}>
        <Ionicons name="location-outline" size={18} color="#007AFF" />
      </View>
      <View style={styles.suggestionTextContainer}>
        <Text style={styles.suggestionCityName}>{item.name}</Text>
        <Text style={styles.suggestionCountry}>
          {item.state ? `${item.state}, ${item.country}` : item.country}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
    </TouchableOpacity>
  );

  const renderLocationItem = ({ item, index }: { item: SavedLocation; index: number }) => (
    <Animated.View entering={FadeIn.delay(index * 100)} style={styles.locationCard}>
      <TouchableOpacity
        style={[styles.locationContent, { backgroundColor: getConditionColor(item.condition) + '20' }]}
        onPress={() => handleLocationPress(item)}
        disabled={isUpdatingWeather}
      >
        <View style={styles.locationLeft}>
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
        
        <View style={styles.locationRight}>
          <Text style={styles.temperature}>
            {convertTemperature(item.temperature)}°{unit}
          </Text>
          <View style={[styles.iconContainer, { backgroundColor: getConditionColor(item.condition) + '30' }]}>
            <Ionicons
              name={getWeatherIcon(item.icon) as any}
              size={32}
              color={getConditionColor(item.condition)}
            />
          </View>
        </View>
        
        {!item.isCurrentLocation && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeLocation(item.id, item.name)}
          >
            <Ionicons name="close" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.delay(300)} style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="location-outline" size={64} color="#FFFFFF40" />
      </View>
      <Text style={styles.emptyTitle}>No Saved Locations</Text>
      <Text style={styles.emptyText}>
        Add your favorite cities to quickly check their weather conditions
      </Text>
      <TouchableOpacity style={styles.addFirstButton} onPress={showModal}>
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.addFirstButtonText}>Add Location</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Locations</Text>
        <Text style={styles.headerSubtitle}>
          {savedLocations.length} saved location{savedLocations.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Animated.View style={refreshAnimatedStyle}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={showModal}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const allLocations = [currentLocationWeather, ...savedLocations].filter(Boolean) as SavedLocation[];

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {isLoadingCurrentLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading locations...</Text>
          </View>
        ) : (
          <FlatList
            data={allLocations}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={allLocations.length === 0 ? styles.emptyListContainer : styles.listContainer}
            ListHeaderComponent={allLocations.length > 0 ? renderHeader : null}
            ListEmptyComponent={renderEmptyState}
            refreshing={false}
            onRefresh={handleRefresh}
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
                      <Text style={styles.modalTitle}>Add New Location</Text>
                      <TouchableOpacity onPress={hideModal} style={styles.closeButton}>
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
                        placeholderTextColor="#999"
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
                        <Text style={styles.suggestionLoaderText}>Searching cities...</Text>
                      </View>
                    ) : showSuggestions && citySuggestions.length > 0 ? (
                      <FlatList
                        data={citySuggestions}
                        renderItem={renderCitySuggestion}
                        keyExtractor={(item, index) => `${item.lat}-${item.lon}-${index}`}
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      />
                    ) : searchInput.length >= 2 && !isLoadingSuggestions ? (
                      <View style={styles.noResults}>
                        <Ionicons name="location-outline" size={32} color="#ccc" />
                        <Text style={styles.noResultsText}>No cities found</Text>
                        <Text style={styles.noResultsSubtext}>Try a different spelling</Text>
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
    paddingTop: 35,
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#FFFFFF80',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  listContainer: {
    paddingBottom: 120,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  locationCard: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  locationContent: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  locationLeft: {
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
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
    flex: 1,
  },
  currentLocationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  currentLocationText: {
    color: '#007AFF',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 2,
  },
  locationCountry: {
    color: '#FFFFFF80',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '400',
  },
  locationCondition: {
    color: '#FFFFFF',
    fontSize: 15,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  locationRight: {
    alignItems: 'center',
  },
  temperature: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  iconContainer: {
    borderRadius: 20,
    padding: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    color: '#FFFFFF80',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  addFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width - 40,
    maxHeight: '75%',
    borderRadius: 25,
    overflow: 'hidden',
  },
  modalBlur: {
    padding: 25,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
    fontWeight: '400',
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
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
    paddingVertical: 30,
  },
  suggestionLoaderText: {
    color: '#666',
    marginLeft: 8,
    fontSize: 14,
  },
  noResults: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
  },
  noResultsSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 5,
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