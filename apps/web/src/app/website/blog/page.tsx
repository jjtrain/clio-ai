"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  BookOpen,
} from "lucide-react";

export default function BlogManagement() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.website.listPosts.useQuery({});

  const publishPost = trpc.website.publishPost.useMutation({
    onSuccess: () => { toast({ title: "Post published" }); utils.website.listPosts.invalidate(); },
  });
  const unpublishPost = trpc.website.unpublishPost.useMutation({
    onSuccess: () => { toast({ title: "Post unpublished" }); utils.website.listPosts.invalidate(); },
  });
  const deletePost = trpc.website.deletePost.useMutation({
    onSuccess: () => { toast({ title: "Post deleted" }); utils.website.listPosts.invalidate(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/website"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Blog Posts</h1>
            <p className="text-gray-500">Manage your firm's blog content</p>
          </div>
        </div>
        <Button asChild className="bg-blue-500 hover:bg-blue-600">
          <Link href="/website/blog/new"><Plus className="h-4 w-4 mr-2" /> New Post</Link>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !data || data.posts.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No blog posts yet</h3>
            <p className="text-gray-500 mb-4">Start writing content for your website</p>
            <Button asChild className="bg-blue-500 hover:bg-blue-600">
              <Link href="/website/blog/new"><Plus className="h-4 w-4 mr-2" /> New Post</Link>
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Title</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Published</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map((post) => (
                <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{post.title}</span>
                    <p className="text-xs text-gray-400">/{post.slug}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      post.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {post.isPublished ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/website/blog/${post.id}`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                      {post.isPublished ? (
                        <Button variant="ghost" size="sm" onClick={() => unpublishPost.mutate({ id: post.id })}>
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => publishPost.mutate({ id: post.id })}>
                          <Eye className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Delete this post?")) deletePost.mutate({ id: post.id });
                      }}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
