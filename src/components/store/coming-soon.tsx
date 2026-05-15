'use client';

export function ComingSoon({ store }: { store: any }) {
  const title = store.comingSoonTitle || 'Something exciting is coming soon';
  const message = store.comingSoonMessage || "We're working hard to bring you something amazing. Check back soon!";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-white">
      {store.comingSoonImageUrl && (
        <div className="w-full max-w-2xl mb-8 rounded-xl overflow-hidden">
          <img src={store.comingSoonImageUrl} alt="Coming soon" className="w-full object-cover" />
        </div>
      )}
      {title && (
        <p className="text-xl font-semibold mb-2">{title}</p>
      )}
      {message && (
        <p className="text-muted-foreground max-w-md">{message}</p>
      )}
      {store.instagram && (
        <p className="mt-6 text-sm text-muted-foreground">
          Follow us on Instagram{' '}
          <a
            href={`https://instagram.com/${typeof store.instagram === 'object' ? store.instagram.username : store.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
            style={{ color: store.brandColor || '#e11d48' }}
          >
            @{typeof store.instagram === 'object' ? store.instagram.username : store.instagram}
          </a>
          {' '}for updates
        </p>
      )}
    </div>
  );
}