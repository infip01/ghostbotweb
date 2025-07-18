import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { modelData } from '../../data/models';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';

export const SettingsPanel: React.FC = () => {
  const { 
    numImages, 
    setNumImages, 
    aspectRatio, 
    setAspectRatio, 
    model 
  } = useAppStore();

  const currentModel = modelData[model];
  const isNumImagesLocked = currentModel?.maxImages === 1;
  const isAspectRatioLocked = currentModel?.aspectRatioLocked;

  const numImagesOptions = [
    { value: '1', label: '1 Image' },
    { value: '2', label: '2 Images' },
    { value: '4', label: '4 Images' },
  ];

  const aspectRatioOptions = [
    { value: 'IMAGE_ASPECT_RATIO_SQUARE', label: 'Square' },
    { value: 'IMAGE_ASPECT_RATIO_PORTRAIT', label: 'Portrait' },
    { value: 'IMAGE_ASPECT_RATIO_LANDSCAPE', label: 'Landscape' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Number of Images */}
        <div>
          {isNumImagesLocked ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Images
              </label>
              <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-md">
                {currentModel?.name} is limited to 1 image.
              </p>
            </div>
          ) : (
            <Select
              label="Number of Images"
              value={numImages.toString()}
              onChange={(value) => setNumImages(parseInt(value))}
              options={numImagesOptions}
            />
          )}
        </div>

        {/* Aspect Ratio */}
        <div>
          {isAspectRatioLocked ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Aspect Ratio
              </label>
              <p className="text-sm text-gray-500 bg-gray-50 p-2 rounded-md">
                {currentModel?.name} only supports Square format.
              </p>
            </div>
          ) : (
            <Select
              label="Aspect Ratio"
              value={aspectRatio}
              onChange={(value) => setAspectRatio(value as any)}
              options={aspectRatioOptions}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
};