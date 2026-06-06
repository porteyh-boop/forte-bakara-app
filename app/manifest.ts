import type { MetadataRoute } from "next";
import {
  BRAND_APP,
  BRAND_EDITOR_NAME,
  BRAND_EDITOR_TITLE,
  BRAND_TAGLINE,
} from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_APP} – ${BRAND_TAGLINE}`,
    short_name: BRAND_APP,
    description: `${BRAND_EDITOR_NAME} · ${BRAND_EDITOR_TITLE}`,
    start_url: "/",
    display: "standalone",
    background_color: "#0d1b3e",
    theme_color: "#0d1b3e",
    lang: "he",
    dir: "rtl",
  };
}
