-- Poner rol SoloLectura (y nombre AXIS) al usuario Axis en Supabase
-- Ejecutar en: Supabase → SQL Editor → New query

-- Sustituye 'EMAIL_DE_AXIS@ejemplo.com' por el email real del usuario Axis
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "SoloLectura", "name": "AXIS"}'::jsonb
WHERE email = 'EMAIL_DE_AXIS@ejemplo.com';

-- Comprobar (opcional): ver metadata del usuario
-- SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'EMAIL_DE_AXIS@ejemplo.com';
