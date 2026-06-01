-- Alter user_packages foreign key to support cascade deletion of packages
ALTER TABLE public.user_packages
DROP CONSTRAINT IF EXISTS user_packages_package_id_fkey,
ADD CONSTRAINT user_packages_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.ai_packages(id)
  ON DELETE CASCADE;
