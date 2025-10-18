"use client";

import { useState, useRef, useEffect } from "react";
import { UserData } from "@/lib/types";
import { X, UserPlus, Check, X as XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import kyInstance from "@/lib/ky";
import { useToast } from "../ui/use-toast";

interface UserTaggingProps {
  postId: string;
  onTaggedUsers: (users: UserData[]) => void;
  className?: string;
}

export default function UserTagging({ postId, onTaggedUsers, className }: UserTaggingProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<UserData[]>([]);
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
        const response = await kyInstance.get(`/api/search/users?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        setSearchResults(data.users || []);
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [searchQuery]);

  const handleUserSelect = (user: UserData) => {
    if (!taggedUsers.find(u => u.id === user.id)) {
      setTaggedUsers([...taggedUsers, user]);
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setTaggedUsers(taggedUsers.filter(u => u.id !== userId));
  };

  const handleTagUsers = async () => {
    if (taggedUsers.length === 0) return;

    setIsTagging(true);
    try {
      const response = await kyInstance.post(`/api/posts/${postId}/tag`, {
        json: { userIds: taggedUsers.map(u => u.id) }
      });
      
      const data = await response.json();
      
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
        <div className="absolute top-full left-0 mt-2 w-80 bg-background border rounded-lg shadow-lg z-50 p-4">
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
                <div className="text-sm text-muted-foreground mt-1">
                  Searching...
                </div>
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {user.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-sm">{user.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
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
                <div className="text-sm font-medium mb-2">Tagged users:</div>
                <div className="flex flex-wrap gap-2">
                  {taggedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
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
