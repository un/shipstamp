import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { isAuthenticated } from "@/lib/auth-server";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ok = await isAuthenticated();

  const ctaHref = ok ? "/dashboard" : "/sign-in";
  const ctaLabel = ok ? "Dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[78ch] items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            shipstamp
          </Link>

          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/#problem"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Problem
            </Link>
            <Link
              href="/#how-it-works"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              How it works
            </Link>
            <Link
              href="/#pricing"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Pricing
            </Link>
            <Link
              href="/#faq"
              className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href={ctaHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[78ch] px-6 pb-3 sm:hidden">
          <nav aria-label="Sections" className="flex items-center gap-1 overflow-x-auto">
            <Link
              href="/#problem"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Problem
            </Link>
            <Link
              href="/#how-it-works"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              How it works
            </Link>
            <Link
              href="/#pricing"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Pricing
            </Link>
            <Link
              href="/#faq"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              FAQ
            </Link>
          </nav>
        </div>
      </header>

      <main id="content" className="mx-auto w-full max-w-[78ch] px-6 py-10">
        {children}
      </main>
    </div>
  );
}
