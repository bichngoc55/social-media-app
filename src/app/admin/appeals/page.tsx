"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, Check, X, Clock, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import kyInstance from "@/lib/ky";
import { formatRelativeDate, cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Appeal {
  id: string;
  appealReason: string;
  status: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  post: {
    id: string;
    content: string;
    harmful: boolean;
    harmfulTypes: string[];
    createdAt: Date;
    attachments: {
      id: string;
      url: string;
      type: string;
    }[];
  };
}

export default function AdminAppealsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionStatus, setActionStatus] = useState<
    "APPROVED" | "REJECTED" | "UNDER_REVIEW"
  >("UNDER_REVIEW");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-appeals", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      return kyInstance
        .get(`/api/admin/appeals?${params.toString()}`)
        .json<{ appeals: Appeal[]; pagination: any }>();
    },
  });

  const updateAppealMutation = useMutation({
    mutationFn: async ({
      appealId,
      status,
      adminNotes,
    }: {
      appealId: string;
      status: string;
      adminNotes?: string;
    }) => {
      return kyInstance
        .patch(`/api/admin/appeals/${appealId}`, {
          json: { status, adminNotes },
        })
        .json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appeal has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-appeals"] });
      setReviewDialogOpen(false);
      setSelectedAppeal(null);
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description:
          error?.response?.json?.then?.((e: any) => e.error) ||
          "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleReview = (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setAdminNotes(appeal.adminNotes || "");
    setActionStatus("UNDER_REVIEW");
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (!selectedAppeal) return;

    if (actionStatus === "REJECTED" && !adminNotes.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    updateAppealMutation.mutate({
      appealId: selectedAppeal.id,
      status: actionStatus,
      adminNotes: adminNotes.trim() || undefined,
    });
  };

  const getStatusBadge = (status: Appeal["status"]) => {
    const variants: Record<
      Appeal["status"],
      { variant: any; label: string; className?: string }
    > = {
      PENDING: { variant: "secondary", label: "Pending" },
      UNDER_REVIEW: { variant: "default", label: "Under Review" },
      APPROVED: {
        variant: "default",
        label: "Approved",
        className: "bg-green-500",
      },
      REJECTED: { variant: "destructive", label: "Rejected" },
    };
    const config = variants[status];
    return (
      <Badge variant={config.variant} className={cn(config.className)}>
        {config.label}
      </Badge>
    );
  };

  const appeals = data?.appeals || [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Appeals Management</h1>
          <p className="mt-1 text-muted-foreground">
            View and manage user appeals
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select
              value={statusFilter || "ALL"}
              onValueChange={(value) =>
                setStatusFilter(value === "ALL" ? "" : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tất cả trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appeals List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-destructive">
              An error occurred while loading the appeals list
            </p>
          </CardContent>
        </Card>
      ) : appeals.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No appeals found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {appeals.map((appeal) => (
            <Card key={appeal.id} className="card-glass">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    {/* User Info */}
                    <div className="flex items-center gap-3">
                      <Link href={`/users/${appeal.user.username}`}>
                        <div className="relative h-10 w-10 overflow-hidden rounded-full">
                          {appeal.user.avatarUrl ? (
                            <Image
                              src={appeal.user.avatarUrl}
                              alt={appeal.user.displayName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full bg-muted" />
                          )}
                        </div>
                      </Link>
                      <div>
                        <Link
                          href={`/users/${appeal.user.username}`}
                          className="font-semibold hover:underline"
                        >
                          {appeal.user.displayName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          @{appeal.user.username}
                        </p>
                      </div>
                      {getStatusBadge(appeal.status)}
                    </div>

                    {/* Post Content */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-semibold">
                          Post flagged:
                        </span>
                      </div>
                      <p className="text-sm">{appeal.post.content}</p>
                      {appeal.post.harmfulTypes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {appeal.post.harmfulTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="text-xs"
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {appeal.post.attachments.length > 0 && (
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {appeal.post.attachments
                            .slice(0, 4)
                            .map((attachment) => (
                              <div
                                key={attachment.id}
                                className="relative aspect-square overflow-hidden rounded-lg"
                              >
                                {attachment.type === "IMAGE" ? (
                                  <Image
                                    src={attachment.url}
                                    alt="Attachment"
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center bg-muted">
                                    <FileText className="h-6 w-6" />
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Appeal Reason */}
                    <div>
                      <p className="mb-1 text-sm font-semibold">
                        Appeal Reason:
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appeal.appealReason}
                      </p>
                    </div>

                    {/* Admin Notes */}
                    {appeal.adminNotes && (
                      <div>
                        <p className="mb-1 text-sm font-semibold">
                          Admin Notes:
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {appeal.adminNotes}
                        </p>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>
                        Created:{" "}
                        {formatRelativeDate(new Date(appeal.createdAt))}
                      </span>
                      <span>
                        Updated:{" "}
                        {formatRelativeDate(new Date(appeal.updatedAt))}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {appeal.status === "PENDING" && (
                      <Button
                        onClick={() => handleReview(appeal)}
                        variant="default"
                        size="sm"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    )}
                    {appeal.status === "UNDER_REVIEW" && (
                      <Button
                        onClick={() => handleReview(appeal)}
                        variant="default"
                        size="sm"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Process
                      </Button>
                    )}
                    <Link href={`/posts/${appeal.post.id}`}>
                      <Button variant="outline" size="sm">
                        View Post
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Process Appeal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold">Appeal Reason:</p>
              <p className="text-sm text-muted-foreground">
                {selectedAppeal?.appealReason}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">Action:</p>
              <Select
                value={actionStatus}
                onValueChange={(value) =>
                  setActionStatus(
                    value as "APPROVED" | "REJECTED" | "UNDER_REVIEW"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="APPROVED">
                    Approve (Restore Post)
                  </SelectItem>
                  <SelectItem value="REJECTED">Reject</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold">
                Admin Notes {actionStatus === "REJECTED" && "(Required)"}:
              </p>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter notes..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialogOpen(false);
                setSelectedAppeal(null);
                setAdminNotes("");
              }}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={
                updateAppealMutation.isPending ||
                (actionStatus === "REJECTED" && !adminNotes.trim())
              }
            >
              {updateAppealMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
