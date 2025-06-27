import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tag, InsertTag, Stats } from "@shared/schema";

export function useTagOperations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: stats } = useQuery<Stats>({
    queryKey: ['/api/stats'],
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: InsertTag) => {
      const response = await apiRequest('POST', '/api/tags', tagData);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate specific query types one by one to prevent race conditions
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      toast({
        title: "Tag created successfully",
        description: "The tag has been saved as an ORCS file",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Tag> }) => {
      const response = await apiRequest('PUT', `/api/tags/${id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate specific query types one by one to prevent race conditions
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      toast({
        title: "Tag updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/tags/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate specific query types one by one to prevent race conditions
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      queryClient.invalidateQueries({ queryKey: ['/api/graph'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      
      toast({
        title: "Tag deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete tag",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    stats,
    createTag: createTagMutation.mutate,
    isCreating: createTagMutation.isPending,
    updateTag: (id: string, updates: Partial<Tag>) => updateTagMutation.mutate({ id, updates }),
    isUpdating: updateTagMutation.isPending,
    deleteTag: deleteTagMutation.mutate,
    isDeleting: deleteTagMutation.isPending,
  };
}
