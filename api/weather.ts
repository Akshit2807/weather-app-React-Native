import axios from 'axios';

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
}

const API_KEY = 'dd3eed2b572cd5929a9f50b77007248d';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export const fetchWeatherData = async (city: string): Promise<WeatherData> => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        q: city,
        appid: API_KEY,
        units: 'metric',
      },
    });
    // Todo at last before sumittting 
    // === Weather data fetched for city ===
    // City: ${city}
    // Response data:
    console.log('\n=== Weather data fetched for city:', city, '===');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('=== End of weather data ===\n');
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error(`City "${city}" not found. Please check the spelling and try again.`);
    } else if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to fetch weather data. Please try again later.');
    }
  }
};

export const fetchWeatherByCoordinates = async (lat: number, lon: number): Promise<WeatherData> => {
  try {
    const response = await axios.get(BASE_URL, {
      params: {
        lat: lat,
        lon: lon,
        appid: API_KEY,
        units: 'metric',
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Invalid API key. Please check your OpenWeatherMap API key.');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to fetch weather data for your location. Please try again later.');
    }
  }
};