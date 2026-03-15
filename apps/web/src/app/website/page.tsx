"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Globe,
  Eye,
  ExternalLink,
  FileText,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Save,
} from "lucide-react";

const pageTypeIcons: Record<string, string> = {
  HOME: "🏠",
  ABOUT: "👥",
  PRACTICE_AREAS: "⚖️",
  CONTACT: "📞",
  TESTIMONIALS: "💬",
  BLOG: "📝",
  CUSTOM: "📄",
};

export default function WebsiteDashboard() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<"pages" | "settings">("pages");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");

  const { data: settings, isLoading } = trpc.website.getSettings.useQuery();
  const { data: pages } = trpc.website.listPages.useQuery();

  // Settings form state
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        siteSlug: settings.siteSlug || "",
        firmName: settings.firmName || "",
        tagline: settings.tagline || "",
        primaryColor: settings.primaryColor || "#1E40AF",
        secondaryColor: settings.secondaryColor || "#3B82F6",
        fontFamily: settings.fontFamily || "Inter",
        phone: settings.phone || "",
        email: settings.email || "",
        address: settings.address || "",
        city: settings.city || "",
        state: settings.state || "",
        zip: settings.zip || "",
        linkedinUrl: settings.linkedinUrl || "",
        facebookUrl: settings.facebookUrl || "",
        twitterUrl: settings.twitterUrl || "",
        googleReviewsUrl: settings.googleReviewsUrl || "",
        metaTitle: settings.metaTitle || "",
        metaDescription: settings.metaDescription || "",
        footerText: settings.footerText || "",
      });
    }
  }, [settings]);

  const publish = trpc.website.publish.useMutation({
    onSuccess: () => { toast({ title: "Website published" }); utils.website.getSettings.invalidate(); },
  });
  const unpublish = trpc.website.unpublish.useMutation({
    onSuccess: () => { toast({ title: "Website unpublished" }); utils.website.getSettings.invalidate(); },
  });
  const updateSettings = trpc.website.updateSettings.useMutation({
    onSuccess: () => { toast({ title: "Settings saved" }); utils.website.getSettings.invalidate(); },
  });
  const createPage = trpc.website.createPage.useMutation({
    onSuccess: () => {
      toast({ title: "Page created" });
      utils.website.listPages.invalidate();
      setNewPageTitle("");
      setNewPageSlug("");
    },
  });
  const updatePage = trpc.website.updatePage.useMutation({
    onSuccess: () => utils.website.listPages.invalidate(),
  });
  const deletePage = trpc.website.deletePage.useMutation({
    onSuccess: () => { toast({ title: "Page deleted" }); utils.website.listPages.invalidate(); },
  });

  const setField = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Website Builder</h1>
          <p className="text-gray-500">Build and manage your law firm's website</p>
        </div>
        <div className="flex items-center gap-3">
          {settings?.isPublished ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Published
              </span>
              <Button variant="outline" size="sm" onClick={() => unpublish.mutate()}>Unpublish</Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <XCircle className="h-3.5 w-3.5" /> Unpublished
              </span>
              <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => publish.mutate()}>
                Publish
              </Button>
            </div>
          )}
          {settings?.siteSlug && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/site/${settings.siteSlug}`} target="_blank">
                <ExternalLink className="h-4 w-4 mr-1" /> Visit Site
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/website/blog"><BookOpen className="h-4 w-4 mr-1" /> Blog</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/website/testimonials"><MessageSquare className="h-4 w-4 mr-1" /> Testimonials</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {(["pages", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Pages Tab */}
      {tab === "pages" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {pages && pages.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {pages.map((page) => (
                  <div key={page.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                    <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    <span className="text-lg">{pageTypeIcons[page.pageType] || "📄"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{page.title}</span>
                      <span className="text-xs text-gray-400 ml-2">/{page.slug}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{page.pageType}</span>
                    <button
                      onClick={() => updatePage.mutate({ id: page.id, isPublished: !page.isPublished })}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        page.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {page.isPublished ? "Published" : "Draft"}
                    </button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/website/pages/${page.id}`}>
                        <Edit className="h-4 w-4" />
                      </Link>
                    </Button>
                    {page.pageType === "CUSTOM" && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm("Delete this page?")) deletePage.mutate({ id: page.id });
                      }}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400">Loading pages...</div>
            )}
          </div>

          {/* Add Custom Page */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Custom Page</h3>
            <div className="flex gap-3">
              <Input placeholder="Page title" value={newPageTitle} onChange={(e) => {
                setNewPageTitle(e.target.value);
                setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
              }} className="flex-1" />
              <Input placeholder="slug" value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} className="w-40" />
              <Button onClick={() => {
                if (newPageTitle && newPageSlug) createPage.mutate({ title: newPageTitle, slug: newPageSlug });
              }} disabled={!newPageTitle || !newPageSlug}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-6">
          {/* Branding */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Branding</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Site Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">/site/</span>
                  <Input value={form.siteSlug} onChange={(e) => setField("siteSlug", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Firm Name</Label>
                <Input value={form.firmName} onChange={(e) => setField("firmName", e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Tagline</Label>
                <Input value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} placeholder="Experienced Legal Representation" />
              </div>
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primaryColor} onChange={(e) => setField("primaryColor", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.primaryColor} onChange={(e) => setField("primaryColor", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.secondaryColor} onChange={(e) => setField("secondaryColor", e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.secondaryColor} onChange={(e) => setField("secondaryColor", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={form.fontFamily} onValueChange={(v) => setField("fontFamily", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Merriweather">Merriweather</SelectItem>
                    <SelectItem value="Lora">Lora</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Contact Info</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setField("email", e.target.value)} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setField("address", e.target.value)} /></div>
              <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setField("city", e.target.value)} /></div>
              <div className="flex gap-4">
                <div className="space-y-2 flex-1"><Label>State</Label><Input value={form.state} onChange={(e) => setField("state", e.target.value)} /></div>
                <div className="space-y-2 w-28"><Label>ZIP</Label><Input value={form.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
              </div>
            </div>
          </div>

          {/* Social */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Social Links</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>LinkedIn</Label><Input value={form.linkedinUrl} onChange={(e) => setField("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/..." /></div>
              <div className="space-y-2"><Label>Facebook</Label><Input value={form.facebookUrl} onChange={(e) => setField("facebookUrl", e.target.value)} placeholder="https://facebook.com/..." /></div>
              <div className="space-y-2"><Label>X / Twitter</Label><Input value={form.twitterUrl} onChange={(e) => setField("twitterUrl", e.target.value)} placeholder="https://x.com/..." /></div>
              <div className="space-y-2"><Label>Google Reviews</Label><Input value={form.googleReviewsUrl} onChange={(e) => setField("googleReviewsUrl", e.target.value)} /></div>
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">SEO</h2>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Meta Title</Label><Input value={form.metaTitle} onChange={(e) => setField("metaTitle", e.target.value)} /></div>
              <div className="space-y-2"><Label>Meta Description</Label><Textarea value={form.metaDescription} onChange={(e) => setField("metaDescription", e.target.value)} rows={3} /></div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">Footer</h2>
            <div className="space-y-2"><Label>Custom Footer Text (HTML)</Label><Textarea value={form.footerText} onChange={(e) => setField("footerText", e.target.value)} rows={3} /></div>
          </div>

          <Button onClick={() => updateSettings.mutate(form)} disabled={updateSettings.isPending} className="bg-blue-500 hover:bg-blue-600">
            <Save className="h-4 w-4 mr-2" /> Save Settings
          </Button>
        </div>
      )}
    </div>
  );
}
