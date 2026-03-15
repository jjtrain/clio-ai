"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Eye } from "lucide-react";

export default function NewBlogPost() {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tags, setTags] = useState("");

  const createPost = trpc.website.createPost.useMutation();
  const publishPost = trpc.website.publishPost.useMutation();

  const handleSave = async (publish: boolean) => {
    if (!title || !content) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    try {
      const tagsJson = tags ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)) : undefined;
      const post = await createPost.mutateAsync({
        title, slug: slug || undefined, content, excerpt: excerpt || undefined,
        author: author || undefined, coverImageUrl: coverImageUrl || undefined, tags: tagsJson,
      });
      if (publish) {
        await publishPost.mutateAsync({ id: post.id });
        toast({ title: "Post published" });
      } else {
        toast({ title: "Draft saved" });
      }
      router.push("/website/blog");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/website/blog"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">New Blog Post</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Title <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={(e) => {
              setTitle(e.target.value);
              if (!slug) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
            }} placeholder="Blog post title" />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated-from-title" />
          </div>
          <div className="space-y-2">
            <Label>Author</Label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" />
          </div>
          <div className="space-y-2">
            <Label>Cover Image URL</Label>
            <Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Tags (comma-separated)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Legal Tips, Family Law, Updates" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Excerpt</Label>
          <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="Brief summary for listings" />
        </div>

        <div className="space-y-2">
          <Label>Content (HTML) <span className="text-red-500">*</span></Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} className="font-mono text-sm" placeholder="<h2>...</h2><p>...</p>" />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={createPost.isPending}>
          <Save className="h-4 w-4 mr-2" /> Save Draft
        </Button>
        <Button onClick={() => handleSave(true)} disabled={createPost.isPending || publishPost.isPending} className="bg-green-500 hover:bg-green-600">
          <Eye className="h-4 w-4 mr-2" /> Publish
        </Button>
      </div>
    </div>
  );
}
