# Sathish's Veni Beddings — catalog

Catalog of 98 wooden profiles, frame corners and workshop photos, modelled on
https://sathish-veni-beddings.lovable.app/ with a 3D UI.

## Run

```
npm start          # http://localhost:3000
npm test
```

Needs Node 18 or newer. Run `npm install` once. The local server itself has no dependencies.

## Layout

- `server.js`: local static file server. Enquiries are saved to `data/enquiries.json`
- `lib/api.js`: the JSON API, shared by `server.js` and the Netlify Function
- `netlify/functions/api.mjs`: serves `/api/*` on Netlify. Enquiries are saved in Netlify Blobs (store `enquiries`)
- `netlify.toml`: Netlify build settings (publish `public/`)
- `public/`: frontend (`index.html`, `styles.css`, `app.js`) and `images/profile-000.jpeg` … `profile-097.jpeg`
- `data/products.json`: the catalog. Edit a product's `category` or `name` here. The `original` field keeps each image's original WhatsApp filename.
- `data/enquiries.json`: enquiries from the site. The file is created on the first enquiry.

## Deploy on Netlify

1. Push this repo to GitHub and import it in Netlify. `netlify.toml` sets everything: no build command, publish directory `public`, functions in `netlify/functions`.
2. In Site configuration > Environment variables, add `ADMIN_KEY` with a secret value. Without it, `/admin.html` cannot list enquiries.
3. Redeploy. Netlify Blobs needs no setup.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/categories` | Category list with counts |
| GET | `/api/products?category=corners&q=042` | Both params are optional |
| GET | `/api/products/:code` | One product, for example `/api/products/008` |
| POST | `/api/enquiries` | `{ name, phone, message, products: [{ code: "003", qty: 2 }] }`. The cart saves orders here when "WhatsApp directly" is pressed |
| GET | `/api/enquiries` | Admin only. Read them in the browser at `/admin.html`. Start the server with `ADMIN_KEY=secret` and send header `x-admin-key: secret` |

## 3D UI

- Hero ring carousel of featured pieces. Drag it to spin.
- Cards and the spotlight tilt under the pointer, with a light glare.
- Sections and cards rotate into view as you scroll.
- The image viewer opens with a 3D flip. Use the arrow keys to move between pieces.
- Buttons have a pressable 3D depth.
- All motion turns off when the system's reduced-motion setting is on.
"# Wood" 
