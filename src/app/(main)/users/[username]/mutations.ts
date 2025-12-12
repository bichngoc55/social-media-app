import { useToast } from "@/components/ui/use-toast";
import { PostsPage } from "@/lib/types";
import { UpdateUserProfileValues } from "@/lib/validation";
import {
  InfiniteData,
  QueryFilters,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "./actions";

async function uploadAvatar(file: File): Promise<string> {
  if (!file) {
    throw new Error("No file selected");
  }
  console.log("Uploading file:", file);
  if (!file.type.startsWith("image/")) {
    throw new Error("Only images are allowed");
  }
  if (file.size > 512 * 1024) {
    throw new Error("File too large. Max 512KB");
  }

  const signedUrlResponse = await fetch("/api/upload/avatar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentType: file.type,
      fileSize: file.size,
    }),
  });

  if (!signedUrlResponse.ok) {
    const error = await signedUrlResponse.json();
    throw new Error(error.error || "Failed to get upload URL");
  }

  const { uploadUrl, fileName } = await signedUrlResponse.json();

  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
  });

  const completeResponse = await fetch("/api/upload/avatar/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
  });

  if (!completeResponse.ok) {
    throw new Error("Failed to complete upload");
  }

  const { avatarUrl } = await completeResponse.json();
  return avatarUrl;
}

export function useUpdateProfileMutation() {
  const { toast } = useToast();

  const router = useRouter();

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      values,
      avatar,
    }: {
      values: UpdateUserProfileValues;
      avatar?: File;
    }) => {
      return Promise.all([
        updateUserProfile(values),
        avatar ? uploadAvatar(avatar) : Promise.resolve(null),
      ]);
    },
    onSuccess: async ([updatedUser, newAvatarUrl]) => {
      const queryFilter: QueryFilters = {
        queryKey: ["post-feed"],
      };

      await queryClient.cancelQueries(queryFilter);

      queryClient.setQueriesData<InfiniteData<PostsPage, string | null>>(
        queryFilter,
        (oldData) => {
          if (!oldData) return;

          return {
            pageParams: oldData.pageParams,
            pages: oldData.pages.map((page) => ({
              nextCursor: page.nextCursor,
              posts: page.posts.map((post) => {
                if (post.user.id === updatedUser.id) {
                  return {
                    ...post,
                    user: {
                      ...updatedUser,
                      avatarUrl: newAvatarUrl || updatedUser.avatarUrl,
                    },
                  };
                }
                return post;
              }),
            })),
          };
        }
      );

      router.refresh();

      toast({
        description: "Profile updated",
      });
    },
    onError(error) {
      console.error(error);
      toast({
        variant: "destructive",
        description: "Failed to update profile. Please try again.",
      });
    },
  });

  return mutation;
}
