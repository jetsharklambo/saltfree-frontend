# UP-rc2 Vercel Deployment Guide

## Quick Deploy to Vercel

### 1. Prerequisites
- Vercel account (https://vercel.com)
- GitHub repository with UP-rc2 code
- Supabase project with database setup
- Thirdweb client ID

### 2. Environment Variables Setup
In your Vercel dashboard, add these environment variables:

```env
REACT_APP_SUPABASE_URL=https://gpajvkrjwrvojtfsyhcv.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key_here
REACT_APP_THIRDWEB_CLIENT_ID=fd75897568b8f195b5886be4710e306d
GENERATE_SOURCEMAP=false
```

### 3. Deploy Steps
1. **Connect Repository**
   - Go to Vercel dashboard
   - Click "New Project"
   - Import your UP-rc2 GitHub repository

2. **Configure Build Settings**
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install --legacy-peer-deps`

3. **Add Environment Variables**
   - In project settings, go to "Environment Variables"
   - Add all variables listed above
   - Make sure they apply to Production, Preview, and Development

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `your-project.vercel.app`

### 4. Post-Deployment Verification
- [ ] App loads without errors
- [ ] Wallet connection works
- [ ] Game creation works
- [ ] Database operations work
- [ ] Contract interactions work

### 5. Custom Domain (Optional)
1. Go to project settings → Domains
2. Add your custom domain
3. Configure DNS settings as instructed

## Important Notes

- **Source Maps**: Disabled for security and performance
- **Build Time**: ~3-5 minutes due to Web3 dependencies
- **Environment**: Ethereum Sepolia testnet
- **Database**: Supabase PostgreSQL with RLS

## Troubleshooting

**Build Fails with TypeScript Errors:**
- These are typically non-blocking for deployment
- App will still work in production
- Fix TypeScript issues in development later

**Environment Variable Issues:**
- Double-check all variables are set in Vercel dashboard
- Ensure REACT_APP_ prefix for client-side variables
- Redeploy after changing environment variables

**Wallet Connection Issues:**
- Verify Thirdweb client ID is correct
- Check network configuration (Sepolia)
- Ensure Web3 wallet is connected to Sepolia testnet

## Support
If deployment issues persist, check:
1. Vercel build logs
2. Browser console for client-side errors
3. Network tab for API failures