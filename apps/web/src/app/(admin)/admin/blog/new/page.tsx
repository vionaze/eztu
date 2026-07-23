import BlogPostForm from "@/components/admin/BlogPostForm";
import { getBlogAiSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const ai = await getBlogAiSettings();
  const countries =
    ai.countries.length > 0
      ? ai.countries
      : ["GLOBAL", "ID", "MY", "US", "PH", "SG"];

  return <BlogPostForm countries={countries} />;
}
