const headerTemplates = {
  "app-dashboard": `
    <header class="card site-header">
      <div class="container page-header">
        <a class="brand" href="./app.html">
          <img src="./css/logo_m.png" alt="ZapłaćNaCzas" />
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Otwórz menu">
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
        </button>
        <nav class="nav" id="primary-nav">
          <a href="./app.html">Twoje płatności</a>
          <a href="./payments-new.html">Nowa płatność</a>
          <a href="./settings.html">Ustawienia</a>
        </nav>
        <div class="header-user">
          <details class="user-menu">
            <summary class="user-menu-toggle" aria-label="Menu użytkownika">
              <span class="user-avatar" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7.5" r="4.5" />
                </svg>
              </span>
              <span class="user-menu-email" id="user-email"></span>
              <span class="user-menu-caret" aria-hidden="true">▾</span>
            </summary>
            <div class="user-menu-panel">
              <div class="user-menu-meta">Konto</div>
              <a class="user-menu-item" href="./settings.html">Ustawienia</a>
              <button class="user-menu-item" type="button" id="logout-button">Wyloguj</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  `,
  "app-simple": `
    <header class="card site-header">
      <div class="container page-header">
        <a class="brand" href="./app.html">
          <img src="./css/logo_m.png" alt="ZapłaćNaCzas" />
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Otwórz menu">
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
        </button>
        <nav class="nav" id="primary-nav">
          <a href="./app.html">Dashboard</a>
          <a href="./payments-new.html">Nowa płatność</a>
          <a href="./settings.html">Ustawienia</a>
        </nav>
      </div>
    </header>
  `,
  public: `
    <header class="card site-header">
      <div class="container page-header">
        <a class="brand" href="./index.html">
          <img src="./css/logo_m.png" alt="ZapłaćNaCzas" />
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Otwórz menu">
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
          <span class="nav-toggle-bar" aria-hidden="true"></span>
        </button>
        <nav class="nav" id="primary-nav">
          <a href="./index.html">Strona główna</a>
          <a href="./login.html">Logowanie</a>
          <a href="./signup.html">Rejestracja</a>
        </nav>
      </div>
    </header>
  `,
};

const footerTemplates = {
  app: `
    <footer class="site-footer">
      <div class="container footer-content">
        <div class="footer-brand">
          <img src="./css/logo_m.png" alt="ZapłaćNaCzas" />
          <p class="muted">
            ZapłaćNaCzas sp. z o.o.<br />
            ul. Przykładowa 12, 00-001 Warszawa
          </p>
        </div>
        <div class="footer-section">
          <h3>Kontakt</h3>
          <p><a href="mailto:kontakt@zaplacnaczas.pl">kontakt@zaplacnaczas.pl</a></p>
          <p>+48 123 456 789</p>
        </div>
        <div class="footer-section">
          <h3>Social media</h3>
          <ul class="footer-links-list">
            <li><a href="https://facebook.com/zaplacnaczas">Facebook</a></li>
            <li><a href="https://instagram.com/zaplacnaczas">Instagram</a></li>
            <li><a href="https://linkedin.com/company/zaplacnaczas">LinkedIn</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h3>Przydatne linki</h3>
          <ul class="footer-links-list">
            <li><a href="./app.html">Dashboard</a></li>
            <li><a href="./payments-new.html">Nowa płatność</a></li>
            <li><a href="./report-bug.html">Zgłoś błąd</a></li>
            <li><a href="./report-idea.html">Zgłoś pomysł</a></li>
            <li><a href="./regulamin.html">Regulamin</a></li>
            <li><a href="./polityka-prywatnosci.html">Polityka prywatności</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">© 2024 ZapłaćNaCzas. Wszelkie prawa zastrzeżone.</div>
    </footer>
  `,
  public: `
    <footer class="site-footer">
      <div class="container footer-content">
        <div class="footer-brand">
          <img src="./css/logo_m.png" alt="ZapłaćNaCzas" />
          <p class="muted">
            ZapłaćNaCzas sp. z o.o.<br />
            ul. Przykładowa 12, 00-001 Warszawa
          </p>
        </div>
        <div class="footer-section">
          <h3>Kontakt</h3>
          <p><a href="mailto:kontakt@zaplacnaczas.pl">kontakt@zaplacnaczas.pl</a></p>
          <p>+48 123 456 789</p>
        </div>
        <div class="footer-section">
          <h3>Social media</h3>
          <ul class="footer-links-list">
            <li><a href="https://facebook.com/zaplacnaczas">Facebook</a></li>
            <li><a href="https://instagram.com/zaplacnaczas">Instagram</a></li>
            <li><a href="https://linkedin.com/company/zaplacnaczas">LinkedIn</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h3>Przydatne linki</h3>
          <ul class="footer-links-list">
            <li><a href="./index.html">Strona główna</a></li>
            <li><a href="./login.html">Logowanie</a></li>
            <li><a href="./signup.html">Rejestracja</a></li>
            <li><a href="./report-bug.html">Zgłoś błąd</a></li>
            <li><a href="./report-idea.html">Zgłoś pomysł</a></li>
            <li><a href="./regulamin.html">Regulamin</a></li>
            <li><a href="./polityka-prywatnosci.html">Polityka prywatności</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">© 2024 ZapłaćNaCzas. Wszelkie prawa zastrzeżone.</div>
    </footer>
  `,
};

const headerSlot = document.querySelector("[data-layout-header]");
if (headerSlot) {
  const variant = headerSlot.dataset.layoutHeader;
  const headerTemplate = headerTemplates[variant];
  if (headerTemplate) {
    headerSlot.outerHTML = headerTemplate;
  }
}

const footerSlot = document.querySelector("[data-layout-footer]");
if (footerSlot) {
  const variant = footerSlot.dataset.layoutFooter;
  const footerTemplate = footerTemplates[variant];
  if (footerTemplate) {
    footerSlot.outerHTML = footerTemplate;
  }
}

document.querySelectorAll(".nav-toggle").forEach((toggle) => {
  const header = toggle.closest(".site-header");
  const nav = header?.querySelector(".nav");
  if (!nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    header?.classList.toggle("nav-open", isOpen);
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      header?.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
});
