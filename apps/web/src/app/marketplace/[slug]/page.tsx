"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Star, Package, FileText, User, ShieldCheck } from "lucide-react";

function Stars({ rating, size = "sm" }: { rating: number; size?: string }) {
  return (
    <span className={size === "lg" ? "text-lg" : "text-sm"}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? "text-yellow-400" : "text-gray-300"}>★</span>
      ))}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    contract: "bg-blue-100 text-blue-700",
    pleading: "bg-purple-100 text-purple-700",
    letter: "bg-amber-100 text-amber-700",
    form: "bg-teal-100 text-teal-700",
    checklist: "bg-pink-100 text-pink-700",
  };
  return (
    <Badge className={`${colors[type] ?? "bg-gray-100 text-gray-700"} border-0 text-xs`}>
      {type}
    </Badge>
  );
}

export default function PackageDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { data: pkg, isLoading } = trpc.marketplace["getPackage"].useQuery({ slug });

  const purchase = trpc.marketplace["purchase"].useMutation({
    onSuccess: () => {
      toast({ title: "Success!", description: "Package has been added to your library." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <div className="max-w-7xl mx-auto px-6 py-10 text-gray-400">Loading...</div>;
  if (!pkg) return <div className="max-w-7xl mx-auto px-6 py-10 text-gray-400">Package not found.</div>;

  const isFree = Number(pkg.price) === 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex gap-8">
        {/* Main */}
        <div className="flex-1 space-y-8">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{pkg.name}</h1>
              <Badge variant="outline">{pkg.practiceArea}</Badge>
              {isFree && <Badge className="bg-green-100 text-green-700 border-0">Free</Badge>}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {pkg.publisherName}</span>
              <Stars rating={Number(pkg.averageRating ?? 0)} />
              <span>({pkg.reviewCount} reviews)</span>
            </div>
          </div>

          {/* Description */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{pkg.description}</p>
          </section>

          {/* What's Included */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="h-4 w-4" /> What&apos;s Included ({pkg.items?.length ?? 0} templates)
            </h2>
            <ul className="space-y-3">
              {pkg.items?.map((tpl: any) => (
                <li key={tpl.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <FileText className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">{tpl.name}</span>
                      <TypeBadge type={tpl.type} />
                    </div>
                    {tpl.preview && (
                      <p className="text-xs text-gray-400 line-clamp-2 font-mono">{tpl.preview}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Reviews */}
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Reviews</h2>
            {pkg.reviews?.length === 0 && <p className="text-sm text-gray-400">No reviews yet.</p>}
            <div className="space-y-4">
              {pkg.reviews?.map((review: any) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{review.authorName}</span>
                    <Stars rating={review.rating} />
                  </div>
                  <p className="text-sm text-gray-600">{review.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right panel */}
        <aside className="w-72 shrink-0">
          <div className="sticky top-6 bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div className="text-center">
              {isFree ? (
                <span className="text-2xl font-bold text-green-600">Free</span>
              ) : (
                <span className="text-2xl font-bold text-gray-900">${Number(pkg.price).toFixed(2)}</span>
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => purchase.mutate({ packageId: pkg.id, buyerEmail: "user@firm.com" })}
              disabled={purchase.isPending}
            >
              {purchase.isPending ? "Processing..." : isFree ? "Install Free" : "Purchase"}
            </Button>
            <div className="text-sm text-gray-500 space-y-2">
              <div className="flex items-center justify-between">
                <span>Templates</span>
                <span className="font-medium text-gray-900">{pkg.items?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rating</span>
                <span className="font-medium text-gray-900">{Number(pkg.averageRating ?? 0)?.toFixed(1)}</span>
              </div>
            </div>
            <hr className="border-gray-100" />
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{pkg.publisherName}</p>
                <p className="text-xs text-gray-400">Verified Publisher</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
