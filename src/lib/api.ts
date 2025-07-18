import axios from 'axios';
import type { 
  GenerateImageRequest, 
  GenerateImageResponse, 
  UploadFileResponse, 
  ApiKeyResponse,
  TelegramStatusResponse 
} from '../types/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/',
  timeout: 600000, // 10 minutes for image generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiClient = {
  // Generate images
  generateImages: async (data: GenerateImageRequest): Promise<GenerateImageResponse> => {
    const response = await api.post<GenerateImageResponse>('/api/generate', data);
    return response.data;
  },

  // Upload file
  uploadFile: async (file: File): Promise<UploadFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<UploadFileResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Generate API key
  generateApiKey: async (): Promise<ApiKeyResponse> => {
    const response = await api.get<ApiKeyResponse>('/api/generate-key');
    return response.data;
  },

  // Get Telegram status
  getTelegramStatus: async (): Promise<TelegramStatusResponse> => {
    const response = await api.get<TelegramStatusResponse>('/api/telegram-status');
    return response.data;
  },

  // Download image
  downloadImage: (imageUrl: string): string => {
    return `/download/${encodeURIComponent(imageUrl)}`;
  },
};