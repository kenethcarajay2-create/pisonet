# PisoNet Cloud — Admin Access update

This ZIP contains **replacement files only** for the existing Phase 3 project. Copy the `backend` and `windows-client` folders over the corresponding folders in your existing `pisonet-cloud` project. **Do not replace or delete your `.env` files.**

## Backend

1. Back up your project.
2. Copy the two backend replacement files into the matching locations.
3. In `backend/`, generate a bcrypt hash of a **new dedicated admin access password** (different from the admin website password):

   `node -e "const b=require('bcryptjs'); console.log(b.hashSync(process.argv[1],12))" "YOUR-NEW-ADMIN-ACCESS-PASSWORD"`

   Note: passing a password as a shell argument may leave it in shell history. Prefer the interactive method below.

   Safer interactive method (run in `backend/`):

   `node -e "const b=require('bcryptjs'),r=require('readline').createInterface({input:process.stdin,output:process.stdout});r.question('New admin access password: ',p=>{console.log('Hash:',b.hashSync(p,12));r.close()})"`

4. Add the printed hash to `backend/.env` as `ADMIN_ACCESS_PASSWORD_HASH=<hash>` (paste the whole `$2b$...` string). Do not put the plaintext password in `.env`.
5. Restart backend: `npm run dev`.

## Electron

1. Copy the five replacement files to the matching locations.
2. Keep your existing `windows-client/.env` and installed dependencies.
3. Restart `npm run dev` in `windows-client/`.
4. On the voucher screen, choose Administrator access; enter your password; choose Open time or Timed access.
5. During admin access, click **Return to voucher screen** on the floating timer and confirm.

## Important behavior and limitations

- Paid sessions cannot be overridden by admin access; wait for the voucher to expire first.
- Open time remains active until ended manually, including after Electron restarts when the backend is reachable.
- Timed access expires according to the backend timestamp.
- Ending admin access requires a connection to the backend; it is intentionally not a local-only reset.
- This is a prototype, **not** a secure Windows lock. Offline fallback trusts a local session file and open admin sessions may persist offline. Do not use this to enforce paid access commercially.
- One-PC prototype uses one device token and in-memory login rate limiting. Use HTTPS and per-device authentication before remote production use.
