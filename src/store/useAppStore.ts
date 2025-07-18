import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ModelType, AspectRatio } from '../types/api';

interface GenerationState {
  isGenerating: boolean;
  generatedImages: string[];
  seedsUsed: number[];
  error: string | null;
}

interface FormState {
  prompt: string;
  numImages: number;
  aspectRatio: AspectRatio;
  model: ModelType;
  uploadedFileUrl: string | null;
  uploadedFileName: string | null;
}

interface UIState {
  isMobileMenuOpen: boolean;
  enlargedImageUrl: string | null;
  pageLoadTime: number;
}

interface AppState extends GenerationState, FormState, UIState {
  // Actions
  setPrompt: (prompt: string) => void;
  setNumImages: (numImages: number) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  setModel: (model: ModelType) => void;
  setUploadedFile: (url: string | null, filename: string | null) => void;
  setGenerating: (isGenerating: boolean) => void;
  setGeneratedImages: (images: string[], seeds: number[]) => void;
  setError: (error: string | null) => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  setEnlargedImage: (url: string | null) => void;
  resetForm: () => void;
  resetGeneration: () => void;
}

const initialFormState: FormState = {
  prompt: '',
  numImages: 4,
  aspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
  model: 'img4',
  uploadedFileUrl: null,
  uploadedFileName: null,
};

const initialGenerationState: GenerationState = {
  isGenerating: false,
  generatedImages: [],
  seedsUsed: [],
  error: null,
};

const initialUIState: UIState = {
  isMobileMenuOpen: false,
  enlargedImageUrl: null,
  pageLoadTime: Date.now(),
};

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      ...initialFormState,
      ...initialGenerationState,
      ...initialUIState,

      setPrompt: (prompt) => set({ prompt }),
      setNumImages: (numImages) => set({ numImages }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),
      setModel: (model) => {
        const state = get();
        const updates: Partial<FormState> = { model };
        
        // Auto-adjust settings based on model
        if (model === 'uncen' || model === 'flux-1-1-pro' || model === 'flux-pro') {
          updates.numImages = 1;
        }
        
        // Lock aspect ratio for certain models
        if (['kontext-max', 'kontext-pro', 'flux-1-1-pro', 'flux-dev', 'flux-pro', 'flux-schnell'].includes(model)) {
          updates.aspectRatio = 'IMAGE_ASPECT_RATIO_SQUARE';
        }
        
        // Clear uploaded file for non-supporting models
        if (!['kontext-max', 'kontext-pro'].includes(model)) {
          updates.uploadedFileUrl = null;
          updates.uploadedFileName = null;
        }
        
        set(updates);
      },
      setUploadedFile: (url, filename) => set({ uploadedFileUrl: url, uploadedFileName: filename }),
      setGenerating: (isGenerating) => set({ isGenerating }),
      setGeneratedImages: (images, seeds) => set({ 
        generatedImages: images, 
        seedsUsed: seeds,
        error: null 
      }),
      setError: (error) => set({ error, generatedImages: [], seedsUsed: [] }),
      setMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen }),
      setEnlargedImage: (enlargedImageUrl) => set({ enlargedImageUrl }),
      resetForm: () => set(initialFormState),
      resetGeneration: () => set(initialGenerationState),
    }),
    {
      name: 'ghostbot-store',
    }
  )
);