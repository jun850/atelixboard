import { supabase } from "../../supabase/client";
export async function studio(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("discovery-studio", {
    body,
  });
  if (error) {
    let message = "The request failed. Please try again.";
    try {
      const payload = await error.context?.json();
      if (payload?.error) message = payload.error;
    } catch {}
    throw Error(message);
  }
  if (data?.error) throw Error(data.error);
  return data;
}
export type Row = Record<string, any>;
