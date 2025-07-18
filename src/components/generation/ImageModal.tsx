import React from 'react';
import { Download, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

export const ImageModal: React.FC = () => {
  const { enlargedImageUrl, setEnlargedImage } = useAppStore();

  const handleDownload = () => {
    if (enlargedImageUrl) {
      window.open(apiClient.downloadImage(enlargedImageUrl), '_blank');
    }
  };

  return (
    <Modal
      isOpen={!!enlargedImageUrl}
      onClose={() => setEnlargedImage(null)}
      size="xl"
    >
      {enlargedImageUrl && (
        <div className="space-y-4">
          <div className="relative">
            <img
              src={enlargedImageUrl}
              alt="Enlarged generated image"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Click and drag to pan • Scroll to zoom
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button
                onClick={() => setEnlargedImage(null)}
                variant="outline"
                size="sm"
              >
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};