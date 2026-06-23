import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Folder,
  Receipt,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { DocumentIcon } from '@/types/rules';

const ICON_MAP: Record<DocumentIcon, LucideIcon> = {
  'file-text': FileText,
  receipt: Receipt,
  'file-invoice': FileSpreadsheet,
  users: Users,
  'chart-bar': BarChart3,
  'shield-check': ShieldCheck,
  folder: Folder,
};

export function CategoryIcon({ icon, className }: { icon: DocumentIcon; className?: string }) {
  const Icon = ICON_MAP[icon] ?? Folder;
  return <Icon className={className} />;
}
