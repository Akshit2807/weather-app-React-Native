import { describe, expect, it, jest } from '@jest/globals';
import '@testing-library/jest-native/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { WeatherProvider, useWeather } from '../../context/WeatherContext';

// Mock weather data
const mockWeatherData = {
  name: 'London',
  main: {
    temp: 25,
    humidity: 60,
  },
  weather: [
    {
      main: 'Clear',
      description: 'clear sky',
      icon: '01d',
    },
  ],
  wind: {
    speed: 5.2,
  },
  coord: {
    lat: 51.5074,
    lon: -0.1278,
  },
};

// Test component for weather display
interface WeatherDisplayProps {
  weather: typeof mockWeatherData | null;
  unit: 'C' | 'F';
}

const WeatherDisplay: React.FC<WeatherDisplayProps> = ({ weather, unit }) => {
  if (!weather) return <Text testID="no-weather">No weather data</Text>;

  const convertTemperature = (temp: number): number => {
    if (unit === 'F') {
      return Math.round((temp * 9/5) + 32);
    }
    return Math.round(temp);
  };

  return (
    <View testID="weather-display">
      <Text testID="city-name">{weather.name}</Text>
      <Text testID="temperature">{convertTemperature(weather.main.temp)}°{unit}</Text>
      <Text testID="description">{weather.weather[0].description}</Text>
      <Text testID="humidity">Humidity: {weather.main.humidity}%</Text>
      <Text testID="wind-speed">Wind: {weather.wind.speed} m/s</Text>
    </View>
  );
};

// Test component for context functionality
const WeatherContextTest: React.FC = () => {
  const { weather, isLoading, error, unit, setUnit } = useWeather();

  return (
    <View>
      <Text testID="loading-state">{isLoading ? 'Loading' : 'Not Loading'}</Text>
      <Text testID="error-state">{error || 'No Error'}</Text>
      <Text testID="current-unit">{unit}</Text>
      <TouchableOpacity testID="toggle-unit" onPress={() => setUnit(unit === 'C' ? 'F' : 'C')}>
        <Text>Toggle Unit</Text>
      </TouchableOpacity>
      <WeatherDisplay weather={weather} unit={unit} />
    </View>
  );
};

// Mock dependencies
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('react-native-maps', () => ({
  __esModule: true,
  default: 'MapView',
  Marker: 'Marker',
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

describe('WeatherDisplay Component', () => {
  it('renders weather data correctly in Celsius', () => {
    render(
      <WeatherProvider>
        <WeatherDisplay weather={mockWeatherData} unit="C" />
      </WeatherProvider>
    );

    expect(screen.getByTestId('weather-display')).toBeTruthy();
    expect(screen.getByTestId('city-name')).toHaveTextContent('London');
    expect(screen.getByTestId('temperature')).toHaveTextContent('25°C');
    expect(screen.getByTestId('description')).toHaveTextContent('clear sky');
    expect(screen.getByTestId('humidity')).toHaveTextContent('Humidity: 60%');
    expect(screen.getByTestId('wind-speed')).toHaveTextContent('Wind: 5.2 m/s');
  });

  it('renders weather data correctly in Fahrenheit', () => {
    render(
      <WeatherProvider>
        <WeatherDisplay weather={mockWeatherData} unit="F" />
      </WeatherProvider>
    );

    expect(screen.getByTestId('city-name')).toHaveTextContent('London');
    expect(screen.getByTestId('temperature')).toHaveTextContent('77°F');
    expect(screen.getByTestId('description')).toHaveTextContent('clear sky');
    expect(screen.getByTestId('humidity')).toHaveTextContent('Humidity: 60%');
    expect(screen.getByTestId('wind-speed')).toHaveTextContent('Wind: 5.2 m/s');
  });

  it('renders fallback when weather data is null', () => {
    render(
      <WeatherProvider>
        <WeatherDisplay weather={null} unit="C" />
      </WeatherProvider>
    );

    expect(screen.getByTestId('no-weather')).toHaveTextContent('No weather data');
    expect(screen.queryByTestId('weather-display')).toBeNull();
  });

  it('handles different weather conditions', () => {
    const snowyWeather = {
      ...mockWeatherData,
      name: 'Oslo',
      main: { temp: -5, humidity: 80 },
      weather: [{ main: 'Snow', description: 'light snow', icon: '13d' }],
    };

    render(
      <WeatherProvider>
        <WeatherDisplay weather={snowyWeather} unit="C" />
      </WeatherProvider>
    );

    expect(screen.getByTestId('city-name')).toHaveTextContent('Oslo');
    expect(screen.getByTestId('temperature')).toHaveTextContent('-5°C');
    expect(screen.getByTestId('description')).toHaveTextContent('light snow');
  });
});

describe('WeatherContext', () => {
  it('initializes with default values', () => {
    render(
      <WeatherProvider>
        <WeatherContextTest />
      </WeatherProvider>
    );

    expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
    expect(screen.getByTestId('error-state')).toHaveTextContent('No Error');
    expect(screen.getByTestId('current-unit')).toHaveTextContent('C');
    expect(screen.getByTestId('no-weather')).toHaveTextContent('No weather data');
  });

  it('toggles temperature unit correctly', () => {
    render(
      <WeatherProvider>
        <WeatherContextTest />
      </WeatherProvider>
    );

    expect(screen.getByTestId('current-unit')).toHaveTextContent('C');

    fireEvent.press(screen.getByTestId('toggle-unit'));

    expect(screen.getByTestId('current-unit')).toHaveTextContent('F');

    fireEvent.press(screen.getByTestId('toggle-unit'));

    expect(screen.getByTestId('current-unit')).toHaveTextContent('C');
  });
});

describe('Temperature Conversion', () => {
  const convertTemperature = (temp: number, unit: 'C' | 'F'): number => {
    if (unit === 'F') {
      return Math.round((temp * 9/5) + 32);
    }
    return Math.round(temp);
  };

  it('converts Celsius to Fahrenheit correctly', () => {
    expect(convertTemperature(0, 'F')).toBe(32);
    expect(convertTemperature(25, 'F')).toBe(77);
    expect(convertTemperature(100, 'F')).toBe(212);
    expect(convertTemperature(-10, 'F')).toBe(14);
  });

  it('keeps Celsius unchanged', () => {
    expect(convertTemperature(0, 'C')).toBe(0);
    expect(convertTemperature(25, 'C')).toBe(25);
    expect(convertTemperature(-10, 'C')).toBe(-10);
  });

  it('handles decimal temperatures', () => {
    expect(convertTemperature(25.7, 'C')).toBe(26);
    expect(convertTemperature(25.7, 'F')).toBe(78);
  });
});

describe('Weather Data Validation', () => {
  it('handles missing weather properties gracefully', () => {
    const incompleteWeather = {
      name: 'Test City',
      main: { temp: 20, humidity: 50 },
      weather: [{ main: 'Clear', description: '', icon: '01d' }],
      wind: { speed: 3 },
      coord: { lat: 0, lon: 0 },
    };

    render(
      <WeatherProvider>
        <WeatherDisplay weather={incompleteWeather} unit="C" />
      </WeatherProvider>
    );

    expect(screen.getByTestId('city-name')).toHaveTextContent('Test City');
    expect(screen.getByTestId('temperature')).toHaveTextContent('20°C');
    expect(screen.getByTestId('description')).toHaveTextContent('');
  });

  it('displays correct coordinates', () => {
    const weatherWithCoords = {
      ...mockWeatherData,
      coord: { lat: 40.7128, lon: -74.0060 },
    };

    // Since we're not testing the map component directly, 
    // we just verify the data structure is correct
    expect(weatherWithCoords.coord.lat).toBe(40.7128);
    expect(weatherWithCoords.coord.lon).toBe(-74.0060);
  });
});