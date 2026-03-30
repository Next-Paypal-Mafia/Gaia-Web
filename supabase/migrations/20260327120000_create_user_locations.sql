-- Migration: Create latest user geolocation storage
-- Description: Stores the newest reported location snapshot per authenticated user
-- Date: 2026-03-27

CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  altitude double precision,
  altitude_accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_locations_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT user_locations_longitude_check CHECK (longitude >= -180 AND longitude <= 180),
  CONSTRAINT user_locations_accuracy_check CHECK (accuracy IS NULL OR accuracy >= 0),
  CONSTRAINT user_locations_altitude_accuracy_check CHECK (altitude_accuracy IS NULL OR altitude_accuracy >= 0),
  CONSTRAINT user_locations_heading_check CHECK (heading IS NULL OR (heading >= 0 AND heading <= 360)),
  CONSTRAINT user_locations_speed_check CHECK (speed IS NULL OR speed >= 0)
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own latest location"
  ON public.user_locations FOR SELECT
  USING ((select auth.uid()) = user_id);

COMMENT ON TABLE public.user_locations IS
  'Latest reported geolocation snapshot per user for JellyByte run context.';
