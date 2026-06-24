// Category entity — data shape stored in MySQL
export interface Category {
  id: string;           // uuid
  name: string;         // varchar(100)
  slug: string;         // varchar(100) UNIQUE
  parent_id: string | null;  // nullable self-FK
  column_group: string | null; // e.g. "VÊTEMENTS", "CHAUSSURES"
  image_url: string | null;  // varchar(500)
  position: number;     // integer, default 0
  created_at: Date;
  updated_at: Date;
}

/** Category with nested children (for tree responses) */
export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

/** Payload for creating a category */
export interface CreateCategoryData {
  name: string;
  slug?: string;           // auto-generated from name if omitted
  parent_id?: string | null;
  column_group?: string | null;
  image_url?: string | null;
  position?: number;
}

/** Payload for updating a category (all fields optional) */
export type UpdateCategoryData = Partial<CreateCategoryData>;
