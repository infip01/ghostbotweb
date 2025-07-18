import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { apiClient } from '../lib/api';
import { getTimeElapsed } from '../lib/utils';
import { PromptForm } from '../components/generation/PromptForm';
import { ModelSelector } from '../components/generation/ModelSelector';
import { SettingsPanel } from '../components/generation/SettingsPanel';
import { FileUpload } from '../components/generation/FileUpload';
import { ImageGrid } from '../components/generation/ImageGrid';
import { ImageModal } from '../components/generation/ImageModal';

export const HomePage: React.FC = () => {
  const {
    prompt,
    numImages,
    aspectRatio,
    model,
    uploadedFileUrl,
    pageLoadTime,
    setGenerating,
    setGeneratedImages,
    setError,
  } = useAppStore();

  const generateMutation = useMutation({
    mutationFn: apiClient.generateImages,
    onMutate: () => {
      setGenerating(true);
      setError(null);
    },
    onSuccess: (data) => {
      if (data.success && data.image_urls) {
        setGeneratedImages(data.image_urls, data.seeds_used || []);
        toast.success(`Generated ${data.image_urls.length} image${data.image_urls.length > 1 ? 's' : ''}!`);
      } else {
        setError(data.error || 'Generation failed');
        toast.error(data.error || 'Generation failed');
      }
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error || error.message || 'Generation failed';
      setError(errorMessage);
      toast.error(errorMessage);
    },
    onSettled: () => {
      setGenerating(false);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    const timeElapsed = getTimeElapsed(pageLoadTime);
    
    generateMutation.mutate({
      prompt: prompt.trim(),
      num_images: numImages,
      aspect_ratio: aspectRatio,
      model,
      time_elapsed: timeElapsed,
      image_url: uploadedFileUrl || undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <PromptForm onSubmit={handleGenerate} />
        <FileUpload />
        <ModelSelector />
        <SettingsPanel />
      </div>

      {/* Main Content */}
      <div className="lg:col-span-2">
        <ImageGrid />
      </div>

      {/* Image Modal */}
      <ImageModal />
    </div>
  );
};