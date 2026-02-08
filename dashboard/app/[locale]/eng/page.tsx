/**
 * Redirect /[locale]/eng -> /[locale] (e.g. /de/eng -> /de).
 * "eng" is not a valid locale; this avoids 404 when users type "eng" instead of "en".
 * Location: app/[locale]/eng/page.tsx
 */
import { redirect } from "next/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function EngRedirectPage({ params }: Props) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
