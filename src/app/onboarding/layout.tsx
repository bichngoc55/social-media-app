import { validateRequest } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await validateRequest();

  if (!user) redirect("/login");

  const userData = await prisma.user.findUnique({
    where: { id: user.id },
    select: { interests: true, countryCode: true },
  });

  if (
    userData?.interests &&
    userData.interests.length >= 3 &&
    userData.countryCode
  ) {
    console.log("User already completed onboarding, redirecting...");
    redirect("/");
  }

  return <>{children}</>;
}
