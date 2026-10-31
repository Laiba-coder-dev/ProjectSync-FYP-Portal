import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { FileText, Download, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { getTemplates } from '@/lib/services/templateService';
import type { DocumentTemplate } from '@/types';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CATEGORIES = ['All', 'Proposal', 'SRS', 'SDS', 'Final Report', 'Presentation'];

export default function Templates() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await getTemplates(selectedCategory);
      setTemplates(data);
    } catch (error) {
      toast.error('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTemplates = templates.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Template Documents" 
        description="Browse and download official university templates for your project phases." 
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(category => (
            <Badge 
              key={category} 
              variant={selectedCategory === category ? 'default' : 'outline'}
              className="cursor-pointer px-3 py-1 text-sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-20" />
            <p>No templates found matching your criteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="flex flex-col hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <FileText className="h-6 w-6" />
                  </div>
                  <Badge variant="secondary">{template.category}</Badge>
                </div>
                <CardTitle className="text-lg mt-4 line-clamp-1" title={template.title}>{template.title}</CardTitle>
                <CardDescription className="line-clamp-2" title={template.description}>
                  {template.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto pt-4 border-t flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">
                    {template.fileType.split('.').pop()?.toUpperCase() || 'FILE'} • {formatFileSize(template.fileSize)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Added {format(template.createdAt, 'MMM d, yyyy')}
                  </span>
                </div>
                <Button size="sm" onClick={() => handleDownload(template.fileUrl, template.fileName)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
