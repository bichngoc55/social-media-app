"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Flag,
  AlertTriangle,
  Check,
  X,
  Clock,
  Shield,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  Trash2,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import kyInstance from "@/lib/ky";
import { formatRelativeDate, cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

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

interface ModerationCase {
  id: string;
  postId: string | null;
  userId: string | null;
  source: "AI" | "USER_REPORT" | "ADMIN_MANUAL";
  policyAreaPredicted: string | null;
  confidence: number | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  modelVersion: string | null;
  harmfulTypes: string[];
  autoAction:
    | "NONE"
    | "BLUR"
    | "REDUCE_DISTRIBUTION"
    | "TEMP_REMOVE"
    | "AUTO_REMOVE";
  autoActionAppliedAt: Date | null;
  status:
    | "DETECTED"
    | "QUEUED"
    | "IN_REVIEW"
    | "CONFIRMED"
    | "RESTORED"
    | "DISMISSED"
    | "APPEALED";
  priorityScore: number;
  assignedTo: string | null;
  slaDueAt: Date | null;
  decision: string | null;
  decisionAt: Date | null;
  decisionBy: string | null;
  policyArea: string | null;
  reasonCode: string | null;
  supervisorApproved: boolean;
  supervisorApprovedBy: string | null;
  supervisorApprovedAt: Date | null;
  evidence: any;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  post: {
    id: string;
    content: string;
    createdAt: Date;
    harmful: boolean;
    harmfulTypes: string[];
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    attachments: {
      id: string;
      url: string;
      type: string;
    }[];
  } | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  assignedAdmin: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  decisionAdmin: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  _count: {
    auditTrail: number;
  };
}

export default function AdminPostsPage() {
  const [activeTab, setActiveTab] = useState<"reports" | "ai-flags">("reports");
  const [isMigrating, setIsMigrating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleMigrateCases = async () => {
    setIsMigrating(true);
    try {
      const response = await kyInstance
        .post("/api/admin/moderation/migrate-cases")
        .json<{
          message: string;
          total: number;
          success: number;
          failed: number;
          errors?: string[];
        }>();

      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });

      toast({
        title: "Migration completed",
        description: `Successfully migrated ${response.success} cases. ${response.failed} failed.`,
      });
    } catch (error) {
      toast({
        title: "Migration failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Shield className="h-6 w-6 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent">
              Posts Report Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review and manage content moderation
            </p>
          </div>
        </div>
        {/* {activeTab === "ai-flags" && (
          <Button
            variant="outline"
            onClick={handleMigrateCases}
            disabled={isMigrating}
            className="rounded-full"
          >
            {isMigrating ? "Migrating..." : "Migrate Existing Posts"}
          </Button>
        )} */}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as any)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <Flag className="h-4 w-4" />
            User Reports
          </TabsTrigger>
          <TabsTrigger value="ai-flags" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            AI Flags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>

        <TabsContent value="ai-flags">
          <AIFlagsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Reports Tab Component
function ReportsTab() {
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
    const typeConfig: Record<
      string,
      { bg: string; text: string; border: string }
    > = {
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
    <>
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
              <Card
                key={report.id}
                className="card-glass border-2 transition-colors hover:border-pink-300"
              >
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
                    <Dialog
                      open={isDialogOpen && selectedReport?.id === report.id}
                      onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                          setSelectedReport(null);
                          setAdminNotes("");
                        }
                      }}
                    >
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
                      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col border-[rgba(195,199,244,0.4)] bg-[rgba(244,231,248,0.95)] shadow-[0_8px_32px_0_rgba(227,170,221,0.25)] backdrop-blur-[20px]">
                        <DialogHeader className="flex-shrink-0 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                              <Flag className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div>
                              <DialogTitle className="text-2xl font-bold">
                                Review Report
                              </DialogTitle>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Review and take action on this report
                              </p>
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4">
                          {selectedReport?.post && (
                            <div className="space-y-4 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-5 dark:border-orange-900 dark:from-orange-950/30 dark:to-red-950/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Flag className="h-5 w-5 text-orange-600" />
                                  <p className="text-base font-semibold text-orange-900 dark:text-orange-200">
                                    Reported Post
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className="border-orange-300 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                >
                                  {formatRelativeDate(
                                    new Date(selectedReport.post.createdAt)
                                  )}
                                </Badge>
                              </div>

                              <div className="rounded-lg bg-white/80 p-4 dark:bg-gray-900/50">
                                <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-gray-200">
                                  {selectedReport.post.content}
                                </p>
                              </div>

                              {selectedReport.post.attachments &&
                                selectedReport.post.attachments.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                      Attachments (
                                      {selectedReport.post.attachments.length}):
                                    </p>
                                    <div
                                      className={cn(
                                        "grid gap-3",
                                        selectedReport.post.attachments
                                          .length === 1
                                          ? "mx-auto max-w-2xl grid-cols-1"
                                          : selectedReport.post.attachments
                                                .length === 2
                                            ? "grid-cols-2"
                                            : "grid-cols-3"
                                      )}
                                    >
                                      {selectedReport.post.attachments.map(
                                        (attachment) => (
                                          <div
                                            key={attachment.id}
                                            className={cn(
                                              "group relative overflow-hidden rounded-lg border-2 border-orange-200 bg-white dark:border-orange-800 dark:bg-gray-900",
                                              selectedReport.post &&
                                                selectedReport.post.attachments
                                                  .length === 1
                                                ? "aspect-auto max-h-[300px]"
                                                : "aspect-square max-h-[200px]"
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
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              <Button
                                variant="destructive"
                                onClick={() =>
                                  handleUpdateReport("RESOLVED", true)
                                }
                                disabled={
                                  updateReportMutation.isPending ||
                                  selectedReport?.status === "RESOLVED" ||
                                  selectedReport?.status === "DISMISSED"
                                }
                                className="w-full rounded-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
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
                              disabled={
                                selectedReport?.status === "RESOLVED" ||
                                selectedReport?.status === "DISMISSED"
                              }
                              className="resize-none border-2 focus:border-pink-400 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
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
                                    <p>
                                      <span className="font-medium">Type:</span>{" "}
                                      {selectedReport.type}
                                    </p>
                                    <p>
                                      <span className="font-medium">
                                        Reason:
                                      </span>{" "}
                                      {selectedReport.reason}
                                    </p>
                                    <p>
                                      <span className="font-medium">
                                        Reporter:
                                      </span>{" "}
                                      {selectedReport.reporter.displayName} (@
                                      {selectedReport.reporter.username})
                                    </p>
                                    <p>
                                      <span className="font-medium">
                                        Reported User:
                                      </span>{" "}
                                      {selectedReport.reported.displayName} (@
                                      {selectedReport.reported.username})
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-shrink-0 flex-wrap gap-2 border-t pt-4">
                          {selectedReport?.status === "RESOLVED" ||
                          selectedReport?.status === "DISMISSED" ? (
                            <div className="w-full rounded-lg border-2 border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
                              <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                                  This report has been{" "}
                                  {selectedReport.status === "RESOLVED"
                                    ? "resolved"
                                    : "dismissed"}
                                  . No further actions can be taken.
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
    </>
  );
}

// AI Flags Tab Component
function AIFlagsTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [policyAreaFilter, setPolicyAreaFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("priorityScore");
  const [selectedCase, setSelectedCase] = useState<ModerationCase | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [decision, setDecision] = useState<string>("");
  const [policyArea, setPolicyArea] = useState<string>("");
  const [reasonCode, setReasonCode] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin-moderation-cases",
      page,
      statusFilter,
      severityFilter,
      sourceFilter,
      policyAreaFilter,
      sortBy,
    ],
    queryFn: () =>
      kyInstance
        .get("/api/admin/moderation/cases", {
          searchParams: {
            page,
            limit: 20,
            ...(statusFilter !== "all" && { status: statusFilter }),
            ...(severityFilter !== "all" && { severity: severityFilter }),
            ...(sourceFilter !== "all" && { source: sourceFilter }),
            ...(policyAreaFilter !== "all" && { policyArea: policyAreaFilter }),
            sortBy,
          },
        })
        .json<{ cases: ModerationCase[]; pagination: any }>(),
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ caseId, data }: { caseId: string; data: any }) => {
      const response = await kyInstance
        .patch(`/api/admin/moderation/cases/${caseId}`, { json: data })
        .json();
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-moderation-cases"] });
      toast({
        title: "Success",
        description: "Case updated successfully",
      });
      setSelectedCase(null);
      setDecision("");
      setPolicyArea("");
      setReasonCode("");
      setAdminNotes("");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      console.error("Error updating case:", error);
      toast({
        title: "Error",
        description:
          error?.message || "Failed to update case. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateCase = () => {
    if (!selectedCase) return;
    if (decision && !policyArea) {
      toast({
        title: "Policy area required",
        description: "Please select a policy area when making a decision",
        variant: "destructive",
      });
      return;
    }

    const updateData: any = {};
    if (decision) updateData.decision = decision;
    if (policyArea) updateData.policyArea = policyArea;
    if (reasonCode) updateData.reasonCode = reasonCode;
    if (adminNotes) updateData.adminNotes = adminNotes;

    console.log("Submitting case update:", {
      caseId: selectedCase.id,
      data: updateData,
    });

    updateCaseMutation.mutate({
      caseId: selectedCase.id,
      data: updateData,
    });
  };

  const handleAssign = () => {
    if (!selectedCase) return;
    updateCaseMutation.mutate({
      caseId: selectedCase.id,
      data: {
        assignedTo: selectedCase.assignedTo ? null : "current",
      },
    });
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<
      string,
      { bg: string; text: string; border: string; icon: any }
    > = {
      CRITICAL: {
        bg: "bg-red-100 dark:bg-red-950/40",
        text: "text-red-800 dark:text-red-200",
        border: "border-red-400 dark:border-red-600",
        icon: AlertCircle,
      },
      HIGH: {
        bg: "bg-orange-100 dark:bg-orange-950/40",
        text: "text-orange-800 dark:text-orange-200",
        border: "border-orange-400 dark:border-orange-600",
        icon: AlertTriangle,
      },
      MEDIUM: {
        bg: "bg-yellow-100 dark:bg-yellow-950/40",
        text: "text-yellow-800 dark:text-yellow-200",
        border: "border-yellow-400 dark:border-yellow-600",
        icon: Clock,
      },
      LOW: {
        bg: "bg-blue-100 dark:bg-blue-950/40",
        text: "text-blue-800 dark:text-blue-200",
        border: "border-blue-400 dark:border-blue-600",
        icon: MessageSquare,
      },
    };

    const cfg = config[severity] || config.LOW;
    const Icon = cfg.icon;

    return (
      <Badge
        variant="outline"
        className={cn(
          "flex items-center gap-1 rounded-full font-semibold",
          cfg.bg,
          cfg.text,
          cfg.border
        )}
      >
        <Icon className="h-3 w-3" />
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; border: string }> =
      {
        DETECTED: {
          bg: "bg-purple-50 dark:bg-purple-950/30",
          text: "text-purple-700 dark:text-purple-300",
          border: "border-purple-300 dark:border-purple-700",
        },
        QUEUED: {
          bg: "bg-blue-50 dark:bg-blue-950/30",
          text: "text-blue-700 dark:text-blue-300",
          border: "border-blue-300 dark:border-blue-700",
        },
        IN_REVIEW: {
          bg: "bg-amber-50 dark:bg-amber-950/30",
          text: "text-amber-700 dark:text-amber-300",
          border: "border-amber-300 dark:border-amber-700",
        },
        CONFIRMED: {
          bg: "bg-red-50 dark:bg-red-950/30",
          text: "text-red-700 dark:text-red-300",
          border: "border-red-300 dark:border-red-700",
        },
        RESTORED: {
          bg: "bg-green-50 dark:bg-green-950/30",
          text: "text-green-700 dark:text-green-300",
          border: "border-green-300 dark:border-green-700",
        },
        DISMISSED: {
          bg: "bg-gray-50 dark:bg-gray-950/30",
          text: "text-gray-700 dark:text-gray-300",
          border: "border-gray-300 dark:border-gray-700",
        },
      };

    const cfg = config[status] || config.DETECTED;

    return (
      <Badge
        variant="outline"
        className={cn("rounded-full", cfg.bg, cfg.text, cfg.border)}
      >
        {status}
      </Badge>
    );
  };

  const getAutoActionBadge = (action: string) => {
    const config: Record<
      string,
      { bg: string; text: string; border: string; label: string }
    > = {
      AUTO_REMOVE: {
        bg: "bg-red-100 dark:bg-red-950/40",
        text: "text-red-800 dark:text-red-200",
        border: "border-red-400 dark:border-red-600",
        label: "Auto Removed",
      },
      TEMP_REMOVE: {
        bg: "bg-orange-100 dark:bg-orange-950/40",
        text: "text-orange-800 dark:text-orange-200",
        border: "border-orange-400 dark:border-orange-600",
        label: "Temp Removed",
      },
      BLUR: {
        bg: "bg-yellow-100 dark:bg-yellow-950/40",
        text: "text-yellow-800 dark:text-yellow-200",
        border: "border-yellow-400 dark:border-yellow-600",
        label: "Blurred",
      },
      REDUCE_DISTRIBUTION: {
        bg: "bg-blue-100 dark:bg-blue-950/40",
        text: "text-blue-800 dark:text-blue-200",
        border: "border-blue-400 dark:border-blue-600",
        label: "Reduced",
      },
      NONE: {
        bg: "bg-gray-100 dark:bg-gray-950/40",
        text: "text-gray-800 dark:text-gray-200",
        border: "border-gray-400 dark:border-gray-600",
        label: "None",
      },
    };

    const cfg = config[action] || config.NONE;

    return (
      <Badge
        variant="outline"
        className={cn("rounded-full text-xs", cfg.bg, cfg.text, cfg.border)}
      >
        {cfg.label}
      </Badge>
    );
  };

  const getSLABadge = (slaDueAt: Date | null) => {
    if (!slaDueAt) return null;

    const now = new Date();
    const due = new Date(slaDueAt);
    const diff = due.getTime() - now.getTime();
    const hoursRemaining = diff / (1000 * 60 * 60);
    const totalHours =
      (due.getTime() - new Date(selectedCase?.createdAt || now).getTime()) /
      (1000 * 60 * 60);
    const percentage = (hoursRemaining / totalHours) * 100;

    let color = "green";
    if (percentage < 0) color = "red";
    else if (percentage < 25) color = "red";
    else if (percentage < 50) color = "yellow";

    return (
      <Badge
        variant="outline"
        className={cn(
          "rounded-full text-xs",
          color === "red" &&
            "border-red-400 bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
          color === "yellow" &&
            "border-yellow-400 bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
          color === "green" &&
            "border-green-400 bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200"
        )}
      >
        {hoursRemaining < 0
          ? `Overdue ${Math.abs(Math.round(hoursRemaining))}h`
          : `${Math.round(hoursRemaining)}h left`}
      </Badge>
    );
  };

  return (
    <>
      <Card className="card-glass">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="DETECTED">Detected</SelectItem>
                <SelectItem value="QUEUED">Queued</SelectItem>
                <SelectItem value="IN_REVIEW">In Review</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="RESTORED">Restored</SelectItem>
                <SelectItem value="DISMISSED">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="AI">AI</SelectItem>
                <SelectItem value="USER_REPORT">User Report</SelectItem>
                <SelectItem value="ADMIN_MANUAL">Admin Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={policyAreaFilter}
              onValueChange={setPolicyAreaFilter}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All policies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All policies</SelectItem>
                <SelectItem value="NUDITY">Nudity</SelectItem>
                <SelectItem value="VIOLENCE">Violence</SelectItem>
                <SelectItem value="HATE_SPEECH">Hate Speech</SelectItem>
                <SelectItem value="HARASSMENT">Harassment</SelectItem>
                <SelectItem value="SELF_HARM">Self Harm</SelectItem>
                <SelectItem value="SPAM">Spam</SelectItem>
                <SelectItem value="SCAM">Scam</SelectItem>
                <SelectItem value="COPYRIGHT">Copyright</SelectItem>
                <SelectItem value="IMPERSONATION">Impersonation</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priorityScore">Priority</SelectItem>
                <SelectItem value="slaDueAt">SLA</SelectItem>
                <SelectItem value="createdAt">Created</SelectItem>
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
            {data?.cases.map((case_) => (
              <Card
                key={case_.id}
                className={cn(
                  "card-glass border-2 transition-colors",
                  case_.priorityScore > 0.7
                    ? "border-red-300 hover:border-red-400"
                    : case_.priorityScore > 0.4
                      ? "border-orange-300 hover:border-orange-400"
                      : "border-pink-300 hover:border-pink-400"
                )}
              >
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(case_.status)}
                        {getSeverityBadge(case_.severity)}
                        {getAutoActionBadge(case_.autoAction)}
                        {case_.slaDueAt && getSLABadge(case_.slaDueAt)}
                        {/* {case_.source === "AI" && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
                          >
                            AI Detected
                          </Badge>
                        )} */}
                        {/* {case_.confidence && (
                          <Badge
                            variant="outline"
                            className="rounded-full text-xs"
                          >
                            {Math.round(case_.confidence * 100)}% confidence
                          </Badge>
                        )} */}
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeDate(case_.createdAt)}
                        </span>
                      </div>
                      {case_.policyAreaPredicted && (
                        <div className="text-sm">
                          <span className="font-medium">Predicted Policy:</span>{" "}
                          <Badge variant="outline" className="rounded-full">
                            {case_.policyAreaPredicted}
                          </Badge>
                        </div>
                      )}
                      {case_.harmfulTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {case_.harmfulTypes.map((type) => (
                            <Badge
                              key={type}
                              variant="outline"
                              className="rounded-full text-xs"
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {case_.post && (
                        <div>
                          <div className="text-sm">
                            <span className="font-medium">Post by:</span>{" "}
                            <Link
                              href={`/users/${case_.post.user.username}`}
                              className="hover:underline"
                            >
                              {case_.post.user.displayName}
                            </Link>
                          </div>
                          <Link href={`/posts/${case_.post.id}`}>
                            <p className="line-clamp-2 text-sm text-muted-foreground hover:underline">
                              {case_.post.content}
                            </p>
                          </Link>
                        </div>
                      )}
                      {case_.assignedAdmin && (
                        <div className="text-sm">
                          <span className="font-medium">Assigned to:</span>{" "}
                          {case_.assignedAdmin.displayName}
                        </div>
                      )}
                      {case_.priorityScore > 0 && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Priority: {case_.priorityScore.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <Dialog
                      open={isDialogOpen && selectedCase?.id === case_.id}
                      onOpenChange={(open) => {
                        // Don't close dialog if mutation is pending
                        if (!open && updateCaseMutation.isPending) {
                          return;
                        }
                        setIsDialogOpen(open);
                        if (!open) {
                          setSelectedCase(null);
                          setDecision("");
                          setPolicyArea("");
                          setReasonCode("");
                          setAdminNotes("");
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCase(case_);
                            setDecision(case_.decision || "");
                            setPolicyArea(case_.policyArea || "");
                            setReasonCode(case_.reasonCode || "");
                            setAdminNotes(case_.adminNotes || "");
                            setIsDialogOpen(true);
                          }}
                        >
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col border-[rgba(195,199,244,0.4)] bg-[rgba(244,231,248,0.95)] shadow-[0_8px_32px_0_rgba(227,170,221,0.25)] backdrop-blur-[20px]">
                        <DialogHeader className="flex-shrink-0 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                              <AlertTriangle className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div>
                              <DialogTitle className="text-2xl font-bold">
                                Review Moderation Case
                              </DialogTitle>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Review AI detection and make a decision
                              </p>
                            </div>
                          </div>
                        </DialogHeader>
                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4">
                          {selectedCase?.post && (
                            <div className="space-y-4 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-5 dark:border-orange-900 dark:from-orange-950/30 dark:to-red-950/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                                  <p className="text-base font-semibold text-orange-900 dark:text-orange-200">
                                    Flagged Post
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getSeverityBadge(selectedCase.severity)}
                                  {getAutoActionBadge(selectedCase.autoAction)}
                                </div>
                              </div>

                              <div className="rounded-lg bg-white/80 p-4 dark:bg-gray-900/50">
                                <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-gray-200">
                                  {selectedCase.post.content}
                                </p>
                              </div>

                              {selectedCase.post.attachments &&
                                selectedCase.post.attachments.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                      Attachments (
                                      {selectedCase.post.attachments.length}):
                                    </p>
                                    <div
                                      className={cn(
                                        "grid gap-3",
                                        selectedCase.post.attachments.length ===
                                          1
                                          ? "mx-auto max-w-2xl grid-cols-1"
                                          : selectedCase.post.attachments
                                                .length === 2
                                            ? "grid-cols-2"
                                            : "grid-cols-3"
                                      )}
                                    >
                                      {selectedCase.post.attachments.map(
                                        (attachment) => (
                                          <div
                                            key={attachment.id}
                                            className={cn(
                                              "group relative overflow-hidden rounded-lg border-2 border-orange-200 bg-white dark:border-orange-800 dark:bg-gray-900",
                                              selectedCase.post &&
                                                selectedCase.post.attachments
                                                  .length === 1
                                                ? "aspect-auto max-h-[300px]"
                                                : "aspect-square max-h-[200px]"
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
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}

                              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20">
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5">
                                    <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                      AI Detection Details
                                    </p>
                                    <div className="mt-1 space-y-1 text-xs text-blue-800 dark:text-blue-300">
                                      {/* <p>
                                        <span className="font-medium">
                                          Model:
                                        </span>{" "}
                                        {selectedCase.modelVersion || "N/A"}
                                      </p> */}
                                      <p>
                                        <span className="font-medium">
                                          Confidence:
                                        </span>{" "}
                                        {selectedCase.confidence
                                          ? `${Math.round(selectedCase.confidence * 100)}%`
                                          : "N/A"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Predicted Policy:
                                        </span>{" "}
                                        {selectedCase.policyAreaPredicted ||
                                          "N/A"}
                                      </p>
                                      <p>
                                        <span className="font-medium">
                                          Harmful Types:
                                        </span>{" "}
                                        {selectedCase.harmfulTypes.join(", ")}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {selectedCase && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-sm font-semibold">
                                  Decision{" "}
                                  <span className="text-destructive">*</span>
                                </label>
                                <Select
                                  value={decision}
                                  onValueChange={setDecision}
                                  disabled={
                                    selectedCase.status === "CONFIRMED" ||
                                    selectedCase.status === "RESTORED" ||
                                    selectedCase.status === "DISMISSED"
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select decision" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="CONFIRM_VIOLATION">
                                      Confirm Violation
                                    </SelectItem>
                                    <SelectItem value="RESTORE">
                                      Restore
                                    </SelectItem>
                                    <SelectItem value="DISMISS">
                                      Dismiss
                                    </SelectItem>
                                    <SelectItem value="NEED_MORE_CONTEXT">
                                      Need More Context
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {decision && (
                                <>
                                  <div className="space-y-2">
                                    <label className="text-sm font-semibold">
                                      Policy Area{" "}
                                      <span className="text-destructive">
                                        *
                                      </span>
                                    </label>
                                    <Select
                                      value={policyArea}
                                      onValueChange={setPolicyArea}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select policy area" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="NUDITY">
                                          Nudity
                                        </SelectItem>
                                        <SelectItem value="VIOLENCE">
                                          Violence
                                        </SelectItem>
                                        <SelectItem value="HATE_SPEECH">
                                          Hate Speech
                                        </SelectItem>
                                        <SelectItem value="HARASSMENT">
                                          Harassment
                                        </SelectItem>
                                        <SelectItem value="SELF_HARM">
                                          Self Harm
                                        </SelectItem>
                                        <SelectItem value="SPAM">
                                          Spam
                                        </SelectItem>
                                        <SelectItem value="SCAM">
                                          Scam
                                        </SelectItem>
                                        <SelectItem value="COPYRIGHT">
                                          Copyright
                                        </SelectItem>
                                        <SelectItem value="IMPERSONATION">
                                          Impersonation
                                        </SelectItem>
                                        <SelectItem value="OTHER">
                                          Other
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-sm font-semibold">
                                      Reason Code
                                    </label>
                                    <Input
                                      value={reasonCode}
                                      onChange={(e) =>
                                        setReasonCode(e.target.value)
                                      }
                                      placeholder="e.g., VIOLENCE_GRAPHIC_IMAGE"
                                    />
                                  </div>
                                </>
                              )}

                              <div className="space-y-2">
                                <label className="text-sm font-semibold">
                                  Admin Notes
                                </label>
                                <Textarea
                                  value={adminNotes}
                                  onChange={(e) =>
                                    setAdminNotes(e.target.value)
                                  }
                                  placeholder="Add notes about this case..."
                                  rows={3}
                                  disabled={
                                    selectedCase.status === "CONFIRMED" ||
                                    selectedCase.status === "RESTORED" ||
                                    selectedCase.status === "DISMISSED"
                                  }
                                  className="resize-none border-2 focus:border-pink-400 focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex flex-shrink-0 flex-wrap gap-2 border-t pt-4">
                          {selectedCase?.status === "CONFIRMED" ||
                          selectedCase?.status === "RESTORED" ||
                          selectedCase?.status === "DISMISSED" ? (
                            <div className="w-full rounded-lg border-2 border-green-200 bg-green-50/50 p-3 dark:border-green-900 dark:bg-green-950/20">
                              <div className="flex items-center gap-2">
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <p className="text-sm font-medium text-green-900 dark:text-green-200">
                                  This case has been{" "}
                                  {selectedCase.status.toLowerCase()}. No
                                  further actions can be taken.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant="default"
                                onClick={handleUpdateCase}
                                disabled={
                                  updateCaseMutation.isPending ||
                                  !decision ||
                                  (!!decision && !policyArea)
                                }
                                className="flex-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Submit Decision
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={handleAssign}
                                disabled={updateCaseMutation.isPending}
                                className="rounded-full"
                              >
                                {selectedCase?.assignedAdmin
                                  ? "Unassign"
                                  : "Assign to Me"}
                              </Button>
                            </>
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
    </>
  );
}
