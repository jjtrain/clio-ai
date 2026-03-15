"use client";

interface Block {
  type: string;
  data: any;
}

interface BlockRendererProps {
  blocks: Block[];
  settings: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    firmName?: string | null;
    phone?: string | null;
    email?: string | null;
    siteSlug: string;
  };
  testimonials?: any[];
  blogPosts?: any[];
}

function HeroBlock({ data, settings }: { data: any; settings: any }) {
  return (
    <section
      className="relative py-24 px-6 text-center text-white"
      style={{ background: `linear-gradient(135deg, ${settings.primaryColor}, ${settings.secondaryColor})` }}
    >
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{data.headline}</h1>
        <p className="text-xl md:text-2xl opacity-90 mb-8">{data.subheadline}</p>
        {data.ctaText && (
          <a
            href={data.ctaLink || "#"}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            {data.ctaText}
          </a>
        )}
      </div>
    </section>
  );
}

function TextBlock({ data }: { data: any }) {
  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto prose prose-lg" dangerouslySetInnerHTML={{ __html: data.content }} />
    </section>
  );
}

function PracticeAreaGridBlock({ data, settings }: { data: any; settings: any }) {
  const areas = data.areas || [];
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Practice Areas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map((area: any, i: number) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg mb-4"
                style={{ backgroundColor: settings.secondaryColor }}
              >
                {area.name?.[0] || "•"}
              </div>
              <h3 className="text-lg font-semibold mb-2">{area.name}</h3>
              <p className="text-gray-600 text-sm">{area.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AttorneyProfileBlock({ data }: { data: any }) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-8 items-start">
        <div className="w-48 h-48 bg-gray-200 rounded-xl flex-shrink-0 flex items-center justify-center text-4xl text-gray-400">
          {data.photo ? (
            <img src={data.photo} alt={data.name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            data.name?.[0] || "?"
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-1">{data.name}</h3>
          <p className="text-gray-500 mb-4">{data.title}</p>
          <p className="text-gray-700 mb-4">{data.bio}</p>
          {data.education && (
            <p className="text-sm text-gray-500"><strong>Education:</strong> {data.education}</p>
          )}
          {data.barAdmissions && (
            <p className="text-sm text-gray-500"><strong>Bar Admissions:</strong> {data.barAdmissions}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactFormBlock({ data, settings }: { data: any; settings: any }) {
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
          <h3 className="text-xl font-semibold mb-6">Send Us a Message</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert("Thank you for your message! We will be in touch shortly.");
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" placeholder="Your Name" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              <input type="email" placeholder="Your Email" required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <input type="tel" placeholder="Phone Number" className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <textarea placeholder="How can we help you?" rows={5} required className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
            <button
              type="submit"
              className="w-full py-3 rounded-lg text-white font-semibold transition-colors"
              style={{ backgroundColor: settings.primaryColor }}
            >
              Send Message
            </button>
          </form>
        </div>
        {settings.phone && (
          <p className="text-center text-gray-500 mt-6">
            Or call us at <a href={`tel:${settings.phone}`} className="font-semibold text-gray-900">{settings.phone}</a>
          </p>
        )}
      </div>
    </section>
  );
}

function TestimonialCarouselBlock({ testimonials, settings }: { testimonials: any[]; settings: any }) {
  if (!testimonials || testimonials.length === 0) {
    return (
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">What Our Clients Say</h2>
          <p className="text-gray-500">Testimonials coming soon.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="py-16 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">What Our Clients Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              {t.rating && (
                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <span key={s} className={s < t.rating ? "text-yellow-400" : "text-gray-200"}>★</span>
                  ))}
                </div>
              )}
              <p className="text-gray-700 mb-4 italic">"{t.content}"</p>
              <p className="font-semibold text-gray-900">{t.clientName}</p>
              {t.practiceArea && <p className="text-sm text-gray-500">{t.practiceArea}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToActionBlock({ data, settings }: { data: any; settings: any }) {
  const bgColor = data.backgroundColor || settings.primaryColor;
  return (
    <section className="py-16 px-6 text-center text-white" style={{ backgroundColor: bgColor }}>
      <div className="max-w-3xl mx-auto">
        <p className="text-xl md:text-2xl font-semibold mb-6">{data.text}</p>
        {data.buttonText && (
          <a
            href={data.buttonLink || "#"}
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {data.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function BlogLatestBlock({ blogPosts, settings }: { blogPosts: any[]; settings: any }) {
  if (!blogPosts || blogPosts.length === 0) {
    return (
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Latest from Our Blog</h2>
          <p className="text-gray-500">No blog posts yet.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">Latest from Our Blog</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {blogPosts.map((post) => (
            <a
              key={post.id}
              href={`/site/${settings.siteSlug}/blog/${post.slug}`}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              {post.coverImageUrl && (
                <img src={post.coverImageUrl} alt={post.title} className="w-full h-48 object-cover" />
              )}
              <div className="p-5">
                <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
                {post.excerpt && <p className="text-gray-600 text-sm mb-3 line-clamp-3">{post.excerpt}</p>}
                <p className="text-xs text-gray-400">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function FreeTextBlock({ data }: { data: any }) {
  return (
    <section className="py-8 px-6">
      <div className="max-w-4xl mx-auto" dangerouslySetInnerHTML={{ __html: data.html || "" }} />
    </section>
  );
}

function SpacerBlock({ data }: { data: any }) {
  return <div style={{ height: data.height || 40 }} />;
}

export function BlockRenderer({ blocks, settings, testimonials = [], blogPosts = [] }: BlockRendererProps) {
  return (
    <div>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "hero":
            return <HeroBlock key={i} data={block.data} settings={settings} />;
          case "text":
            return <TextBlock key={i} data={block.data} />;
          case "practiceAreaGrid":
            return <PracticeAreaGridBlock key={i} data={block.data} settings={settings} />;
          case "attorneyProfile":
            return <AttorneyProfileBlock key={i} data={block.data} />;
          case "contactForm":
            return <ContactFormBlock key={i} data={block.data} settings={settings} />;
          case "testimonialCarousel":
            return <TestimonialCarouselBlock key={i} testimonials={testimonials} settings={settings} />;
          case "callToAction":
            return <CallToActionBlock key={i} data={block.data} settings={settings} />;
          case "blogLatest":
            return <BlogLatestBlock key={i} blogPosts={blogPosts} settings={settings} />;
          case "freeText":
            return <FreeTextBlock key={i} data={block.data} />;
          case "spacer":
            return <SpacerBlock key={i} data={block.data} />;
          default:
            return <div key={i} className="py-4 px-6 text-gray-400 text-center">Unknown block: {block.type}</div>;
        }
      })}
    </div>
  );
}
