import * as fs from "fs";
import * as path from "path";
import type { SiteRecord } from "@/types";

const SITES_FILE = path.join(process.cwd(), "data", "sites.json");

function readSites(): SiteRecord[] {
  try {
    if (!fs.existsSync(SITES_FILE)) return [];
    const raw = fs.readFileSync(SITES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeSites(sites: SiteRecord[]): void {
  fs.mkdirSync(path.dirname(SITES_FILE), { recursive: true });
  fs.writeFileSync(SITES_FILE, JSON.stringify(sites, null, 2), "utf-8");
}

export function getSite(siteId: string): SiteRecord | null {
  const sites = readSites();
  return sites.find((s) => s.siteId === siteId) ?? null;
}

export function upsertSite(record: SiteRecord): void {
  const sites = readSites();
  const index = sites.findIndex((s) => s.siteId === record.siteId);

  if (index >= 0) {
    sites[index] = record;
  } else {
    sites.push(record);
  }

  writeSites(sites);
}

export function listSites(): SiteRecord[] {
  return readSites();
}
