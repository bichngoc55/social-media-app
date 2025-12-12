"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyEmailSchema, VerifyEmailValues } from "@/lib/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { verifyEmailAction } from "./actions";

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const email = searchParams.get("email") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<VerifyEmailValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: {
      email,
    },
  });

  const onSubmit = async (data: VerifyEmailValues) => {
    setIsLoading(true);

    try {
      const result = await verifyEmailAction(data);

      if (result.success) {
        toast({
          title: "Thành công!",
          description:
            "Email đã được xác thực thành công! Bạn đã được đăng nhập.",
        });
        router.push("/onboarding");
      } else {
        setError("otp", { message: result.error || "Có lỗi xảy ra" });
        toast({
          title: "Lỗi",
          description: result.error || "Có lỗi xảy ra",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra, vui lòng thử lại",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setIsResending(true);

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Thành công!",
          description: "Mã OTP mới đã được gửi!",
        });
        setCountdown(60); // 60 giây countdown

        // Countdown timer
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        toast({
          title: "Lỗi",
          description: result.error || "Không thể gửi OTP",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra, vui lòng thử lại",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="card-glass space-y-6 p-8">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              id="email"
              type="email"
              className="pl-10"
              {...register("email")}
              disabled
            />
          </div>
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="otp">Mã OTP</Label>
          <Input
            id="otp"
            type="text"
            placeholder="Nhập 6 chữ số"
            maxLength={6}
            className="text-center text-2xl tracking-widest"
            {...register("otp")}
          />
          {errors.otp && (
            <p className="text-sm text-destructive">{errors.otp.message}</p>
          )}
        </div>

        <Button type="submit" className="btn-glow w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Đang xác thực...
            </>
          ) : (
            "Xác thực email"
          )}
        </Button>
      </form>

      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">Không nhận được mã OTP?</p>
        <Button
          variant="outline"
          onClick={handleResendOTP}
          disabled={isResending || countdown > 0}
          className="btn-glow"
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Đang gửi...
            </>
          ) : countdown > 0 ? (
            `Gửi lại sau ${countdown}s`
          ) : (
            <>
              <RefreshCw className="mr-2 size-4" />
              Gửi lại mã OTP
            </>
          )}
        </Button>
      </div>

      <div className="text-center">
        <Button
          variant="ghost"
          onClick={() => router.push("/login")}
          className="text-muted-foreground hover:text-foreground"
        >
          Quay lại đăng nhập
        </Button>
      </div>
    </div>
  );
}
