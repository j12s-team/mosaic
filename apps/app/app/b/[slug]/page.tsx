import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { dbEnabled, dbGetPublicBasketBySlug, dbGetSnapshots } from "@mosaic/core/db";
import PublicBasketClient from "./PublicBasketClient";

export const dynamic = "force-dynamic";

/**
 * /b/[slug] — durable public basket page (DB-backed).
 *
 * Coexists with /b?d=… (the stateless share-link view): this route serves
 * opt-in public baskets with their server-recorded, hash-chained track
 * record and the one-click mirror flow.
 */
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  if (!dbEnabled()) return { title: "Mosaic — basket" };
  const row = await dbGetPublicBasketBySlug(slug);
  if (!row) return { title: "Mosaic — basket" };
  return {
    title: `Mosaic — ${row.record.label ?? "public basket"}`,
    description: row.record.basket.thesis.prompt,
  };
}

export default async function PublicBasketPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  if (!dbEnabled()) notFound();

  const row = await dbGetPublicBasketBySlug(slug);
  if (!row) notFound();

  const snapshots = await dbGetSnapshots(row.record.basket.id);

  return (
    <PublicBasketClient
      slug={slug}
      record={row.record}
      snapshots={snapshots}
      mirroredFrom={row.mirroredFrom}
    />
  );
}
