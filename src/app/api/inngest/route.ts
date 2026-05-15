import { serve } from "inngest/next";
import { inngest, whatsappAgent } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [whatsappAgent],
});