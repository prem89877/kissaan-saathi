"use client";

import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { directionsUrl } from "@/lib/mapLink";

export default function GetDirectionsButton({ latitude, longitude }: { latitude: number; longitude: number }) {
  const { t } = useTranslation();

  return (
    <a
      href={directionsUrl(latitude, longitude)}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-primary w-full text-center"
    >
      {t("pickup.getDirections")}
    </a>
  );
}
