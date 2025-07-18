// API Types - Exact match with backend contracts
export interface GenerateImageRequest {
  prompt: string;
  num_images: number;
  aspect_ratio: string;
  model: string;
  time_elapsed: number;
  image_url?: string;
}

export interface GenerateImageResponse {
  success: boolean;
  image_urls?: string[];
  seeds_used?: number[];
  error?: string;
}

export interface UploadFileResponse {
  success: boolean;
  file_url?: string;
  filename?: string;
  error?: string;
}

export interface ApiKeyResponse {
  api_key?: string;
  error?: string;
}

export interface TelegramStatusResponse {
  bot_initialized: boolean;
  send_queue_size: number;
  retry_queue_size: number;
  error?: string;
}

export type ModelType = 
  | 'img3' 
  | 'img4' 
  | 'uncen' 
  | 'kontext-max' 
  | 'kontext-pro' 
  | 'flux-1-1-pro' 
  | 'flux-dev' 
  | 'flux-pro' 
  | 'flux-schnell';

export type AspectRatio = 
  | 'IMAGE_ASPECT_RATIO_SQUARE' 
  | 'IMAGE_ASPECT_RATIO_PORTRAIT' 
  | 'IMAGE_ASPECT_RATIO_LANDSCAPE';

export interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  features: string[];
  resolution: string;
  useCases: string[];
  badge: 'stable' | 'latest' | 'special' | 'unrestricted' | 'advanced' | 'professional' | 'development' | 'fast';
  icon: string;
  maxImages: number;
  supportsImageUpload: boolean;
  aspectRatioLocked: boolean;
}