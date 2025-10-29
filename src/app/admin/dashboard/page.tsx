import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, FileText, Flag, Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Link href="/admin/users">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Quản lý Người dùng
              </CardTitle>
              <CardDescription>
                Xem, chỉnh sửa và quản lý tất cả người dùng
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/posts">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Quản lý Bài viết
              </CardTitle>
              <CardDescription>
                Xem và quản lý tất cả bài viết trong hệ thống
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/reports">
          <Card className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Quản lý Báo cáo
              </CardTitle>
              <CardDescription>
                Xem và xử lý các báo cáo từ người dùng
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
