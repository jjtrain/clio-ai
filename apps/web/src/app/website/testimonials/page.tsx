"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Star,
  MessageSquare,
  X,
} from "lucide-react";

export default function TestimonialsManagement() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: testimonials, isLoading } = trpc.website.listTestimonials.useQuery();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [clientName, setClientName] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(5);
  const [practiceArea, setPracticeArea] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  const createTestimonial = trpc.website.createTestimonial.useMutation({
    onSuccess: () => {
      toast({ title: "Testimonial added" });
      utils.website.listTestimonials.invalidate();
      resetForm();
    },
  });
  const updateTestimonial = trpc.website.updateTestimonial.useMutation({
    onSuccess: () => {
      toast({ title: "Testimonial updated" });
      utils.website.listTestimonials.invalidate();
      resetForm();
    },
  });
  const deleteTestimonial = trpc.website.deleteTestimonial.useMutation({
    onSuccess: () => { toast({ title: "Deleted" }); utils.website.listTestimonials.invalidate(); },
  });

  const resetForm = () => {
    setClientName(""); setContent(""); setRating(5); setPracticeArea(""); setIsPublished(true);
    setShowAdd(false); setEditId(null);
  };

  const startEdit = (t: any) => {
    setEditId(t.id);
    setClientName(t.clientName);
    setContent(t.content);
    setRating(t.rating || 5);
    setPracticeArea(t.practiceArea || "");
    setIsPublished(t.isPublished);
    setShowAdd(true);
  };

  const handleSubmit = () => {
    if (!clientName || !content) return;
    if (editId) {
      updateTestimonial.mutate({ id: editId, clientName, content, rating, practiceArea: practiceArea || undefined, isPublished });
    } else {
      createTestimonial.mutate({ clientName, content, rating, practiceArea: practiceArea || undefined, isPublished });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/website"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Testimonials</h1>
            <p className="text-gray-500">Manage client testimonials for your website</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setShowAdd(true); }} className="bg-blue-500 hover:bg-blue-600">
          <Plus className="h-4 w-4 mr-2" /> Add Testimonial
        </Button>
      </div>

      {/* Add/Edit Dialog */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editId ? "Edit" : "Add"} Testimonial</h2>
            <button onClick={resetForm}><X className="h-5 w-5 text-gray-400" /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Name <span className="text-red-500">*</span></Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Practice Area</Label>
              <Input value={practiceArea} onChange={(e) => setPracticeArea(e.target.value)} placeholder="Family Law" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Testimonial <span className="text-red-500">*</span></Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
          </div>
          <div className="flex items-center gap-6">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className={`text-2xl ${s <= rating ? "text-yellow-400" : "text-gray-200"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="published" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              <Label htmlFor="published">Published</Label>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={!clientName || !content} className="bg-blue-500 hover:bg-blue-600">
            {editId ? "Update" : "Add"} Testimonial
          </Button>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : !testimonials || testimonials.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No testimonials yet</h3>
          <p className="text-gray-500">Add client testimonials to display on your website</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              {t.rating && (
                <div className="flex mb-2">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <span key={s} className={`text-sm ${s < t.rating! ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                  ))}
                </div>
              )}
              <p className="text-gray-700 text-sm mb-3 line-clamp-4 italic">"{t.content}"</p>
              <p className="font-semibold text-sm">{t.clientName}</p>
              {t.practiceArea && <p className="text-xs text-gray-400">{t.practiceArea}</p>}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.isPublished ? "Published" : "Draft"}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(t)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (confirm("Delete?")) deleteTestimonial.mutate({ id: t.id });
                  }}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
