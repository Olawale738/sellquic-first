
import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SellQuic',
    short_name: 'SellQuic.',
    description: 'One link that shows all your products ',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2c155f',
    icons: [
       {
        src: "/images/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/images/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
       {
        src: "/images/icon-192x192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/images/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
  }
}
