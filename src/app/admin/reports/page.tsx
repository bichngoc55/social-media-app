"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Search, Check, X, Clock, ArrowLeft } from "lucide-react";
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
import { formatRelativeDate } from "@/lib/utils";
import Link from "next/link";
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
  } | null;
}

export default function AdminReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
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
    },
  });

  const handleUpdateReport = (status: string) => {
    if (!selectedReport) return;
    updateReportMutation.mutate({
      reportId: selectedReport.id,
      data: { status, adminNotes: adminNotes || null },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>;
      case "REVIEWED":
        return <Badge variant="secondary">Reviewed</Badge>;
      case "RESOLVED":
        return <Badge variant="default">Resolved</Badge>;
      case "DISMISSED":
        return <Badge variant="destructive">Dismissed</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    return <Badge variant="outline">{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Flag className="h-8 w-8" />
          Quản lý Báo cáo
        </h1>
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
              <Card key={report.id}>
                <CardContent className="space-y-3 p-4">
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
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            setAdminNotes(report.adminNotes || "");
                          }}
                        >
                          Review
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Review Report</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">
                              Admin Notes
                            </label>
                            <Textarea
                              value={adminNotes}
                              onChange={(e) => setAdminNotes(e.target.value)}
                              placeholder="Add notes about this report..."
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              onClick={() => handleUpdateReport("RESOLVED")}
                              disabled={updateReportMutation.isPending}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Resolve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleUpdateReport("DISMISSED")}
                              disabled={updateReportMutation.isPending}
                            >
                              <X className="mr-2 h-4 w-4" />
                              Dismiss
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => handleUpdateReport("REVIEWED")}
                              disabled={updateReportMutation.isPending}
                            >
                              <Clock className="mr-2 h-4 w-4" />
                              Mark Reviewed
                            </Button>
                          </div>
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
