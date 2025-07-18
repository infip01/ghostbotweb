import React from 'react';
import { Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Card } from '../ui/Card';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

interface PromptFormProps {
  onSubmit: () => void;
}

export const PromptForm: React.FC<PromptFormProps> = ({ onSubmit }) => {
  const { prompt, setPrompt, isGenerating } = useAppStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onSubmit();
    }
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to create..."
          rows={3}
          autoResize
          className="min-h-[80px] text-base"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={isGenerating}
            disabled={!prompt.trim() || isGenerating}
            size="lg"
          >
            <Sparkles className="w-5 h-5" />
            {isGenerating ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Card>
  );
};