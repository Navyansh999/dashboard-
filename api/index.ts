// This file is intentionally minimal.
// The Newtonite backend runs as a standalone Node.js Express server (server/).
// For the Vercel static deployment, the React client uses an in-browser mock API.
// See client/src/api/mockApi.ts for the full in-browser implementation.

export default function handler(_req: any, res: any) {
  res.status(200).json({
    message: 'Newtonite API — run locally with `npm run dev` for the full backend experience.',
    docs: 'https://github.com/Navyansh999/dashboard-#readme',
  });
}
