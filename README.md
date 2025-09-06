Kasir Sambelan Caping Gunung - Ready to deploy (Vite + React + Tailwind)

How to run locally:
1. Extract this zip.
2. In project folder:
   npm install
   npm run dev
3. Open the URL shown by Vite, e.g. http://localhost:5173

Deploy to Vercel (quick - free):
1. Create a (free) account on https://vercel.com
2. Click "New Project" → Import from Git (GitHub) OR "Deploy" → "Import Project"
3. If you don't use Git: you can drag & drop the project folder in the Vercel dashboard (Deploy).
4. Build command: npm run build
   Output directory: dist
5. Deploy. Vercel will provide a public URL.

Deploy to Netlify (drag & drop):
1. Create an account on https://app.netlify.com
2. On Sites, click "Add new site" → "Deploy manually" → drag & drop the produced build (after running npm run build)
3. Or connect to GitHub and let Netlify build automatically with command: npm run build (publish: dist)

Notes:
- Data is stored locally in browser localStorage. Use Backup (Settings) before switching devices.
- Default logins: admin/admin123  kasir/kasir123