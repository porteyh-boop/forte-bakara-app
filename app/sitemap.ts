import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://forte-bakara.local";
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/history`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/report`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/building`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
