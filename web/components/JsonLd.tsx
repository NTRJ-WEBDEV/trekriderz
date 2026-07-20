// Renders any schema.org object built by web/lib/seo.ts as a <script>
// tag. One component for every JSON-LD block on the site, instead of
// hand-writing <script dangerouslySetInnerHTML> per page.
export default function JsonLd({ data }: { data: object | object[] }) {
  const items = Array.isArray(data) ? data : [data];
  return (
    <>
      {items.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
