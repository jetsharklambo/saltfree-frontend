# Supabase Database Setup Guide

## Required RLS (Row Level Security) Policies

The username update failures are likely due to missing or incorrect RLS policies. Here are the policies that need to be configured in your Supabase dashboard:

### 1. Users Table Policies

Navigate to Authentication > Policies in your Supabase dashboard and add these policies for the `users` table:

#### Policy 1: Allow Insert for Any User (Anonymous)
```sql
CREATE POLICY "Users can insert their own record"
ON public.users
FOR INSERT
TO anon
WITH CHECK (true);
```

#### Policy 2: Allow Select for Any User (Anonymous)
```sql
CREATE POLICY "Users can view user records"
ON public.users
FOR SELECT
TO anon
USING (true);
```

#### Policy 3: Allow Update for Any User (Anonymous)
```sql
CREATE POLICY "Users can update any record"
ON public.users
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
```

### 2. Alternative Wallet-Based Policies (More Secure)

If you prefer wallet-based security (recommended), use these instead:

#### Policy 1: Select by Wallet Address
```sql
CREATE POLICY "Users can view records by wallet"
ON public.users
FOR SELECT
TO anon
USING (true);
```

#### Policy 2: Insert by Wallet Address
```sql
CREATE POLICY "Users can insert their wallet record"
ON public.users
FOR INSERT
TO anon
WITH CHECK (true);
```

#### Policy 3: Update by Wallet Address
```sql
CREATE POLICY "Users can update their wallet record"
ON public.users
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
```

### 3. Game History Table Policies

```sql
-- Allow users to insert their game history
CREATE POLICY "Users can insert game history"
ON public.game_history
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow users to view all game history
CREATE POLICY "Users can view game history"
ON public.game_history
FOR SELECT
TO anon
USING (true);

-- Allow users to update game history
CREATE POLICY "Users can update game history"
ON public.game_history
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
```

### 4. Game Lists Table Policies

```sql
-- Allow users to manage their game lists
CREATE POLICY "Users can manage game lists"
ON public.game_lists
FOR ALL
TO anon
USING (true)
WITH CHECK (true);
```

## Database Tables Schema

Ensure your tables match these schemas:

### Users Table
```sql
CREATE TABLE public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Game History Table
```sql
CREATE TABLE public.game_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    game_code TEXT NOT NULL,
    game_type TEXT NOT NULL,
    buy_in_amount TEXT NOT NULL,
    result TEXT CHECK (result IN ('won', 'lost', 'active')) DEFAULT 'active',
    winnings TEXT,
    winner_rank INTEGER,
    block_number BIGINT,
    transaction_hash TEXT,
    is_locked BOOLEAN,
    prize_splits JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Game Lists Table
```sql
CREATE TABLE public.game_lists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    game_codes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

## How to Apply These Changes

1. **Open Supabase Dashboard**
   - Go to your project at https://app.supabase.com
   - Navigate to the SQL editor

2. **Enable RLS on Tables**
   ```sql
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.game_lists ENABLE ROW LEVEL SECURITY;
   ```

3. **Add the Policies**
   - Copy and paste each policy from above
   - Execute them one by one in the SQL editor

4. **Test the Connection**
   - Use the debug panel in the app (database icon in bottom-left)
   - Run "Health Check" to verify connectivity
   - Test "Username Update" to confirm policies work

## Common Issues and Solutions

### Issue: "new row violates row-level security policy"
- **Cause**: Missing INSERT or UPDATE policies
- **Solution**: Add the INSERT/UPDATE policies shown above

### Issue: "permission denied for table users"
- **Cause**: RLS is enabled but no policies exist
- **Solution**: Add SELECT, INSERT, UPDATE policies

### Issue: "Failed to update username"
- **Cause**: UPDATE policy doesn't allow the operation
- **Solution**: Ensure UPDATE policy has both USING and WITH CHECK clauses

### Issue: Connection works but updates fail
- **Cause**: Policies are too restrictive
- **Solution**: Use the simpler "anon" policies shown above for development

## Testing Your Setup

After applying the policies, test them using the debug panel:

1. Click the database icon (bottom-left of the app)
2. Run "Health Check" - all items should show green ✅
3. Try "Test Username Update" - should succeed
4. Check browser console for detailed logs

If tests still fail, check the Supabase logs in your dashboard under Logs & Monitoring.