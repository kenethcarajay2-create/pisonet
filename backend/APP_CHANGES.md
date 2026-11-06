# Update existing backend/src/app.js

Add these imports near the other route imports:

```js
import deviceRoutes from './routes/deviceRoutes.js';
import computerRoutes from './routes/computerRoutes.js';
```

Add these lines **before** your error-handling middleware:

```js
app.use('/api/device', deviceRoutes);
app.use('/api/computers', computerRoutes);
```

Do not replace your existing admin authentication or voucher routes.

Add to backend/.env (generate your own token; never commit it):

```
DEVICE_TOKEN=<at least 32 random characters>
```

Generate token using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

The same token must be configured in the Windows client, and on the deployed backend.

This starter uses a single shared device credential for PC-01. Use per-device provisioning and revocation when adding more PCs. The endpoint is authenticated but **not** rate-limited; add IP/device throttling before public deployment. MongoDB multi-document transactions require a replica set (Atlas clusters normally support this).
