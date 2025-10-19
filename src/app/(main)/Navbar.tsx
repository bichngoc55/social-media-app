import SearchField from "@/components/SearchField";
import UserButton from "@/components/UserButton";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <header className="card-elevated sticky top-0 z-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 px-5 py-3">
        <Link
          href="/"
          className="gradient-text flex items-center gap-2 text-3xl font-bold"
        >
          <Image
            src="/logo-image.png"
            alt="Loopy Logo"
            width={60}
            height={60}
            className="rounded-full transition-transform duration-300 hover:scale-110"
          />
          Loopy
        </Link>
        <SearchField />
        <UserButton className="sm:ms-auto" />
      </div>
    </header>
  );
}
