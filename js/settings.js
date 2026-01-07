import { supabase } from "./supabase-client.js";
import { requireSession, signOut, getUser } from "./auth.js";

const form = document.getElementById("settings-form");
const errorEl = document.getElementById("settings-error");
const successEl = document.getElementById("settings-success");
const logoutButton = document.getElementById("logout-button");
const userEmail = document.getElementById("user-email");

async function loadSettings() {
  await requireSession();
  const user = await getUser();
  if (userEmail && user) {
    userEmail.textContent = user.email ?? "";
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .single();

  if (error && error.code !== "PGRST116") {
    errorEl.textContent = error.message;
    return;
  }

  if (data) {
    form.querySelector("#email-enabled").checked = data.email_enabled;
    form.querySelector("#push-enabled").checked = data.push_enabled;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  successEl.textContent = "";

  const formData = new FormData(form);
  const payload = {
    email_enabled: formData.get("email_enabled") === "on",
    push_enabled: formData.get("push_enabled") === "on",
    timezone: "Europe/Warsaw"
  };

  const { error } = await supabase.from("user_settings").upsert(payload);
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  successEl.textContent = "Zapisano ustawienia.";
});

logoutButton.addEventListener("click", async () => {
  await signOut();
});

loadSettings();
