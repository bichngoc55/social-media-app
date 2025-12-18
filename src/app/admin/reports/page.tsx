"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Search, Check, X, Clock, ArrowLeft, Trash2 } from "lucide-react";
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
} from "@/components/ui/dialog";
import kyInstance from "@/lib/ky";
import { formatRelativeDate, cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Report {
  id: string;
  type: string;
  reason: string;
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  reporter: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  reported: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  post: {
    id: string;
    content: string;
    createdAt: Date;
    attachments: {
      id: string;
      url: string;
      type: string;
    }[];
  } | null;
}

export default function AdminReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", page, statusFilter, typeFilter],
    queryFn: () =>
      kyInstance
        .get("/api/admin/reports", {
          searchParams: {
            page,
            limit: 20,
            ...(statusFilter !== "all" && { status: statusFilter }),
            ...(typeFilter !== "all" && { type: typeFilter }),
          },
        })
        .json<{ reports: Report[]; pagination: any }>(),
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: string; data: any }) => {
      return kyInstance
        .patch(`/api/admin/reports/${reportId}`, { json: data })
        .json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast({ description: "Report updated successfully" });
      setSelectedReport(null);
      setAdminNotes("");
      setIsDialogOpen(false);
    },
  });

  const handleUpdateReport = (status: string, deletePost = false) => {
    if (!selectedReport) return;
    updateReportMutation.mutate({
      reportId: selectedReport.id,
      data: {
        status,
        adminNotes: adminNotes || null,
        deletePost,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
          >
            Pending
          </Badge>
        );
      case "REVIEWED":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
          >
            Reviewed
          </Badge>
        );
      case "RESOLVED":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950/30 dark:text-green-300"
          >
            Resolved
          </Badge>
        );
      case "DISMISSED":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-950/30 dark:text-gray-300"
          >
            Dismissed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { bg: string; text: string; border: string }> = {
      SPAM: {
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        text: "text-yellow-700 dark:text-yellow-300",
        border: "border-yellow-300 dark:border-yellow-700",
      },
      HARASSMENT: {
        bg: "bg-red-50 dark:bg-red-950/30",
        text: "text-red-700 dark:text-red-300",
        border: "border-red-300 dark:border-red-700",
      },
      HATE_SPEECH: {
        bg: "bg-orange-50 dark:bg-orange-950/30",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-300 dark:border-orange-700",
      },
      VIOLENCE: {
        bg: "bg-red-100 dark:bg-red-950/40",
        text: "text-red-800 dark:text-red-200",
        border: "border-red-400 dark:border-red-600",
      },
      NUDITY: {
        bg: "bg-pink-50 dark:bg-pink-950/30",
        text: "text-pink-700 dark:text-pink-300",
        border: "border-pink-300 dark:border-pink-700",
      },
      COPYRIGHT: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-300 dark:border-blue-700",
      },
      IMPERSONATION: {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-300 dark:border-purple-700",
      },
      OTHER: {
        bg: "bg-gray-50 dark:bg-gray-950/30",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-300 dark:border-gray-700",
      },
    };

    const config = typeConfig[type] || typeConfig.OTHER;

    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full font-semibold",
          config.bg,
          config.text,
          config.border
        )}
      >
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Flag className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Quản lý Báo cáo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and manage user reports
            </p>
          </div>
        </div>
      </div>

      <Card className="card-glass">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REVIEWED">Reviewed</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="SPAM">Spam</SelectItem>
                <SelectItem value="HARASSMENT">Harassment</SelectItem>
                <SelectItem value="HATE_SPEECH">Hate Speech</SelectItem>
                <SelectItem value="VIOLENCE">Violence</SelectItem>
                <SelectItem value="NUDITY">Nudity</SelectItem>
                <SelectItem value="COPYRIGHT">Copyright</SelectItem>
                <SelectItem value="IMPERSONATION">Impersonation</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {data?.reports.map((report) => (
              <Card key={report.id} className="card-glass border-2 hover:border-pink-300 transition-colors">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(report.status)}
                        {getTypeBadge(report.type)}
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeDate(report.createdAt)}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm">
                          <span className="font-medium">Reported by:</span>{" "}
                          <Link
                            href={`/users/${report.reporter.username}`}
                            className="hover:underline"
                          >
                            {report.reporter.displayName}
                          </Link>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Reported user:</span>{" "}
                          <Link
                            href={`/users/${report.reported.username}`}
                            className="hover:underline"
                          >
                            {report.reported.displayName}
                          </Link>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Reason:</span>
                        <p className="text-sm">{report.reason}</p>
                      </div>
                      {report.post && (
                        <div>
                          <span className="text-sm font-medium">
                            Related post:
                          </span>
                          <Link href={`/posts/${report.post.id}`}>
                            <p className="line-clamp-2 text-sm text-muted-foreground hover:underline">
                              {report.post.content}
                            </p>
                          </Link>
                        </div>
                      )}
                      {report.adminNotes && (
                        <div>
                          <span className="text-sm font-medium">
                            Admin notes:
                          </span>
                          <p className="text-sm text-muted-foreground">
                            {report.adminNotes}
                          </p>
                        </div>
                      )}
                    </div>
                    <Dialog open={isDialogOpen && selectedReport?.id === report.id} onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) {
                        setSelectedReport(null);
                        setAdminNotes("");
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setAdminNotes(report.adminNotes || "");
                            setIsDialogOpen(true);
                          }}
                        >
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl max-h-[85vh] bg-[rgba(244,231,248,0.95)] backdrop-blur-[20px] border-[rgba(195,199,244,0.4)] shadow-[0_8px_32px_0_rgba(227,170,221,0.25)] flex flex-col">
                        <DialogHeader className="space-y-2 flex-shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                              <Flag className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div>
                              <DialogTitle className="text-2xl font-bold">Review Report</DialogTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                Review and take action on this report
                              </p>
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
                          {selectedReport?.post && (
                            <div className="space-y-4 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-5 dark:border-orange-900 dark:from-orange-950/30 dark:to-red-950/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Flag className="h-5 w-5 text-orange-600" />
                                  <p className="text-base font-semibold text-orange-900 dark:text-orange-200">
                                    Reported Post
                                  </p>
                                </div>
                                <Badge variant="outline" className="border-orange-300 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                  {formatRelativeDate(new Date(selectedReport.post.createdAt))}
                                </Badge>
                              </div>
                              
                              <div className="rounded-lg bg-white/80 p-4 dark:bg-gray-900/50">
                                <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-gray-200">
                                  {selectedReport.post.content}
                                </p>
                              </div>

                              {selectedReport.post.attachments && selectedReport.post.attachments.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                    Attachments ({selectedReport.post.attachments.length}):
                                  </p>
                                  <div className={cn(
                                    "grid gap-3",
                                    selectedReport.post.attachments.length === 1 ? "grid-cols-1 max-w-2xl mx-auto" :
                                    selectedReport.post.attachments.length === 2 ? "grid-cols-2" :
                                    "grid-cols-3"
                                  )}>
                                    {selectedReport.post.attachments.map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className={cn(
                                          "group relative overflow-hidden rounded-lg border-2 border-orange-200 bg-white dark:border-orange-800 dark:bg-gray-900",
                                          selectedReport.post.attachments.length === 1 ? "aspect-auto max-h-[300px]" : "aspect-square max-h-[200px]"
                                        )}
                                      >
                                        {attachment.type === "IMAGE" ? (
                                          <Image
                                            src={attachment.url}
                                            alt="Post attachment"
                                            width={400}
                                            height={400}
                                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                            unoptimized
                                          />
                                        ) : attachment.type === "VIDEO" ? (
                                          <video
                                            src={attachment.url}
                                            controls
                                            className="h-full w-full object-cover"
                                          />
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <Button
                                variant="destructive"
                                onClick={() =>
                                  handleUpdateReport("RESOLVED", true)
                                }
                                disabled={updateReportMutation.isPending || selectedReport?.status === "RESOLVED" || selectedReport?.status === "DISMISSED"}
                                className="w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Post & Resolve
                              </Button>
                            </div>
                          )}

                          <div className="space-y-2">
                            <label className="text-sm font-semibold">
                              Admin Notes
                            </label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes about this report..."
                              rows={3}
                              disabled={selectedReport?.status === "RESOLVED" || selectedReport?.status === "DISMISSED"}
                              className="resize-none border-2 focus:border-pink-400 focus:ring-pink-400/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                          </div>

                          {selectedReport && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">
                                  <Flag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                    Report Details
                                  </p>
                                  <div className="mt-1 space-y-1 text-xs text-blue-800 dark:text-blue-300">
                                    <p><span className="font-medium">Type:</span> {selectedReport.type}</p>
                                    <p><span className="font-medium">Reason:</span> {selectedReport.reason}</p>
                                    <p><span className="font-medium">Reporter:</span> {selectedReport.reporter.displayName} (@{selectedReport.reporter.username})</p>
                                    <p><span className="font-medium">Reported User:</span> {selectedReport.reported.displayName} (@{selectedReport.reported.username})</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 flex-shrink-0 border-t pt-4 mt-4">
                            {selectedReport?.status === "RESOLVED" || selectedReport?.status === "DISMISSED" ? (
                              <div className="w-full rounded-lg border-2 border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
                                <div className="flex items-center gap-2">
                                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  <p className="text-sm font-medium text-green-900 dark:text-green-200">
                                    This report has been {selectedReport.status === "RESOLVED" ? "resolved" : "dismissed"}. No further actions can be taken.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <Button
                                  variant="default"
                                  onClick={() => handleUpdateReport("RESOLVED")}
                                  disabled={updateReportMutation.isPending}
                                  className="flex-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Resolve
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleUpdateReport("DISMISSED")}
                                  disabled={updateReportMutation.isPending}
                                  className="flex-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600"
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Dismiss
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => handleUpdateReport("REVIEWED")}
                                  disabled={updateReportMutation.isPending}
                                  className="flex-1 rounded-full"
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  Mark Reviewed
                                </Button>
                              </>
                            )}
                          </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data?.pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} (
                {data.pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
