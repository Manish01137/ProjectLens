import {
  Accessibility,
  Bus,
  CloudLightning,
  CodeXml,
  GraduationCap,
  HeartPulse,
  IndianRupee,
  Landmark,
  Leaf,
  MapPinned,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { Domain } from "@/lib/constants";

export const DOMAIN_ICON: Record<Domain, LucideIcon> = {
  Healthcare: HeartPulse,
  Agriculture: Sprout,
  Education: GraduationCap,
  "Cybersecurity & Blockchain": ShieldCheck,
  "Smart Cities & Transport": Bus,
  "Disaster Management & Earth Sciences": CloudLightning,
  "Clean Energy & Environment": Leaf,
  "Governance & Legal": Landmark,
  "Heritage & Tourism": MapPinned,
  Fintech: IndianRupee,
  "Accessibility & Inclusion": Accessibility,
  "Software Engineering & AI Tooling": CodeXml,
};

export function DomainIcon({ domain, className }: { domain: string; className?: string }) {
  const Icon = DOMAIN_ICON[domain as Domain] ?? CodeXml;
  return <Icon className={className} aria-hidden="true" />;
}
