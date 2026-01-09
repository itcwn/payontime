import { supabase } from "./supabase-client.js";

export async function requireSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "./login.html";
    return null;
  }

  return session;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "./login.html";
}

export async function getUser() {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}
