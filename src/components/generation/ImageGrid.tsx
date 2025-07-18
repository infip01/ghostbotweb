import React from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../lib/api';
import { cn } from '../../lib/utils';

export const ImageGrid: React.FC = () => {
  const { 
    isGenerating, 
    generatedImages, 
    seedsUsed, 
    error, 
    numImages,
    setEnlargedImage 
  } = useAppStore();

  const gridCols = numImages === 1 ? 1 : numImages === 2 ? 2 : 2;
  const maxSlots = numImages === 1 ? 1 : numImages === 2 ? 2 : 4;

  const handleImageClick = (imageUrl: string) => {
    setEnlargedImage(imageUrl);
  };

  const handleDownload = (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(apiClient.downloadImage(imageUrl), '_blank');
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-xl border border-gray-200">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Generation Failed</h3>
            <p className="text-sm text-gray-600 max-w-md">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'grid gap-4 h-fit',
        gridCols === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
      )}
    >
      <AnimatePresence mode="wait">
        {/* Loading State */}
        {isGenerating && (
          <>
            {Array.from({ length: numImages }).map((_, index) => (
              <motion.div
                key={`loading-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="aspect-square bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center"
              >
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-primary-600 animate-spin mx-auto" />
                  <p className="text-sm text-gray-600">Generating...</p>
                </div>
              </motion.div>
            ))}
          </>
        )}

        {/* Generated Images */}
        {!isGenerating && generatedImages.length > 0 && (
          <>
            {generatedImages.map((imageUrl, index) => (
              <motion.div
                key={`image-${index}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative aspect-square bg-gray-100 rounded-xl border border-gray-200 overflow-hidden cursor-pointer"
                onClick={() => handleImageClick(imageUrl)}
              >
                <img
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex items-center justify-between text-white">
                      <span className="text-xs">
                        Seed: {seedsUsed[index] || 'N/A'}
                      </span>
                      <button
                        onClick={(e) => handleDownload(imageUrl, e)}
                        className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </>
        )}

        {/* Empty State */}
        {!isGenerating && generatedImages.length === 0 && !error && (
          <>
            {Array.from({ length: maxSlots }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="aspect-square bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-gray-400 text-lg font-medium">
                      {index + 1}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Ready to generate</p>
                </div>
              </div>
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};