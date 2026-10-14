-- Create crm_companies
CREATE TABLE IF NOT EXISTS public.crm_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT,
    assigned_to UUID,
    segment TEXT,
    url TEXT,
    address TEXT,
    notes TEXT,
    workspace_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create crm_contacts
CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    linked_in TEXT,
    company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
    person_type TEXT CHECK (person_type IN ('Fisica', 'Juridica')),
    cpf TEXT,
    workspace_id UUID NOT NULL,
    notes TEXT,
    assigned_to UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create crm_deals
CREATE TABLE IF NOT EXISTS public.crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_name TEXT,
    person_type TEXT CHECK (person_type IN ('Fisica', 'Juridica')),
    company_id UUID REFERENCES public.crm_companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
    phone TEXT,
    contact_name TEXT,
    contact_role TEXT,
    stage TEXT NOT NULL DEFAULT 'leads',
    outcome TEXT,
    loss_reason TEXT,
    loss_description TEXT,
    value NUMERIC DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    assigned_to UUID,
    unread_count INTEGER DEFAULT 0,
    notes TEXT[] DEFAULT '{}',
    qualification TEXT,
    closing_date TIMESTAMPTZ,
    workspace_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create crm_deal_contacts
CREATE TABLE IF NOT EXISTS public.crm_deal_contacts (
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    PRIMARY KEY (deal_id, contact_id)
);

-- Create crm_tasks
CREATE TABLE IF NOT EXISTS public.crm_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    due_time TIME,
    assigned_to UUID,
    task_type TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create crm_deal_history
CREATE TABLE IF NOT EXISTS public.crm_deal_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    user_name TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deal_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Workspaces
-- These policies use `current_setting('app.workspace_id', true)` which expects 
-- the frontend Supabase client to send the `workspace_id` header in requests.
-- Example: supabase.rpc(...) or supabase.from(...).setHeader('app.workspace_id', currentWorkspaceId)

CREATE POLICY "Enable all operations for users in their workspace" ON public.crm_companies
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "Enable all operations for users in their workspace" ON public.crm_contacts
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

CREATE POLICY "Enable all operations for users in their workspace" ON public.crm_deals
    FOR ALL TO authenticated
    USING (workspace_id::text = current_setting('app.workspace_id', true))
    WITH CHECK (workspace_id::text = current_setting('app.workspace_id', true));

-- For dependent tables, we verify the parent deal's workspace
CREATE POLICY "Enable all operations for deal_contacts based on deal" ON public.crm_deal_contacts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)));

CREATE POLICY "Enable all operations for tasks based on deal" ON public.crm_tasks
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)));

CREATE POLICY "Enable all operations for history based on deal" ON public.crm_deal_history
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.crm_deals d WHERE d.id = deal_id AND d.workspace_id::text = current_setting('app.workspace_id', true)));
