// Dynamic sitemap for web magazine articles. The site is a static export
// (output: "export"), so generateStaticParams() only knows about posts that
// existed at the last frontend build — but articles are published
// continuously by backend bots with no frontend rebuild involved. A static
// sitemap.xml would go stale immediately, so this function queries the
// backend for the live published list on every request instead.
//
// Served at /sitemap-blog.xml via the redirect rule in netlify.toml.

exports.handler = async () => {
  const backendUrl =
    process.env.BACKEND_URL || 'https://ai119-bot-production.up.railway.app';
  const siteUrl = 'https://ai119.netlify.app';

  let posts = [];
  try {
    const res = await fetch(`${backendUrl}/api/blog/posts`);
    if (res.ok) {
      posts = await res.json();
    }
  } catch (err) {
    console.error('[blog-sitemap] fetch error:', err);
  }

  const urls = [
    `  <url>\n    <loc>${siteUrl}/blog</loc>\n    <changefreq>hourly</changefreq>\n  </url>`,
    ...posts.map((post) => {
      const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().slice(0, 10) : '';
      return `  <url>\n    <loc>${siteUrl}/blog/${post.slug}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n    <changefreq>weekly</changefreq>\n  </url>`;
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: xml,
  };
};
