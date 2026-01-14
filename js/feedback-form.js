import { requireSession } from "./auth.js";
import { supabase } from "./supabase-client.js";

const form = document.getElementById("feedback-form");
const errorEl = document.getElementById("feedback-error");
const successEl = document.getElementById("feedback-success");

function setMessage({ error, success }) {
  if (errorEl) {
    errorEl.textContent = error ?? "";
  }
  if (successEl) {
    successEl.textContent = success ?? "";
  }
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage({ error: "", success: "" });

    const feedbackType = form.dataset.feedbackType;
    if (!feedbackType) {
      setMessage({ error: "Nie udało się rozpoznać typu zgłoszenia." });
      return;
    }

    try {
      const session = await requireSession();
      if (!session) return;

      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      const description = String(formData.get("description") || "").trim();

      if (!title || !description) {
        setMessage({ error: "Uzupełnij tytuł i opis zgłoszenia." });
        return;
      }

      const { error } = await supabase.from("feedback").insert({
        user_id: session.user.id,
        feedback_type: feedbackType,
        title,
        description
      });

      if (error) {
        throw new Error(error.message);
      }

      form.reset();
      setMessage({ success: "Dziękujemy! Twoje zgłoszenie zostało zapisane." });
    } catch (error) {
      setMessage({ error: error.message });
    }
  });
}

await requireSession();
