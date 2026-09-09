-- Ensure profile is auto-created on signup via trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any missing profile rows for existing users so login doesn't hang
INSERT INTO public.profiles (id, full_name, boat_name, role, preferred_language)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name',''),
       u.raw_user_meta_data->>'boat_name',
       COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'Client'),
       COALESCE((u.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;