import { useQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { UserData } from "@/lib/types";
import UserAvatar from "./UserAvatar";
import { forwardRef } from "react";

interface MentionDropdownProps {
  searchQuery: string;
  onSelectUser: (user: UserData) => void;
  onClose: () => void;
}

const MentionDropdown = forwardRef<HTMLDivElement, MentionDropdownProps>(
  ({ searchQuery, onSelectUser, onClose }, ref) => {
    const { data: users, isLoading } = useQuery({
      queryKey: ["mention-users", searchQuery],
      queryFn: async () => {
        if (!searchQuery.trim()) return [];

        const response = await kyInstance.get("/api/users/mention-search", {
          searchParams: { q: searchQuery.trim() },
        });
        return response.json<UserData[]>();
      },
      enabled: searchQuery.length > 0,
    });

    if (!searchQuery || isLoading) return null;

    if (!users || users.length === 0) {
      return (
        <div
          ref={ref}
          className="absolute z-50 mt-1 w-64 rounded-md border bg-popover p-2 shadow-md"
        >
          <p className="text-sm text-muted-foreground">No users found</p>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="absolute z-50 mt-1 max-h-48 w-64 overflow-y-auto rounded-md border bg-popover shadow-md"
      >
        {users.map((user) => (
          <button
            key={user.id}
            className="flex w-full items-center gap-2 rounded-sm p-2 hover:bg-muted"
            onClick={() => {
              onSelectUser(user);
              onClose();
            }}
          >
            <UserAvatar avatarUrl={user.avatarUrl} size={32} />
            <div className="text-left">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionDropdown.displayName = "MentionDropdown";

export default MentionDropdown;
