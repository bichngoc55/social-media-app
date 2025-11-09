import { validateRequest } from "@/auth";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import SessionProvider from "./SessionProvider";
import SocketProvider from "./SocketProvider";

// Lazy load components để giảm initial bundle
const Navbar = dynamic(() => import("./Navbar"), {
  ssr: true,
});

const MenuBar = dynamic(() => import("./MenuBar"), {
  ssr: true,
});

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await validateRequest();

  if (!session.user) redirect("/login");

  return (
    <SessionProvider value={session}>
      <SocketProvider>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <div className="mx-auto flex w-full max-w-7xl grow gap-5 p-5">
            <MenuBar className="card-glass sticky top-[5.25rem] hidden h-fit flex-none space-y-3 rounded-2xl px-4 py-6 sm:block lg:px-6 xl:w-80" />
            {children}
          </div>
          <MenuBar className="card-glass sticky bottom-0 flex w-full justify-center gap-5 border-t p-4 sm:hidden" />
        </div>
      </SocketProvider>
    </SessionProvider>
  );
}
