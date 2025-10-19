"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  UserX,
  Flag,
  Loader2,
  Shield,
  AlertTriangle,
  MessageSquare,
  Image,
  Users,
} from "lucide-react";

interface BlockReportButtonsProps {
  userId: string;
  username: string;
  isBlocked: boolean;
}

const REPORT_TYPES = [
  { value: "SPAM", label: "Spam", icon: MessageSquare },
  { value: "HARASSMENT", label: "Quấy rối", icon: AlertTriangle },
  { value: "HATE_SPEECH", label: "Ngôn từ thù địch", icon: Shield },
  {
    value: "INAPPROPRIATE_CONTENT",
    label: "Nội dung không phù hợp",
    icon: Image,
  },
  { value: "FAKE_ACCOUNT", label: "Tài khoản giả", icon: Users },
  { value: "OTHER", label: "Khác", icon: Flag },
];

export default function BlockReportButtons({
  userId,
  username,
  isBlocked,
}: BlockReportButtonsProps) {
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [currentBlockStatus, setCurrentBlockStatus] = useState(isBlocked);
  const { toast } = useToast();

  const handleBlockUser = async () => {
    if (!blockReason.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập lý do chặn",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: blockReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra");
      }

      setIsBlockDialogOpen(false);
      setBlockReason("");
      setCurrentBlockStatus(true);

      toast({
        title: "Thành công",
        description: `Đã chặn ${username}`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/block`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra");
      }

      setCurrentBlockStatus(false);

      toast({
        title: "Thành công",
        description: `Đã bỏ chặn ${username}`,
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportType || !reportReason.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn loại báo cáo và nhập lý do",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: reportType,
          reason: reportReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Có lỗi xảy ra");
      }

      setIsReportDialogOpen(false);
      setReportType("");
      setReportReason("");

      toast({
        title: "Thành công",
        description: "Báo cáo đã được gửi thành công",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {currentBlockStatus ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUnblockUser}
            disabled={isLoading}
            className="border-green-200 bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shield className="mr-2 h-4 w-4" />
            )}
            Bỏ chặn
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsBlockDialogOpen(true)}
            disabled={isLoading}
            className="border-red-200 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <UserX className="mr-2 h-4 w-4" />
            Chặn
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsReportDialogOpen(true)}
          disabled={isLoading}
          className="border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-200 hover:text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
        >
          <Flag className="mr-2 h-4 w-4" />
          Báo cáo
        </Button>
      </div>

      {/* Block Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-red-600" />
              Chặn người dùng
            </DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn chặn <strong>{username}</strong>? Người này
              sẽ không thể xem nội dung của bạn và tương tác với bạn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="block-reason">Lý do chặn (tùy chọn)</Label>
              <Textarea
                id="block-reason"
                placeholder="Nhập lý do chặn người dùng này..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBlockDialogOpen(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockUser}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserX className="h-4 w-4" />
              )}
              Chặn người dùng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-orange-600" />
              Báo cáo vi phạm
            </DialogTitle>
            <DialogDescription>
              Báo cáo <strong>{username}</strong> vì vi phạm quy tắc cộng đồng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="report-type">Loại vi phạm</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Chọn loại vi phạm" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="report-reason">Mô tả chi tiết</Label>
              <Textarea
                id="report-reason"
                placeholder="Mô tả chi tiết về vi phạm..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="mt-1"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReportDialogOpen(false)}
              disabled={isLoading}
            >
              Hủy
            </Button>
            <Button
              onClick={handleReportUser}
              disabled={isLoading || !reportType || !reportReason.trim()}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Flag className="h-4 w-4" />
              )}
              Gửi báo cáo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
