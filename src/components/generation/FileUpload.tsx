import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Link, X, Check, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAppStore } from '../../store/useAppStore';
import { apiClient } from '../../lib/api';
import { modelData } from '../../data/models';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn, isValidImageUrl } from '../../lib/utils';

export const FileUpload: React.FC = () => {
  const { 
    model, 
    uploadedFileUrl, 
    uploadedFileName, 
    setUploadedFile 
  } = useAppStore();
  
  const [uploadMethod, setUploadMethod] = React.useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = React.useState('');
  const [isLoadingUrl, setIsLoadingUrl] = React.useState(false);

  const currentModel = modelData[model];
  const supportsUpload = currentModel?.supportsImageUpload;

  const uploadMutation = useMutation({
    mutationFn: apiClient.uploadFile,
    onSuccess: (data) => {
      if (data.success && data.file_url) {
        setUploadedFile(data.file_url, data.filename || 'Uploaded file');
        toast.success('File uploaded successfully!');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Upload failed');
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    if (!isValidImageUrl(urlInput)) {
      const proceed = confirm('This URL might not be a direct image link. Do you want to continue?');
      if (!proceed) return;
    }

    setIsLoadingUrl(true);
    
    try {
      // Test if the URL loads as an image
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = urlInput;
      });

      const filename = urlInput.split('/').pop()?.split('?')[0] || 'Image from URL';
      setUploadedFile(urlInput, filename);
      toast.success('Image loaded successfully!');
    } catch {
      toast.error('Failed to load image from URL. Please check the URL and try again.');
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null, null);
    setUrlInput('');
  };

  if (!supportsUpload) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reference Image (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploadedFileUrl ? (
          <>
            {/* Upload Method Toggle */}
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  uploadMethod === 'file'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('url')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  uploadMethod === 'url'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Link className="w-4 h-4" />
                Paste URL
              </button>
            </div>

            {/* File Upload */}
            {uploadMethod === 'file' && (
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400',
                  uploadMutation.isPending && 'opacity-50 pointer-events-none'
                )}
              >
                <input {...getInputProps()} />
                <div className="space-y-2">
                  {uploadMutation.isPending ? (
                    <Loader2 className="w-8 h-8 mx-auto text-primary-600 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 mx-auto text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {uploadMutation.isPending
                        ? 'Uploading...'
                        : isDragActive
                        ? 'Drop the file here'
                        : 'Click to upload or drag & drop'
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, JPEG, GIF, BMP, WebP (max 10MB)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* URL Input */}
            {uploadMethod === 'url' && (
              <div className="space-y-3">
                <Input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleUrlLoad();
                    }
                  }}
                />
                <Button
                  onClick={handleUrlLoad}
                  loading={isLoadingUrl}
                  disabled={!urlInput.trim()}
                  size="sm"
                  className="w-full"
                >
                  <Check className="w-4 h-4" />
                  Load Image
                </Button>
              </div>
            )}
          </>
        ) : (
          /* File Preview */
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <img
                src={uploadedFileUrl}
                alt="Preview"
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {uploadedFileName}
                </p>
                <p className="text-xs text-gray-500">Reference image loaded</p>
              </div>
              <Button
                onClick={handleRemoveFile}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};