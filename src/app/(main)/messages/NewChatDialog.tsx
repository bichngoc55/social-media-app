import LoadingButton from "@/components/LoadingButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import UserAvatar from "@/components/UserAvatar";
import useDebounce from "@/hooks/useDebounce";
import kyInstance from "@/lib/ky";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, SearchIcon, X } from "lucide-react";
import { useState, useMemo } from "react";
import { UserResponse } from "stream-chat";
import { DefaultStreamChatGenerics, useChatContext } from "stream-chat-react";
import { useSession } from "../SessionProvider";

interface NewChatDialogProps {
  onOpenChange: (open: boolean) => void;
  onChatCreated: () => void;
}

export default function NewChatDialog({
  onOpenChange,
  onChatCreated,
}: NewChatDialogProps) {
  const { client, setActiveChannel } = useChatContext();

  const { toast } = useToast();

  const { user: loggedInUser } = useSession();

  const [searchInput, setSearchInput] = useState("");
  const searchInputDebounced = useDebounce(searchInput);

  const [selectedUsers, setSelectedUsers] = useState<
    UserResponse<DefaultStreamChatGenerics>[]
  >([]);

  // Search mutual follow users from database
  const { data, isFetching, isError, isSuccess } = useQuery({
    queryKey: ["mutual-follow-users", searchInputDebounced],
    queryFn: async () => {
      if (!searchInputDebounced || searchInputDebounced.trim().length < 2) {
        return { users: [] };
      }
      const response = await kyInstance.get(
        `/api/users/mutual-follows/search?q=${encodeURIComponent(searchInputDebounced)}`
      );
      return (await response.json()) as {
        users: Array<{
          id: string;
          username: string;
          displayName: string;
          avatarUrl: string | null;
        }>;
      };
    },
    enabled: !!searchInputDebounced && searchInputDebounced.trim().length >= 2,
  });

  // Convert database users to Stream Chat format
  const streamUsers = useMemo(() => {
    if (!data?.users) return [];
    return data.users.map((user) => ({
      id: user.id,
      name: user.displayName,
      username: user.username,
      image: user.avatarUrl || undefined,
    })) as UserResponse<DefaultStreamChatGenerics>[];
  }, [data?.users]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Validate mutual follow before creating channel
      for (const selectedUser of selectedUsers) {
        const response = await kyInstance.get(
          `/api/users/${selectedUser.id}/mutual-follow`
        );
        const mutualFollowData = (await response.json()) as {
          isMutualFollow: boolean;
        };

        if (!mutualFollowData.isMutualFollow) {
          throw new Error(
            `Bạn và ${selectedUser.name} cần follow lẫn nhau để nhắn tin`
          );
        }
      }

      // Ensure all users are in Stream Chat before creating channel
      const allUserIds = [loggedInUser.id, ...selectedUsers.map((u) => u.id)];
      await Promise.all(
        allUserIds.map((userId) => {
          if (userId === loggedInUser.id) {
            return kyInstance
              .post("/api/stream/upsert-user", {
                json: {
                  userId: loggedInUser.id,
                  username: loggedInUser.username,
                  name: loggedInUser.displayName,
                  image: loggedInUser.avatarUrl || undefined,
                },
              })
              .catch((err) => {
                console.error(`Failed to upsert user ${userId}:`, err);
              });
          }

          const selectedUser = selectedUsers.find((u) => u.id === userId);
          if (!selectedUser) return Promise.resolve();

          return kyInstance
            .post("/api/stream/upsert-user", {
              json: {
                userId: selectedUser.id,
                username: selectedUser.username || selectedUser.id,
                name: selectedUser.name || selectedUser.id,
                image: selectedUser.image || undefined,
              },
            })
            .catch((err) => {
              console.error(`Failed to upsert user ${userId}:`, err);
            });
        })
      );

      const channel = client.channel("messaging", {
        members: allUserIds,
        name:
          selectedUsers.length > 1
            ? loggedInUser.displayName +
              ", " +
              selectedUsers.map((u) => u.name).join(", ")
            : undefined,
      });
      await channel.create();
      return channel;
    },
    onSuccess: (channel) => {
      setActiveChannel(channel);
      onChatCreated();
    },
    onError(error) {
      console.error("Error starting chat", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Error starting chat. Please try again.";
      toast({
        variant: "destructive",
        description: errorMessage,
      });
    },
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="bg-card p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>New chat</DialogTitle>
        </DialogHeader>
        <div>
          <div className="group relative">
            <SearchIcon className="absolute left-5 top-1/2 size-5 -translate-y-1/2 transform text-muted-foreground group-focus-within:text-primary" />
            <input
              placeholder="Search users..."
              className="h-12 w-full pe-4 ps-14 focus:outline-none"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {!!selectedUsers.length && (
            <div className="mt-4 flex flex-wrap gap-2 p-2">
              {selectedUsers.map((user) => (
                <SelectedUserTag
                  key={user.id}
                  user={user}
                  onRemove={() => {
                    setSelectedUsers((prev) =>
                      prev.filter((u) => u.id !== user.id)
                    );
                  }}
                />
              ))}
            </div>
          )}
          <hr />
          <div className="h-96 overflow-y-auto">
            {!searchInputDebounced || searchInputDebounced.trim().length < 2 ? (
              <p className="my-3 text-center text-muted-foreground">
                Chỉ có thể nhắn tin với những người đã follow lẫn nhau. Hãy nhập
                ít nhất 2 ký tự để tìm kiếm.
              </p>
            ) : (
              <>
                {isSuccess &&
                  streamUsers.map((user) => (
                    <UserResult
                      key={user.id}
                      user={user}
                      selected={selectedUsers.some((u) => u.id === user.id)}
                      onClick={() => {
                        setSelectedUsers((prev) =>
                          prev.some((u) => u.id === user.id)
                            ? prev.filter((u) => u.id !== user.id)
                            : [...prev, user]
                        );
                      }}
                    />
                  ))}
                {isSuccess && streamUsers.length === 0 && (
                  <p className="my-3 text-center text-muted-foreground">
                    Không tìm thấy user đã follow lẫn nhau. Chỉ có thể nhắn tin
                    với những người đã follow lẫn nhau.
                  </p>
                )}
                {isFetching && (
                  <Loader2 className="mx-auto my-3 animate-spin" />
                )}
                {isError && (
                  <p className="my-3 text-center text-destructive">
                    Có lỗi xảy ra khi tải danh sách users. Vui lòng thử lại.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <DialogFooter className="px-6 pb-6">
          <LoadingButton
            disabled={!selectedUsers.length}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Start chat
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface UserResultProps {
  user: UserResponse<DefaultStreamChatGenerics>;
  selected: boolean;
  onClick: () => void;
}

function UserResult({ user, selected, onClick }: UserResultProps) {
  return (
    <button
      className="flex w-full items-center justify-between px-4 py-2.5 transition-colors hover:bg-muted/50"
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <UserAvatar avatarUrl={user.image} />
        <div className="flex flex-col text-start">
          <p className="font-bold">{user.name}</p>
          <p className="text-muted-foreground">@{user.username}</p>
        </div>
      </div>
      {selected && <Check className="size-5 text-green-500" />}
    </button>
  );
}

interface SelectedUserTagProps {
  user: UserResponse<DefaultStreamChatGenerics>;
  onRemove: () => void;
}

function SelectedUserTag({ user, onRemove }: SelectedUserTagProps) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-2 rounded-full border p-1 hover:bg-muted/50"
    >
      <UserAvatar avatarUrl={user.image} size={24} />
      <p className="font-bold">{user.name}</p>
      <X className="mx-2 size-5 text-muted-foreground" />
    </button>
  );
}
