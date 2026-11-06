# PisoNet Cloud update — flexible vouchers and hidden admin access

## Install

1. **Back up your existing `pisonet-cloud` folder.**
2. Extract this ZIP. Copy its `admin-web`, `backend`, and `windows-client` contents into your existing project, replacing matching source files.
3. **Do not delete or overwrite your existing `.env` files.** No `.env` or `node_modules` directories are included in this archive.
4. In `backend`, run `npm install` then `npm run dev`.
5. In `admin-web`, run `npm install` then `npm run dev`.
6. In `windows-client`, run `npm install` then `npm run dev`.

## New admin dashboard pricing

- Dashboard > **Edit pricing** sets the global minutes per peso (default 6) and special package prices/times; save to MongoDB.
- **Any amount** converts an entered price (e.g. 7, 16) using the saved rate.
- **Special package** uses a saved preset (e.g. ₱25 / 180 minutes).
- **Custom time** sets both price and minutes directly.
- Each new voucher stores its own duration and price, so editing rates does not change existing vouchers.
- Existing voucher redemption continues using `durationMinutes`.
- Vouchers are limited to 1–1440 minutes (24 hours); automatic conversion is rounded to the nearest whole minute.

## Hidden Electron admin login

- The large administrator button has been removed.
- Click the tiny diamond at the **bottom-right** five times within five seconds to show the password form.
- Clicking elsewhere resets the sequence.
- The existing admin password, Open Time, Timed Access, and floating Return to Voucher Screen controls are unchanged.
- The five-click gesture is **not security**; the password is still required.

## Important

- This Electron prototype is not a secure Windows kiosk. Do not rely on it to stop paying users from bypassing Windows controls.
- Your uploaded original ZIP included `.env` files. This updated ZIP excludes them. Never push the original ZIP to GitHub.
- If you have exposed secrets elsewhere, rotate them before production deployment.
