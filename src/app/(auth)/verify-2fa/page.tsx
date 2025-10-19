import { Suspense } from "react";
import Verify2FAForm from "./Verify2FAForm";

export default function Verify2FAPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="gradient-text mb-2 text-3xl font-bold">
            🔐 Xác thực 2FA
          </h1>
          <p className="text-muted-foreground">
            Vui lòng nhập mã xác thực đã được gửi đến email của bạn
          </p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <Verify2FAForm />
        </Suspense>
      </div>
    </div>
  );
}
