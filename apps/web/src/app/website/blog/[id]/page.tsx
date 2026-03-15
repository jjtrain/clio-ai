"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";

export default function EditBlogPost() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: post, isLoading } = trpc.website.getPost.useQuery({ id });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setExcerpt(post.excerpt || "");
      setAuthor(post.author || "");
      setCoverImageUrl(post.coverImageUrl || "");
      try {
        const parsedTags = post.tags ? JSON.parse(post.tags) : [];
        setTags(parsedTags.join(", "));
      } catch { setTags(""); }
    }
  }, [post]);

  const updatePost = trpc.website.updatePost.useMutation({
    onSuccess: () => toast({ title: "Post saved" }),
  });
  const publishPost = trpc.website.publishPost.useMutation({
    onSuccess: () => { toast({ title: "Post published" }); router.push("/website/blog"); },
  });
  const unpublishPost = trpc.website.unpublishPost.useMutation({
    onSuccess: () => toast({ title: "Post unpublished" }),
  });

  const handleSave = async () => {
    const tagsJson = tags ? JSON.stringify(tags.split(",").map((t) => t.trim()).filter(Boolean)) : undefined;
    await updatePost.mutateAsync({
      id, title, content, excerpt: excerpt || undefined,
      author: author || undefined, coverImageUrl: coverImageUrl || undefined, tags: tagsJson,
    });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>;
  if (!post) return <div className="py-20 text-center text-gray-500">Post not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/website/blog"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">Edit Post</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${post.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
            {post.isPublished ? "Published" : "Draft"}
          </span>
        </div>
        <div className="flex gap-2">
          {post.isPublished ? (
            <Button variant="outline" size="sm" onClick={() => unpublishPost.mutate({ id })}>
              <EyeOff className="h-4 w-4 mr-1" /> Unpublish
            </Button>
          ) : (
            <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => publishPost.mutate({ id })}>
              <Eye className="h-4 w-4 mr-1" /> Publish
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Slug</Label><Input value={post.slug} disabled className="bg-gray-50" /></div>
          <div className="space-y-2"><Label>Author</Label><Input value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
          <div className="space-y-2"><Label>Cover Image URL</Label><Input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>Excerpt</Label><Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} /></div>
        <div className="space-y-2"><Label>Content (HTML)</Label><Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={20} className="font-mono text-sm" /></div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updatePost.isPending} className="bg-blue-500 hover:bg-blue-600">
          <Save className="h-4 w-4 mr-2" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
