-- TrekRiderz Admin Elevation Utility
-- Usage: SELECT elevate_to_admin('user_email@example.com');

CREATE OR REPLACE FUNCTION elevate_to_admin(email_text TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.users 
  SET role = 'admin' 
  WHERE email = email_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Specifically elevate trekriderz if the user is already there
-- We don't have the email yet, so we provide the function above.
