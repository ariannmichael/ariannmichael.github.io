import type { Metadata, Viewport } from "next";
import { districts, getDistrict, type DistrictId } from "@/content";
import AppShell from "@/ui/AppShell";

type Props = { params: Promise<{ id: string }> };

// Static export: every district page is generated at build time and unknown ids 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return districts.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const district = getDistrict(id as DistrictId);
  const title = `${district.name} · Ariann Michael`;
  const url = `/district/${district.id}/`;
  // openGraph/twitter are restated in full because nested metadata objects replace the layout's.
  return {
    title,
    description: district.blurb,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Ariann Michael",
      locale: "en_US",
      title,
      description: district.blurb,
      url,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ariann Michael's 3D portfolio town" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: district.blurb,
      images: ["/og-image.png"],
    },
  };
}

export const viewport: Viewport = {
  viewportFit: "cover",
  // Steering with two thumbs must never turn into a pinch-zoom of the page (iOS Safari ignores this
  // flag and relies on touch-action: none on the controls, see globals.css / AppShell.module.css)
  maximumScale: 1,
  userScalable: false,
};

export default async function DistrictPage({ params }: Props) {
  const { id } = await params;
  // generateStaticParams + dynamicParams=false guarantee `id` is a known district.
  return <AppShell district={getDistrict(id as DistrictId).id} />;
}
