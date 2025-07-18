import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Key, Copy, Check, Shield, Zap, Code, Layers, ImagePlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';

export const ApiPage: React.FC = () => {
  const [apiKey, setApiKey] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  const generateKeyMutation = useMutation({
    mutationFn: apiClient.generateApiKey,
    onSuccess: (data) => {
      if (data.api_key) {
        setApiKey(data.api_key);
        toast.success('API key generated successfully!');
      } else if (data.error) {
        toast.error(data.error);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate API key');
    },
  });

  const handleCopyKey = async () => {
    if (apiKey) {
      try {
        await navigator.clipboard.writeText(apiKey);
        setCopied(true);
        toast.success('API key copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy API key');
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        {/* Generate API Key */}
        <Card>
          <CardHeader>
            <CardTitle>Generate API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate an API key to access our image generation endpoints programmatically.
            </p>
            
            <Button
              onClick={() => generateKeyMutation.mutate()}
              loading={generateKeyMutation.isPending}
              className="w-full"
            >
              <Key className="w-4 h-4" />
              Generate Key
            </Button>

            {apiKey && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Your API Key</h4>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <code className="flex-1 text-xs font-mono break-all">
                    {apiKey}
                  </code>
                  <Button
                    onClick={handleCopyKey}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Store this key securely. It will not be shown again.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Info */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              RESTful API for programmatic image generation with OpenAI-compatible endpoints.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">9</div>
                <div className="text-xs text-gray-500">Available Models</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">2</div>
                <div className="text-xs text-gray-500">API Endpoints</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Secure Authentication</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-600" />
                <span>Fast Response Times</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Code className="w-4 h-4 text-blue-600" />
                <span>OpenAI Compatible</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/models" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <Layers className="w-4 h-4" />
                View Models
              </Button>
            </Link>
            <Link to="/" className="block">
              <Button variant="outline" size="sm" className="w-full justify-start">
                <ImagePlus className="w-4 h-4" />
                Try Web Interface
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-2 space-y-8">
        {/* Authentication */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication</h2>
          <Card>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                API requests are authenticated using Bearer Tokens. You must generate an API key using the button above and include it in the <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">Authorization</code> header of your requests. All API requests must be made over HTTPS.
              </p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg">
                <code className="text-sm">Authorization: Bearer YOUR_API_KEY</code>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Image Generation Endpoint */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Image Generation</h2>
          
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">POST</span>
                <code className="text-sm">https://api.infip.pro/v1/images/generations</code>
              </div>
              <p className="text-sm text-gray-600">Generate Images (OpenAI Compatible)</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Request Body</h3>
                <p className="text-gray-600 mb-4">
                  The request body should be a JSON object containing the following generation parameters:
                </p>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded">model</code> (string): The model to use for generation (e.g., "img3", "img4", "uncen").</li>
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded">prompt</code> (string, required): A text description of the desired image(s). Maximum length of 4000 characters.</li>
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded">n</code> (integer): The number of images to generate. Must be between 1 and 4. Defaults to 1.</li>
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded">size</code> (string): The resolution of the image. Examples: "1024x1024", "1792x1024", "1024x1792".</li>
                  <li><code className="bg-gray-100 px-1 py-0.5 rounded">response_format</code> (string): The format of the response. Use "url" to get a link to the image, or "b64_json" for the base64 encoded image.</li>
                </ul>
                
                <h4 className="font-medium mb-2">Example Request:</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm"><code>{`{
  "model": "img4",
  "n": 1,
  "prompt": "A vibrant oil painting of a futuristic cityscape at sunset",
  "response_format": "url",
  "size": "1792x1024"
}`}</code></pre>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Responses</h3>
                
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">200</span>
                      <span className="font-medium">Successful Response</span>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm"><code>{`{
  "created": 1677652288,
  "data": [
    {
      "url": "https://example.com/path/to/your/generated_image.png"
    }
  ]
}`}</code></pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">422</span>
                      <span className="font-medium">Validation Error</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      This error occurs if the request body is invalid (e.g., a required field is missing).
                    </p>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <pre className="text-sm"><code>{`{
  "detail": [
    {
      "loc": [ "body", "prompt" ],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}`}</code></pre>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Models Endpoint */}
        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">GET</span>
                <code className="text-sm">https://api.infip.pro/v1/models</code>
              </div>
              <p className="text-sm text-gray-600">List Available Models</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                Retrieve a list of all available models that can be used for image generation.
              </p>
              
              <div>
                <h4 className="font-medium mb-2">Example Request:</h4>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg">
                  <pre className="text-sm"><code>{`GET https://api.infip.pro/v1/models
Authorization: Bearer YOUR_API_KEY`}</code></pre>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">200</span>
                  <span className="font-medium">Successful Response</span>
                </div>
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <pre className="text-sm"><code>{`{
  "object": "list",
  "data": [
    {
      "id": "img3",
      "object": "model",
      "created": 1677652288,
      "owned_by": "infip"
    },
    {
      "id": "img4",
      "object": "model",
      "created": 1677652288,
      "owned_by": "infip"
    },
    {
      "id": "uncen",
      "object": "model",
      "created": 1677652288,
      "owned_by": "infip"
    }
  ]
}`}</code></pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};