import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Robo Kids MVP',
    short_name: 'Robo',
    description: 'A playful robot friend that lives on your phone.',
    start_url: '/',
    display: 'standalone',
    background_color: '#081122',
    theme_color: '#081122',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
