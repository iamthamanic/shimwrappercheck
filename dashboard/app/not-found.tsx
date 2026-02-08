/**
 * Root 404 page (no locale in path). Uses default EN messages so text is always translated.
 * Location: app/not-found.tsx
 */
import Link from "next/link";
import notFoundEn from "@/messages/en.json";

export default function NotFound() {
  const nf = (
    notFoundEn as {
      notFound?: { title?: string; description?: string };
      common?: { myshim?: string; settings?: string };
    }
  ).notFound;
  const common = (
    notFoundEn as {
      notFound?: { title?: string; description?: string };
      common?: { myshim?: string; settings?: string };
    }
  ).common;
  const title = nf?.title ?? "Page not found";
  const description = nf?.description ?? "The requested URL does not exist.";
  const myshim = common?.myshim ?? "myshim";
  const settings = common?.settings ?? "Settings";
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-white">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-white/70">{description}</p>
      <div className="flex gap-4">
        <Link href="/" className="btn btn-primary btn-sm">
          {myshim}
        </Link>
        <Link href="/settings" className="btn btn-outline btn-sm border-white/50 text-white">
          {settings}
        </Link>
      </div>
    </div>
  );
}
