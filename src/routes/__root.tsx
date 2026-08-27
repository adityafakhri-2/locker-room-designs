import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AA Jersey — Jersey Asli, Gaya Sejati" },
      {
        name: "description",
        content:
          "Toko jersey sepak bola premium di Indonesia. Original, vintage, retro, dan edisi langka — terverifikasi keasliannya untuk fans dan kolektor sejati.",
      },
      { name: "author", content: "AA Jersey" },
      { property: "og:title", content: "AA Jersey — Jersey Asli, Gaya Sejati" },
      {
        property: "og:description",
        content:
          "Original. Vintage. Retro. Limited edition. Jersey sepak bola yang telah menjadi bagian dari sejarah.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@aajersey" },
      { name: "twitter:title", content: "AA Jersey — Jersey Asli, Gaya Sejati" },
      {
        name: "description",
        content:
          "AA Jersey adalah toko jersey sepak bola premium yang menawarkan jersey original, vintage, dan edisi kolektor.",
      },
      {
        property: "og:description",
        content:
          "AA Jersey adalah toko jersey sepak bola premium yang menawarkan jersey original, vintage, dan edisi kolektor.",
      },
      {
        name: "twitter:description",
        content:
          "AA Jersey adalah toko jersey sepak bola premium yang menawarkan jersey original, vintage, dan edisi kolektor.",
      },
      { property: "og:image", content: "/logo-aa-jersey.png" },
      { name: "twitter:image", content: "/logo-aa-jersey.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/icon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180x180.png" },
      { rel: "shortcut icon", href: "/icon-32x32.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Lompat ke Konten Utama
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { NavigationProgress } from "@/components/common/NavigationProgress";
import { InitialBrandLoader } from "@/components/common/InitialBrandLoader";
import { LogoutOverlay } from "@/components/common/LogoutOverlay";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <InitialBrandLoader />
      <NavigationProgress />
      <LogoutOverlay />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}
