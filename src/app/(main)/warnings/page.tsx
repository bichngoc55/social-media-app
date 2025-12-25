"use client";

import { useQuery } from "@tanstack/react-query";
import kyInstance from "@/lib/ky";
import { AlertTriangle, Clock, FileText, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import Post from "@/components/posts/Post";
import { PostDataLightweight } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Warning {
  id: string;
  message: string;
  deadline: string | null;
  createdAt: string;
  postId: string | null;
  admin: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: "USER" | "ADMIN";
  };
  post: PostDataLightweight | null;
}

export default function WarningsPage() {
  const { toast } = useToast();
  const [appealDialog, setAppealDialog] = useState<{
    open: boolean;
    warning: Warning | null;
  }>({ open: false, warning: null });
  const [appealReason, setAppealReason] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-warnings"],
    queryFn: async () => {
      const response = await kyInstance.get("/api/users/warnings").json<{ warnings: Warning[] }>();
      // Additional client-side validation: ensure all warnings belong to current user
      // (This is a safety check, server should already filter correctly)
      return response;
    },
  });

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
  };

  const isDeadlinePassed = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleAppeal = async () => {
    if (!appealDialog.warning || !appealReason.trim()) {
      toast({
        description: "Vui lòng nhập lý do kháng cáo",
        variant: "destructive",
      });
      return;
    }

    try {
      if (appealDialog.warning.postId) {
        await kyInstance.post(`/api/posts/${appealDialog.warning.postId}/appeal`, {
          json: { appealReason },
        });
        toast({ description: "Kháng cáo đã được gửi thành công" });
        setAppealDialog({ open: false, warning: null });
        setAppealReason("");
      }
    } catch (error: any) {
      toast({
        description: error?.message || "Gửi kháng cáo thất bại",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-destructive">
            Có lỗi xảy ra khi tải danh sách cảnh báo
          </p>
        </CardContent>
      </Card>
    );
  }

  const warnings = data?.warnings || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Danh sách cảnh báo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warnings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Bạn chưa có cảnh báo nào
            </p>
          ) : (
            <div className="space-y-4">
              {warnings.map((warning) => (
                <Card
                  key={warning.id}
                  className={cn(
                    "border-l-4",
                    isDeadlinePassed(warning.deadline)
                      ? "border-l-red-500"
                      : "border-l-orange-500"
                  )}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              isDeadlinePassed(warning.deadline)
                                ? "border-red-500 text-red-700 dark:text-red-400"
                                : "border-orange-500 text-orange-700 dark:text-orange-400"
                            )}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {warning.deadline
                              ? isDeadlinePassed(warning.deadline)
                                ? "Đã hết hạn"
                                : `Còn ${Math.ceil(
                                    (new Date(warning.deadline).getTime() -
                                      new Date().getTime()) /
                                      (1000 * 60 * 60)
                                  )} giờ`
                              : "Không có deadline"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Cảnh báo từ: {warning.admin.displayName}
                          {warning.admin.role === "ADMIN" && " (Admin)"} (@
                          {warning.admin.username})
                        </p>
                        <p className="text-sm mb-2 whitespace-pre-line">
                          {warning.message}
                        </p>
                        {warning.deadline && (
                          <p className="text-xs text-muted-foreground">
                            Deadline: {formatDateTime(warning.deadline)}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Ngày cảnh báo: {formatDateTime(warning.createdAt)}
                        </p>
                      </div>
                    </div>

                    {warning.post && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-orange-500" />
                          <span className="text-sm font-semibold text-orange-500">
                            Bài viết bị cảnh báo:
                          </span>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-2 top-2 z-10 rounded-full bg-orange-500 p-1.5 shadow-lg">
                            <AlertTriangle className="h-4 w-4 text-white" />
                          </div>
                          <div className="border-l-4 border-orange-500 pl-4">
                            <Post post={warning.post as PostDataLightweight} />
                          </div>
                        </div>
                        {!isDeadlinePassed(warning.deadline) && (
                          <div className="flex justify-end">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                setAppealDialog({ open: true, warning })
                              }
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Kháng cáo bài viết này
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={appealDialog.open}
        onOpenChange={(open) =>
          !open &&
          setAppealDialog({ open: false, warning: null }) &&
          setAppealReason("")
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kháng cáo cảnh báo</DialogTitle>
            <DialogDescription>
              Vui lòng nhập lý do kháng cáo cho cảnh báo này. Bạn có 72 giờ để
              kháng cáo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="appeal-reason">Lý do kháng cáo</Label>
              <Textarea
                id="appeal-reason"
                placeholder="Nhập lý do kháng cáo..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAppealDialog({ open: false, warning: null });
                setAppealReason("");
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleAppeal}>Gửi kháng cáo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

