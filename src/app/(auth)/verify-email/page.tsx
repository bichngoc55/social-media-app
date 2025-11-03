import { Suspense } from "react";
import VerifyEmailForm from "./VerifyEmailForm";

export default function VerifyEmailPage() {
  return (
    <main className="flex h-screen items-center justify-center p-5">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold">Xác thực email</h1>
          <p className="text-muted-foreground">
            Vui lòng nhập mã OTP đã được gửi đến email của bạn
          </p>
        </div>

        <Suspense fallback={<div>Loading...</div>}>
          <VerifyEmailForm />
        </Suspense>
      </div>
    </main>
  );
}
