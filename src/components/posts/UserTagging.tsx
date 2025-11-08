"use client";

import { useState, useRef, useEffect } from "react";
import { UserDataLightweight } from "@/lib/types";
import { X, UserPlus, Check, X as XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import kyInstance from "@/lib/ky";
import { useToast } from "../ui/use-toast";

interface UserTaggingProps {
  postId: string;
  onTaggedUsers: (users: UserDataLightweight[]) => void;
  className?: string;
}

export default function UserTagging({
  postId,
  onTaggedUsers,
  className,
}: UserTaggingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserDataLightweight[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<UserDataLightweight[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isTagging, setIsTagging] = useState(false);

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
        const response = await kyInstance.get(
          `/api/search/users?q=${encodeURIComponent(searchQuery)}`
        );
        const data = (await response.json()) as {
          users: UserDataLightweight[];
        };
        setSearchResults(data.users || []);
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery]);

  const handleUserSelect = (user: UserDataLightweight) => {
    if (!taggedUsers.find((u) => u.id === user.id)) {
      setTaggedUsers([...taggedUsers, user]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setTaggedUsers(taggedUsers.filter((u) => u.id !== userId));
  };

  const handleTagUsers = async () => {
    if (taggedUsers.length === 0) return;

    setIsTagging(true);
    try {
      const response = await kyInstance.post(`/api/posts/${postId}/tag`, {
        json: { userIds: taggedUsers.map((u) => u.id) },
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (data.success) {
        toast({
          description: `Tagged ${taggedUsers.length} user(s)`,
        });
        onTaggedUsers(taggedUsers);
        setTaggedUsers([]);
        setIsOpen(false);
      } else {
        throw new Error(data.error || "Failed to tag users");
      }
    } catch (error) {
      console.error("Error tagging users:", error);
      toast({
        variant: "destructive",
        description: "Failed to tag users. Please try again.",
      });
    } finally {
      setIsTagging(false);
    }
  };

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Tag Users
      </Button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background p-4 shadow-lg">
          <div className="space-y-3">
            {/* Search input */}
            <div>
              <Input
                placeholder="Search users to tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                      <XIcon
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => handleRemoveUser(user.id)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTagUsers}
                disabled={taggedUsers.length === 0 || isTagging}
              >
                {isTagging ? "Tagging..." : `Tag ${taggedUsers.length} user(s)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
