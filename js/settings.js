import { supabase } from "./supabase-client.js";
import {
  requireSession,
  signOut,
  getUser,
  getDisplayName,
  getUserLabel
} from "./auth.js";

const form = document.getElementById("settings-form");
const errorEl = document.getElementById("settings-error");
const successEl = document.getElementById("settings-success");
const logoutButton = document.getElementById("logout-button");
const userEmail = document.getElementById("user-email");
const settingsUserEmail = document.getElementById("settings-user-email");
const displayNameInput = document.getElementById("display-name");
let currentSettings = {};

async function loadSettings() {
  const session = await requireSession();
  const user = session?.user ?? (await getUser());
  if (user) {
    const userLabel = getUserLabel(user);
    if (userEmail) {
      userEmail.textContent = userLabel;
    }
    if (settingsUserEmail) {
      settingsUserEmail.textContent = userLabel;
    }
  }

  if (displayNameInput && user) {
    displayNameInput.value = getDisplayName(user);
  }

  if (!session?.user) {
    return;
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    errorEl.textContent = error.message;
    return;
  }

  if (data) {
    form.querySelector("#email-enabled").checked = data.email_enabled;
    form.querySelector("#push-enabled").checked = data.push_enabled;
    currentSettings = data;
  } else {
    currentSettings = {};
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  successEl.textContent = "";

  const session = await requireSession();
  if (!session?.user) {
    return;
  }

  const formData = new FormData(form);
  const displayName = formData.get("display_name");
  const trimmedDisplayName =
    typeof displayName === "string" ? displayName.trim() : "";
  const payload = {
    user_id: session.user.id,
    email_enabled: formData.get("email_enabled") === "on",
    push_enabled: formData.get("push_enabled") === "on",
    timezone: "Europe/Warsaw",
    plan_tier: "free",
    premium_expires_at: null
  };

  const { error: profileError } = await supabase.auth.updateUser({
    data: {
      display_name: trimmedDisplayName || null
    }
  });
  if (profileError) {
    errorEl.textContent = profileError.message;
    return;
  }

  const { error } = await supabase.from("user_settings").upsert(payload);
  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  currentSettings = payload;
  successEl.textContent = "Zapisano ustawienia.";
});

logoutButton.addEventListener("click", async () => {
  await signOut();
});

loadSettings();
