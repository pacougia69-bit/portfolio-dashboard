# Railway Deployment Configuration

## Environment Variables Required

To deploy this application on Railway, you need to set the following environment variables:

### Required Variables

1. **VITE_APP_URL** (Frontend)
   - Your Railway application URL
   - Example: `https://your-app-name.up.railway.app`
   - Used for: Login redirects and base URL references

2. **OAUTH_SERVER_URL** (Backend)
   - Your OAuth server URL
   - Example: `https://your-oauth-server.com`
   - Used for: Server-side OAuth authentication

3. **VITE_OAUTH_PORTAL_URL** (Frontend)
   - Your OAuth portal URL
   - Example: `https://your-oauth-portal.com`
   - Used for: Client-side OAuth login redirects

4. **VITE_APP_ID**
   - Your application ID
   - Default: `demo-app`

### Optional Variables

- **VITE_ANALYTICS_ENDPOINT** - Analytics endpoint URL
- **VITE_ANALYTICS_WEBSITE_ID** - Analytics website ID
- **VITE_FRONTEND_FORGE_API_KEY** - Forge API key for maps
- **VITE_FRONTEND_FORGE_API_URL** - Forge API URL

## Setting Environment Variables on Railway

1. Go to your Railway project dashboard
2. Select your service
3. Navigate to the "Variables" tab
4. Add each environment variable with its corresponding value
5. Click "Deploy" to trigger a new deployment with the updated variables

## Local Development

For local development, copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Then edit `.env` with your local configuration (typically using `http://localhost:3000`).

## Deployment Process

After setting the environment variables:

1. Push your code to GitHub
2. Railway will automatically detect the changes
3. The build process will use the environment variables
4. The application will be deployed with the correct URLs

## Troubleshooting

If you see redirects to `localhost:3000`:

1. Verify that `VITE_APP_URL` is set in Railway
2. Check that the variable starts with `https://` (not `http://`)
3. Ensure the URL does NOT end with a trailing slash (the code adds it automatically)
4. Trigger a new deployment after changing variables
5. Clear your browser cache and cookies

## Build Configuration

The application uses the following build configuration (defined in `railway.json`):

- **Builder**: NIXPACKS
- **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
- **Start Command**: `pnpm start`
- **Health Check**: `/health` endpoint

## Notes

- All `VITE_*` variables are embedded at build time
- Changing `VITE_*` variables requires a rebuild
- Backend variables (without `VITE_` prefix) can be changed without rebuild
