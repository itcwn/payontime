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
const notificationCopyEmailInput = document.getElementById("notification-copy-email");
const planFreeInput = document.getElementById("plan-free");
const planPremiumInput = document.getElementById("plan-premium");
const premiumStatusEl = document.getElementById("premium-status");
const premiumExpiryEl = document.getElementById("premium-expiry");
let currentSettings = {
  plan_tier: "free",
  premium_expires_at: null
};

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function updatePremiumStatus({ planTier, premiumExpiresAt }) {
  if (!premiumStatusEl || !premiumExpiryEl) {
    return;
  }
  const today = new Date();
  const expiryDate = premiumExpiresAt ? new Date(premiumExpiresAt) : null;
  const isActive =
    expiryDate instanceof Date &&
    !Number.isNaN(expiryDate.getTime()) &&
    expiryDate >= today;

  if (isActive) {
    premiumStatusEl.textContent =
      planTier === "premium" ? "Aktywny" : "Aktywny (po rezygnacji)";
  } else {
    premiumStatusEl.textContent = "Nieaktywny";
  }
  if (expiryDate && !Number.isNaN(expiryDate.getTime())) {
    premiumExpiryEl.textContent = isActive
      ? `Ważny do: ${formatDate(expiryDate)}`
      : `Ostatnia ważność: ${formatDate(expiryDate)}`;
  } else {
    premiumExpiryEl.textContent = "";
  }
}

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
    if (notificationCopyEmailInput) {
      notificationCopyEmailInput.value = data.notification_copy_email ?? "";
    }
    currentSettings = {
      plan_tier: data.plan_tier ?? "free",
      premium_expires_at: data.premium_expires_at ?? null
    };
    if (planFreeInput && planPremiumInput) {
      if (currentSettings.plan_tier === "premium") {
        planPremiumInput.checked = true;
      } else {
        planFreeInput.checked = true;
      }
    }
    updatePremiumStatus({
      planTier: currentSettings.plan_tier,
      premiumExpiresAt: currentSettings.premium_expires_at
    });
  } else {
    currentSettings = { plan_tier: "free", premium_expires_at: null };
    updatePremiumStatus({ planTier: "free", premiumExpiresAt: null });
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
  const notificationCopyEmail = formData.get("notification_copy_email");
  const trimmedNotificationCopyEmail =
    typeof notificationCopyEmail === "string" ? notificationCopyEmail.trim() : "";
  const selectedPlan = formData.get("plan_tier") === "premium" ? "premium" : "free";

  const existingExpiry = currentSettings.premium_expires_at;
  let premiumExpiresAt = null;
  if (selectedPlan === "premium") {
    if (existingExpiry) {
      premiumExpiresAt = existingExpiry;
    } else {
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      premiumExpiresAt = newExpiry.toISOString();
    }
  } else if (existingExpiry) {
    const expiryDate = new Date(existingExpiry);
    if (!Number.isNaN(expiryDate.getTime()) && expiryDate >= new Date()) {
      premiumExpiresAt = existingExpiry;
    }
  }

  const payload = {
    user_id: session.user.id,
    email_enabled: formData.get("email_enabled") === "on",
    push_enabled: formData.get("push_enabled") === "on",
    notification_copy_email: trimmedNotificationCopyEmail || null,
    timezone: "Europe/Warsaw",
    plan_tier: selectedPlan,
    premium_expires_at: premiumExpiresAt
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

  currentSettings = {
    plan_tier: payload.plan_tier,
    premium_expires_at: payload.premium_expires_at
  };
  updatePremiumStatus({
    planTier: payload.plan_tier,
    premiumExpiresAt: payload.premium_expires_at
  });
  successEl.textContent = "Zapisano ustawienia.";
});

logoutButton.addEventListener("click", async () => {
  await signOut();
});

loadSettings();
