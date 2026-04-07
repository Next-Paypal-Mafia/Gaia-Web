-- Deprecated for current frontend work.
--
-- JellyByte-Web now manages external-site credentials through JellyByte-Server
-- credential routes instead of calling Supabase Vault RPCs directly from the
-- browser. Keep this file only as historical reference for the old path.

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.sync_vault_credentials(payload jsonb[])
RETURNS jsonb[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    cred jsonb;
    new_credentials jsonb[] := ARRAY[]::jsonb[];
    secret_uuid uuid;
    updated_cred jsonb;
BEGIN
    FOREACH cred IN ARRAY payload
    LOOP
        updated_cred := cred;
        
        -- If password is provided in plaintext, insert into vault
        IF (cred ? 'password') AND (cred->>'password' IS NOT NULL) AND ((cred->>'password')::text <> '') THEN
            SELECT vault.create_secret(
                (cred->>'password')::text,
                (cred->>'id')::text,  -- Use the unique credential ID to prevent name collisions
                'Password for ' || (cred->>'username')::text || ' on ' || (cred->>'name')::text
            ) INTO secret_uuid;
            
            -- Remove plaintext and set the secret id
            updated_cred := updated_cred - 'password' || jsonb_build_object('password_secret_id', secret_uuid);
        END IF;
        
        new_credentials := array_append(new_credentials, updated_cred);
    END LOOP;
    
    -- Update the user's credentials in the database
    UPDATE public.users 
    SET credentials = new_credentials
    WHERE id = auth.uid();
    
    RETURN new_credentials;
END;
$$;

-- Run this to allow the frontend to securely access their own passwords 
CREATE OR REPLACE FUNCTION public.get_decrypted_password(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    decrypted_text text;
    is_owner boolean;
BEGIN
    -- Verify the user actually owns this secret by checking their credentials array!
    SELECT EXISTS (
        SELECT 1 
        FROM public.users u, unnest(u.credentials) AS c
        WHERE u.id = auth.uid() 
        AND (c->>'password_secret_id')::uuid = secret_id
    ) INTO is_owner;

    IF NOT is_owner THEN
        RAISE EXCEPTION 'Unauthorized or secret not found';
    END IF;

    SELECT decrypted_secret INTO decrypted_text
    FROM vault.decrypted_secrets
    WHERE id = secret_id;

    RETURN decrypted_text;
END;
$$;
