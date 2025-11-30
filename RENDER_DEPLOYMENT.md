# Render Deployment Guide for MedFlow Pro

## Session Expiration Fix - Environment Variables

After deploying to Render, you **must** set the following environment variables in your Render dashboard:

### Critical Environment Variables

1. **SESSION_SECRET** (Required)
   - Generate a secure random value by running this command locally:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Copy the output (a 64-character hex string)
   - In Render Dashboard → Your Service → Environment → Add Environment Variable
   - Key: `SESSION_SECRET`
   - Value: `<paste the generated hex string>`

2. **NODE_ENV** (Required)
   - Key: `NODE_ENV`
   - Value: `production`

### How to Set Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your web service (MedFlow Pro)
3. Click on "Environment" in the left sidebar
4. Click "Add Environment Variable"
5. Add each variable listed above
6. Click "Save Changes" - This will trigger a redeployment

### Verification

After setting the environment variables and redeploying:

1. Login to your application
2. Navigate between different pages (Reception, Doctor, Pharmacy, Lab)
3. Verify that you are **not** getting "session expired" errors
4. Close your browser and reopen - you should still be logged in (within 24 hours)

### Session Storage

Sessions are now stored in a SQLite database (`data/sessions.db`) which persists across deployments. Render's persistent disk will keep this data.

### Troubleshooting

If you still see session issues:

1. **Check Environment Variables**: Ensure `SESSION_SECRET` and `NODE_ENV=production` are set
2. **Check Logs**: In Render dashboard, check the logs for any session-related errors
3. **Clear Browser Cookies**: Clear your browser cookies and try logging in again
4. **Verify HTTPS**: Ensure you're accessing the site via `https://` not `http://`

### Technical Details

The fix implements:
- **Persistent session storage** using SQLite (`connect-sqlite3`)
- **Secure cookies** for HTTPS (enabled in production)
- **Proxy trust** for Render's load balancer
- **SameSite cookie policy** for CSRF protection
- **24-hour session timeout**
