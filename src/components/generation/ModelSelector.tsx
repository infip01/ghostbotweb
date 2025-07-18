import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { modelData } from '../../data/models';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';

export const ModelSelector: React.FC = () => {
  const { model, setModel } = useAppStore();

  const modelOptions = Object.values(modelData).map((modelInfo) => ({
    value: modelInfo.id,
    label: modelInfo.name,
  }));

  const currentModel = modelData[model];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={model}
          onChange={(value) => setModel(value as any)}
          options={modelOptions}
        />
        
        {currentModel && (
          <div className="text-sm text-gray-600 space-y-2">
            <p>{currentModel.description}</p>
            <div className="flex flex-wrap gap-1">
              {currentModel.features.slice(0, 2).map((feature, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-100 text-primary-700"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};