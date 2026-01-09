import { supabase } from "./supabase-client.js";

const form = document.getElementById("signup-form");
const errorEl = document.getElementById("auth-error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";

  const formData = new FormData(form);
  const email = formData.get("email");
  const password = formData.get("password");

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  window.location.href = "./app.html";
});
