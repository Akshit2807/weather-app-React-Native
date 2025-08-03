import axios, { AxiosResponse } from 'axios';

export interface WeatherData {
  name: string;
  main: {
    temp: number;
    humidity: number;
    pressure: number;
    feels_like: number;
  };
  weather: Array<{
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
  };
  coord: {
    lat: number;
    lon: number;
  };
  visibility: number;
  sys: {
    country: string;
  };
}

export interface GeocodingData {
  name: string;
  local_names?: { [key: string]: string };
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const GEOCODING_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;

if (!API_KEY) {
  throw new Error('Missing environment variable: EXPO_PUBLIC_WEATHER_API_KEY');
}

// Simple cache to reduce API calls
const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const getCacheKey = (lat: number, lon: number): string => {
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
};

export const fetchWeatherData = async (city: string): Promise<WeatherData> => {
  try {
    const response: AxiosResponse<WeatherData> = await axios.get(BASE_URL, {
      params: {
        q: city,
        appid: API_KEY,
        units: 'metric',
      },
      timeout: 10000, // 10 seconds timeout
    });

    // Cache the result
    const cacheKey = getCacheKey(response.data.coord.lat, response.data.coord.lon);
    weatherCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });

    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection and try again.');
    } else if (error.response?.status === 404) {
      throw new Error(`City "${city}" not found. Please check the spelling and try again.`);
    } else if (error.response?.status === 401) {
      throw new Error('Weather service unavailable. Please try again later.');
    } else if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to fetch weather data. Please try again later.');
    }
  }
};

export const fetchWeatherByCoordinates = async (lat: number, lon: number): Promise<WeatherData> => {
  const cacheKey = getCacheKey(lat, lon);
  const cached = weatherCache.get(cacheKey);
  
  // Return cached data if valid
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  try {
    const response: AxiosResponse<WeatherData> = await axios.get(BASE_URL, {
      params: {
        lat: lat,
        lon: lon,
        appid: API_KEY,
        units: 'metric',
      },
      timeout: 10000, // 10 seconds timeout
    });

    // Cache the result
    weatherCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now(),
    });

    return response.data;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timeout. Please check your internet connection and try again.');
    } else if (error.response?.status === 401) {
      throw new Error('Weather service unavailable. Please try again later.');
    } else if (error.response?.status === 429) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to fetch weather data for your location. Please try again later.');
    }
  }
};

export const searchCities = async (query: string, limit: number = 5): Promise<GeocodingData[]> => {
  if (query.length < 2) return [];

  try {
    const response: AxiosResponse<GeocodingData[]> = await axios.get(GEOCODING_URL, {
      params: {
        q: query,
        limit: limit,
        appid: API_KEY,
      },
      timeout: 8000, // 8 seconds timeout for search
    });

    return response.data;
  } catch (error: any) {
    console.error('City search error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Search timeout. Please try again.');
    } else if (error.response?.status === 429) {
      throw new Error('Too many search requests. Please wait a moment.');
    } else {
      // Don't throw for search errors, just return empty array
      return [];
    }
  }
};

// Utility function to clear old cache entries
export const clearOldCache = (): void => {
  const now = Date.now();
  for (const [key, value] of weatherCache.entries()) {
    if (!isCacheValid(value.timestamp)) {
      weatherCache.delete(key);
    }
  }
};

// Clear cache every 10 minutes
setInterval(clearOldCache, 10 * 60 * 1000);