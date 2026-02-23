import { ResourceListContainer } from '@/components/admin/ResourceListContainer';
import { fetchBlogPostsPaginated } from '@/lib/blog';
import { blogConfig, BlogHeader } from '../blog/config';
import BlogSocialClient from './BlogSocialClient';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function BlogSocialPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = typeof params.tab === 'string' ? params.tab : 'blog';

  return (
    <BlogSocialClient defaultTab={tab} searchParams={params}>
      {/* Blog tab content - server rendered */}
      <div data-tab="blog">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <BlogHeader />
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
              <ResourceListContainer
                searchParams={params}
                fetchData={fetchBlogPostsPaginated}
                config={blogConfig}
              />
            </div>
          </div>
        </div>
      </div>
    </BlogSocialClient>
  );
}

export const metadata = {
  title: 'Blog & Social | Admin',
  description: 'Gerenciar blog e publicações em redes sociais',
};
