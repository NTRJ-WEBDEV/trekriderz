-- Elevate ntrjwebdev@gmail.com to admin role
SELECT elevate_to_admin('ntrjwebdev@gmail.com');

-- Belt-and-suspenders direct update
UPDATE public.users
SET role = 'admin', updated_at = NOW()
WHERE email = 'ntrjwebdev@gmail.com';

-- Confirm
SELECT id, email, full_name, role FROM public.users WHERE email = 'ntrjwebdev@gmail.com';
