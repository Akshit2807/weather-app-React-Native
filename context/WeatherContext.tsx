import React, { createContext, ReactNode, useContext, useState } from 'react';
import { fetchWeatherByCoordinates, fetchWeatherData, WeatherData } from '../api/weather';

interface WeatherContextType {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  unit: 'C' | 'F';
  lastSearchedCity: string | null;
  fetchWeather: (city: string) => Promise<void>;
  fetchWeatherByCoords: (lat: number, lon: number) => Promise<void>;
  setUnit: (unit: 'C' | 'F') => void;
  clearError: () => void;
  retryLastSearch: () => Promise<void>;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

interface WeatherProviderProps {
  children: ReactNode;
}

export const WeatherProvider: React.FC<WeatherProviderProps> = ({ children }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [unit, setUnitState] = useState<'C' | 'F'>('C');
  const [lastSearchedCity, setLastSearchedCity] = useState<string | null>(null);
  const [lastCoords, setLastCoords] = useState<{lat: number, lon: number} | null>(null);

  const fetchWeather = async (city: string): Promise<void> => {
    if (!city.trim()) {
      setError('Please enter a city name');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLastSearchedCity(city);
    setLastCoords(null);

    try {
      const weatherData = await fetchWeatherData(city);
      setWeather(weatherData);
    } catch (err: any) {
      setError(err.message);
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeatherByCoords = async (lat: number, lon: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setLastCoords({ lat, lon });
    setLastSearchedCity(null);

    try {
      const weatherData = await fetchWeatherByCoordinates(lat, lon);
      setWeather(weatherData);
    } catch (err: any) {
      setError(err.message);
      setWeather(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setUnit = (newUnit: 'C' | 'F'): void => {
    setUnitState(newUnit);
  };

  const clearError = (): void => {
    setError(null);
  };

  const retryLastSearch = async (): Promise<void> => {
    if (lastSearchedCity) {
      await fetchWeather(lastSearchedCity);
    } else if (lastCoords) {
      await fetchWeatherByCoords(lastCoords.lat, lastCoords.lon);
    }
  };

  const contextValue: WeatherContextType = {
    weather,
    isLoading,
    error,
    unit,
    lastSearchedCity,
    fetchWeather,
    fetchWeatherByCoords,
    setUnit,
    clearError,
    retryLastSearch,
  };

  return (
    <WeatherContext.Provider value={contextValue}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = (): WeatherContextType => {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error('useWeather must be used within a WeatherProvider');
  }
  return context;
};