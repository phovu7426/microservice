export interface MenuTreeItem {
  id: any;
  code: string;
  name: string;
  path?: string | null;
  icon?: string | null;
  type: string;
  status: string;
  isPublic?: boolean;
  children?: MenuTreeItem[];
  allowed?: boolean;
}
