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
import { BlockRenderer } from "@/components/website/block-renderer";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  Image,
  MessageSquare,
  Users,
  Phone,
  Star,
  Megaphone,
  BookOpen,
  Code,
  Minus,
} from "lucide-react";

const BLOCK_TYPES = [
  { type: "hero", label: "Hero Banner", icon: "🎯" },
  { type: "text", label: "Text", icon: "📝" },
  { type: "practiceAreaGrid", label: "Practice Areas", icon: "⚖️" },
  { type: "attorneyProfile", label: "Attorney Profile", icon: "👤" },
  { type: "contactForm", label: "Contact Form", icon: "📞" },
  { type: "testimonialCarousel", label: "Testimonials", icon: "💬" },
  { type: "callToAction", label: "Call to Action", icon: "📢" },
  { type: "blogLatest", label: "Latest Blog Posts", icon: "📰" },
  { type: "freeText", label: "Free HTML", icon: "🖥️" },
  { type: "spacer", label: "Spacer", icon: "↕️" },
];

function getDefaultBlockData(type: string): any {
  switch (type) {
    case "hero": return { headline: "Your Headline", subheadline: "Your subheadline", ctaText: "Contact Us", ctaLink: "/contact" };
    case "text": return { content: "<p>Enter your content here.</p>" };
    case "practiceAreaGrid": return { areas: [{ name: "Practice Area", description: "Description" }] };
    case "attorneyProfile": return { name: "Attorney Name", title: "Partner", bio: "Bio here." };
    case "contactForm": return {};
    case "testimonialCarousel": return {};
    case "callToAction": return { text: "Ready to get started?", buttonText: "Contact Us", buttonLink: "/contact" };
    case "blogLatest": return { count: 6 };
    case "freeText": return { html: "" };
    case "spacer": return { height: 40 };
    default: return {};
  }
}

export default function PageEditor() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const { data: page, isLoading } = trpc.website.getPage.useQuery({ id });
  const { data: settings } = trpc.website.getSettings.useQuery();
  const updatePage = trpc.website.updatePage.useMutation({
    onSuccess: () => toast({ title: "Page saved" }),
  });

  const [blocks, setBlocks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddBlock, setShowAddBlock] = useState(false);

  useEffect(() => {
    if (page) {
      setTitle(page.title);
      try { setBlocks(JSON.parse(page.content)); } catch { setBlocks([]); }
    }
  }, [page]);

  const handleSave = () => {
    updatePage.mutate({ id, title, content: JSON.stringify(blocks) });
  };

  const addBlock = (type: string) => {
    setBlocks([...blocks, { type, data: getDefaultBlockData(type) }]);
    setEditingIndex(blocks.length);
    setShowAddBlock(false);
  };

  const removeBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
    setEditingIndex(newIndex);
  };

  const updateBlockData = (index: number, data: any) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], data };
    setBlocks(newBlocks);
  };

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/website"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold border-none shadow-none p-0 h-auto" />
            <p className="text-xs text-gray-400">/{page?.slug}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={updatePage.isPending} className="bg-blue-500 hover:bg-blue-600">
          <Save className="h-4 w-4 mr-2" /> Save
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Block Editor (left) */}
        <div className="lg:col-span-3 space-y-3">
          {blocks.map((block, i) => (
            <div
              key={i}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                editingIndex === i ? "border-blue-500 ring-1 ring-blue-500" : "border-gray-100"
              }`}
            >
              {/* Block header */}
              <div
                className="flex items-center gap-3 px-4 py-2 bg-gray-50 cursor-pointer"
                onClick={() => setEditingIndex(editingIndex === i ? null : i)}
              >
                <span className="text-lg">{BLOCK_TYPES.find((t) => t.type === block.type)?.icon || "📄"}</span>
                <span className="text-sm font-medium text-gray-700 flex-1">
                  {BLOCK_TYPES.find((t) => t.type === block.type)?.label || block.type}
                </span>
                <button onClick={(e) => { e.stopPropagation(); moveBlock(i, -1); }} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveBlock(i, 1); }} disabled={i === blocks.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeBlock(i); }} className="p-1 text-red-400 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Block editor */}
              {editingIndex === i && (
                <div className="p-4 space-y-3">
                  <BlockEditor type={block.type} data={block.data} onChange={(data) => updateBlockData(i, data)} />
                </div>
              )}
            </div>
          ))}

          {/* Add Block */}
          {showAddBlock ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Block</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {BLOCK_TYPES.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                  >
                    <span className="text-xl">{bt.icon}</span>
                    <span className="text-xs font-medium text-gray-600">{bt.label}</span>
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowAddBlock(false)} className="mt-2">Cancel</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddBlock(true)} className="w-full border-dashed">
              <Plus className="h-4 w-4 mr-2" /> Add Block
            </Button>
          )}
        </div>

        {/* Live Preview (right) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500">Preview</div>
            <div className="overflow-auto max-h-[80vh]" style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "auto" }}>
              {settings && (
                <BlockRenderer
                  blocks={blocks}
                  settings={{ ...settings, siteSlug: settings.siteSlug || "" }}
                  testimonials={[]}
                  blogPosts={[]}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockEditor({ type, data, onChange }: { type: string; data: any; onChange: (data: any) => void }) {
  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  switch (type) {
    case "hero":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Headline</Label><Input value={data.headline || ""} onChange={(e) => set("headline", e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Subheadline</Label><Input value={data.subheadline || ""} onChange={(e) => set("subheadline", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">CTA Text</Label><Input value={data.ctaText || ""} onChange={(e) => set("ctaText", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">CTA Link</Label><Input value={data.ctaLink || ""} onChange={(e) => set("ctaLink", e.target.value)} /></div>
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-1">
          <Label className="text-xs">Content (HTML)</Label>
          <Textarea value={data.content || ""} onChange={(e) => set("content", e.target.value)} rows={8} className="font-mono text-sm" />
        </div>
      );
    case "practiceAreaGrid": {
      const areas = data.areas || [];
      return (
        <div className="space-y-3">
          {areas.map((area: any, i: number) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <Input placeholder="Name" value={area.name || ""} onChange={(e) => {
                  const newAreas = [...areas];
                  newAreas[i] = { ...newAreas[i], name: e.target.value };
                  set("areas", newAreas);
                }} />
                <Input placeholder="Description" value={area.description || ""} onChange={(e) => {
                  const newAreas = [...areas];
                  newAreas[i] = { ...newAreas[i], description: e.target.value };
                  set("areas", newAreas);
                }} />
              </div>
              <button onClick={() => set("areas", areas.filter((_: any, j: number) => j !== i))} className="p-1 text-red-400 mt-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("areas", [...areas, { name: "", description: "" }])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Area
          </Button>
        </div>
      );
    }
    case "attorneyProfile":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={data.name || ""} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Title</Label><Input value={data.title || ""} onChange={(e) => set("title", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Bio</Label><Textarea value={data.bio || ""} onChange={(e) => set("bio", e.target.value)} rows={4} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Education</Label><Input value={data.education || ""} onChange={(e) => set("education", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Bar Admissions</Label><Input value={data.barAdmissions || ""} onChange={(e) => set("barAdmissions", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Photo URL</Label><Input value={data.photo || ""} onChange={(e) => set("photo", e.target.value)} /></div>
        </div>
      );
    case "contactForm":
      return <p className="text-sm text-gray-500">Contact form will be rendered automatically.</p>;
    case "testimonialCarousel":
      return <p className="text-sm text-gray-500">Testimonials will be pulled from your testimonial list automatically.</p>;
    case "callToAction":
      return (
        <div className="space-y-3">
          <div className="space-y-1"><Label className="text-xs">Text</Label><Input value={data.text || ""} onChange={(e) => set("text", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">Button Text</Label><Input value={data.buttonText || ""} onChange={(e) => set("buttonText", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Button Link</Label><Input value={data.buttonLink || ""} onChange={(e) => set("buttonLink", e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Background Color</Label><Input value={data.backgroundColor || ""} onChange={(e) => set("backgroundColor", e.target.value)} placeholder="Leave empty for primary color" /></div>
        </div>
      );
    case "blogLatest":
      return (
        <div className="space-y-1">
          <Label className="text-xs">Number of posts to show</Label>
          <Input type="number" value={data.count || 6} onChange={(e) => set("count", parseInt(e.target.value) || 6)} className="w-24" />
        </div>
      );
    case "freeText":
      return (
        <div className="space-y-1">
          <Label className="text-xs">HTML Content</Label>
          <Textarea value={data.html || ""} onChange={(e) => set("html", e.target.value)} rows={8} className="font-mono text-sm" />
        </div>
      );
    case "spacer":
      return (
        <div className="space-y-1">
          <Label className="text-xs">Height (px)</Label>
          <Input type="number" value={data.height || 40} onChange={(e) => set("height", parseInt(e.target.value) || 40)} className="w-24" />
        </div>
      );
    default:
      return <p className="text-sm text-gray-500">No editor for this block type.</p>;
  }
}
