"use client";

import { useState, useRef, useEffect } from "react";
import { UserDataLightweight } from "@/lib/types";
import { X, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import kyInstance from "@/lib/ky";
import { useToast } from "@/components/ui/use-toast";

interface UserTaggingEditorProps {
  taggedUsers: UserDataLightweight[];
  onTaggedUsersChange: (users: UserDataLightweight[]) => void;
  className?: string;
}

export default function UserTaggingEditor({
  taggedUsers,
  onTaggedUsersChange,
  className,
}: UserTaggingEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserDataLightweight[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  // Search users
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Chỉ tìm trong những user đã follow (dùng cho tagging)
        const response = await kyInstance.get(
          `/api/search/users?q=${encodeURIComponent(searchQuery)}&onlyFollowing=true`
        );
        const data = (await response.json()) as {
          users: UserDataLightweight[];
        };
        // Filter out already tagged users
        const filtered = (data.users || []).filter(
          (user) => !taggedUsers.find((u) => u.id === user.id)
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery, taggedUsers]);

  const handleUserSelect = (user: UserDataLightweight) => {
    if (!taggedUsers.find((u) => u.id === user.id)) {
      onTaggedUsersChange([...taggedUsers, user]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    onTaggedUsersChange(taggedUsers.filter((u) => u.id !== userId));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Tag Users
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          {/* Search input */}
          <div>
            <Input
              placeholder="Search users to tag..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              className="w-full"
            />
            {isSearching && (
              <div className="mt-1 text-sm text-muted-foreground">
                Searching...
              </div>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex cursor-pointer items-center justify-between rounded p-2 hover:bg-muted"
                  onClick={() => handleUserSelect(user)}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-medium">
                        {user.displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {user.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        @{user.username}
                      </div>
                    </div>
                  </div>
                  <Check className="h-4 w-4 text-primary" />
                </div>
              ))}
            </div>
          )}

          {/* Tagged users */}
          {taggedUsers.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium">Tagged users:</div>
              <div className="flex flex-wrap gap-2">
                {taggedUsers.map((user) => (
                  <Badge
                    key={user.id}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {user.displayName}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => handleRemoveUser(user.id)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsOpen(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
