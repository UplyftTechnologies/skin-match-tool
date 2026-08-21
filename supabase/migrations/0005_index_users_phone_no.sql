-- Speeds up the OTP login lookup in verify-otp/route.js, which looks up a
-- returning user by phone number on every single login.
create index if not exists users_phone_no_idx
  on public.users (phone_no);
