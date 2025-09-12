import SearchField from "@/components/SearchField";
import UserButton from "@/components/UserButton";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 card-elevated">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-3xl font-bold gradient-text">
          <Image
            src="/logo-image.png"
            alt="Loopy Logo"
            width={60}
            height={60}
            className="rounded-full hover:scale-110 transition-transform duration-300"
          />
          Loopy
        </Link>
        <SearchField />
        <UserButton className="sm:ms-auto" />
      </div>
    </header>
  );
}
