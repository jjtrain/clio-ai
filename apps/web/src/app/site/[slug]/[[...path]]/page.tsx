"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { BlockRenderer } from "@/components/website/block-renderer";

export default function PublicSitePage() {
  const params = useParams();
  const siteSlug = params.slug as string;
  const pathParts = (params.path as string[] | undefined) || [];
  const pageSlug = pathParts[0] || "home";
  const blogPostSlug = pageSlug === "blog" && pathParts[1] ? pathParts[1] : null;

  const { data: site, isLoading } = trpc.website.getPublicSite.useQuery({ slug: siteSlug });
  const { data: blogPosts } = trpc.website.getPublicBlogList.useQuery(
    { limit: 6 },
    { enabled: !!site }
  );
  const { data: blogPost } = trpc.website.getPublicBlogPost.useQuery(
    { slug: blogPostSlug! },
    { enabled: !!blogPostSlug }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Site Not Found</h1>
          <p className="text-gray-500">This website is not available or has not been published.</p>
        </div>
      </div>
    );
  }

  const { settings, pages, testimonials } = site;
  const currentPage = pages.find((p) => p.slug === pageSlug);
  const navPages = pages.filter((p) => p.slug !== "home");

  let blocks: any[] = [];
  if (currentPage) {
    try { blocks = JSON.parse(currentPage.content); } catch {}
  }

  const fontLink = settings.fontFamily !== "Inter"
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.fontFamily)}:wght@400;500;600;700&display=swap`
    : null;

  // Blog post detail
  if (blogPostSlug && blogPost) {
    let tags: string[] = [];
    if (blogPost.tags) {
      try { tags = JSON.parse(blogPost.tags); } catch {}
    }
    return (
      <div style={{ fontFamily: `'${settings.fontFamily}', sans-serif` }} className="min-h-screen bg-white">
        {fontLink && <link rel="stylesheet" href={fontLink} />}
        <SiteNav settings={settings} pages={navPages} siteSlug={siteSlug} />
        <article className="max-w-3xl mx-auto px-6 py-12">
          {blogPost.coverImageUrl && (
            <img src={blogPost.coverImageUrl} alt={blogPost.title} className="w-full h-64 object-cover rounded-xl mb-8" />
          )}
          <h1 className="text-4xl font-bold mb-4">{blogPost.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
            {blogPost.author && <span>By {blogPost.author}</span>}
            {blogPost.publishedAt && <span>{new Date(blogPost.publishedAt).toLocaleDateString()}</span>}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {tags.map((t, i) => (
                <span key={i} className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">{t}</span>
              ))}
            </div>
          )}
          <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: blogPost.content }} />
        </article>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  // Blog listing override
  if (pageSlug === "blog" && !blogPostSlug) {
    return (
      <div style={{ fontFamily: `'${settings.fontFamily}', sans-serif` }} className="min-h-screen bg-white">
        {fontLink && <link rel="stylesheet" href={fontLink} />}
        <SiteNav settings={settings} pages={navPages} siteSlug={siteSlug} />
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold mb-8">Blog</h1>
          {blogPosts && blogPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {blogPosts.map((post) => (
                <a key={post.id} href={`/site/${siteSlug}/blog/${post.slug}`} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {post.coverImageUrl && <img src={post.coverImageUrl} alt={post.title} className="w-full h-48 object-cover" />}
                  <div className="p-5">
                    <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                    {post.excerpt && <p className="text-gray-600 text-sm mb-3 line-clamp-3">{post.excerpt}</p>}
                    <p className="text-xs text-gray-400">{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No blog posts yet.</p>
          )}
        </div>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  // Regular page
  if (!currentPage) {
    return (
      <div style={{ fontFamily: `'${settings.fontFamily}', sans-serif` }} className="min-h-screen bg-white">
        {fontLink && <link rel="stylesheet" href={fontLink} />}
        <SiteNav settings={settings} pages={navPages} siteSlug={siteSlug} />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-gray-500">The page you're looking for doesn't exist.</p>
        </div>
        <SiteFooter settings={settings} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: `'${settings.fontFamily}', sans-serif` }} className="min-h-screen bg-white">
      {fontLink && <link rel="stylesheet" href={fontLink} />}
      <SiteNav settings={settings} pages={navPages} siteSlug={siteSlug} />
      <BlockRenderer
        blocks={blocks}
        settings={{ ...settings, siteSlug }}
        testimonials={testimonials}
        blogPosts={blogPosts || []}
      />
      <SiteFooter settings={settings} />
    </div>
  );
}

function SiteNav({ settings, pages, siteSlug }: { settings: any; pages: any[]; siteSlug: string }) {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
        <a href={`/site/${siteSlug}`} className="flex items-center gap-2">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.firmName} className="h-8" />
          ) : (
            <span className="text-xl font-bold" style={{ color: settings.primaryColor }}>
              {settings.firmName || "Law Firm"}
            </span>
          )}
        </a>
        <div className="hidden md:flex items-center gap-6">
          {pages.map((p: any) => (
            <a
              key={p.id}
              href={`/site/${siteSlug}/${p.slug}`}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {p.title}
            </a>
          ))}
          <a
            href="/book"
            className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: settings.primaryColor }}
          >
            Schedule Consultation
          </a>
        </div>
      </div>
    </nav>
  );
}

function SiteFooter({ settings }: { settings: any }) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-gray-900 text-white py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-lg font-semibold mb-3">{settings.firmName || "Law Firm"}</h3>
            {settings.tagline && <p className="text-gray-400 text-sm">{settings.tagline}</p>}
          </div>
          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <div className="space-y-1 text-sm text-gray-400">
              {settings.phone && <p>{settings.phone}</p>}
              {settings.email && <p>{settings.email}</p>}
              {settings.address && (
                <p>
                  {settings.address}
                  {settings.city && `, ${settings.city}`}
                  {settings.state && `, ${settings.state}`}
                  {settings.zip && ` ${settings.zip}`}
                </p>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Follow Us</h4>
            <div className="flex gap-4 text-sm">
              {settings.linkedinUrl && <a href={settings.linkedinUrl} className="text-gray-400 hover:text-white">LinkedIn</a>}
              {settings.facebookUrl && <a href={settings.facebookUrl} className="text-gray-400 hover:text-white">Facebook</a>}
              {settings.twitterUrl && <a href={settings.twitterUrl} className="text-gray-400 hover:text-white">X/Twitter</a>}
              {settings.googleReviewsUrl && <a href={settings.googleReviewsUrl} className="text-gray-400 hover:text-white">Reviews</a>}
            </div>
          </div>
        </div>
        {settings.footerText && (
          <div className="text-sm text-gray-500 mb-4" dangerouslySetInnerHTML={{ __html: settings.footerText }} />
        )}
        <div className="border-t border-gray-800 pt-4 text-center text-sm text-gray-500">
          © {year} {settings.firmName || "Law Firm"}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
