import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Image, 
  Sparkles, 
  Unlock, 
  Zap, 
  Crown, 
  Rocket, 
  Code, 
  Gem, 
  Wind,
  ArrowRight 
} from 'lucide-react';
import { getAllModels } from '../data/models';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { cn } from '../lib/utils';

const iconMap = {
  Image,
  Sparkles,
  Unlock,
  Zap,
  Crown,
  Rocket,
  Code,
  Gem,
  Wind,
};

export const ModelsPage: React.FC = () => {
  const models = getAllModels();

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case 'latest':
        return 'bg-green-100 text-green-800';
      case 'stable':
        return 'bg-blue-100 text-blue-800';
      case 'unrestricted':
        return 'bg-red-100 text-red-800';
      case 'advanced':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-indigo-100 text-indigo-800';
      case 'development':
        return 'bg-yellow-100 text-yellow-800';
      case 'fast':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">AI Models</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Explore our collection of cutting-edge AI models, each designed for specific use cases and creative needs.
        </p>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((model) => {
          const IconComponent = iconMap[model.icon as keyof typeof iconMap] || Image;
          
          return (
            <Card key={model.id} className="group hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <IconComponent className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{model.name}</h3>
                      <span className={cn(
                        'inline-block px-2 py-1 text-xs font-medium rounded-full capitalize',
                        getBadgeColor(model.badge)
                      )}>
                        {model.badge}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 line-clamp-3">
                  {model.description}
                </p>

                {/* Features */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Key Features</h4>
                  <div className="space-y-1">
                    {model.features.slice(0, 3).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-1.5 h-1.5 bg-primary-600 rounded-full" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Specs */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Resolution:</span>
                    <span className="text-gray-900 font-medium">{model.resolution}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Max Images:</span>
                    <span className="text-gray-900 font-medium">{model.maxImages}</span>
                  </div>
                  {model.supportsImageUpload && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Image Upload:</span>
                      <span className="text-green-600 font-medium">Supported</span>
                    </div>
                  )}
                </div>

                {/* Action */}
                <Link to={`/?model=${model.id}`}>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full group-hover:bg-primary-600 group-hover:text-white group-hover:border-primary-600 transition-colors"
                  >
                    Try {model.name}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CTA Section */}
      <div className="text-center space-y-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900">Ready to Create?</h2>
        <p className="text-gray-600">
          Start generating amazing images with our powerful AI models.
        </p>
        <Link to="/">
          <Button size="lg">
            <Sparkles className="w-5 h-5" />
            Start Creating
          </Button>
        </Link>
      </div>
    </div>
  );
};