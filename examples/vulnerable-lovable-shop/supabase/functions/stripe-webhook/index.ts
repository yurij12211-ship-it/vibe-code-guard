import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const event = await req.json();
  if (event.type === "checkout.session.completed") {
    await supabase.from("orders").update({ paid: true }).eq("id", event.data.object.metadata.order_id);
  }
  return new Response("ok");
});
