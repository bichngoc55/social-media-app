import { Suspense } from "react";
import VerifyEmailForm from "./VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="gradient-text mb-2 text-3xl font-bold">
            Xác thực email
          </h1>
          <p className="text-muted-foreground">
            Vui lòng nhập mã OTP đã được gửi đến email của bạn
          </p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </div>
  );
}
