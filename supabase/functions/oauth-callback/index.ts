// supabase/functions/oauth-callback/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Missing authorization code', { status: 400 });
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await response.json();
  if (tokenData.error) {
    console.error('Token exchange error:', tokenData.error_description);
    return new Response('Error exchanging token', { status: 500 });
  }

  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userInfoResponse.json();
  const userEmail = userInfo.email;

  if (!userEmail) {
    return new Response('Could not retrieve user email from Google', { status: 500 });
  }

  const { data: adminUser, error: dbError } = await supabaseAdmin
    .from('admins')
    .select('email')
    .eq('email', userEmail)
    .single();

  if (dbError || !adminUser) {
    // You should create a simple access-denied.html page for this redirect
    const accessDeniedUrl = `${new URL(req.url).origin}/access-denied.html`;
    return Response.redirect(accessDeniedUrl, 302);
  }
  
  const successUrl = `${new URL(req.url).origin}/admin.html`;
  return Response.redirect(successUrl, 302);
});
