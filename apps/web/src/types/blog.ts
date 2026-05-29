export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  authorId: string;
  authorName?: string;
  tags: string[];
  category: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
