import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Menu,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import "./App.css";
import { db } from "./firebase";
import { InquiryMeetingDatePicker } from "./InquiryMeetingDatePicker";

const nav = [
  { label: "Home", href: "#home" },
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "FAQ", href: "#faq" },
];

const showcaseProjects = [
  {
    title: "AZ Auto Zolutions",
    subtitle: "Business system and dashboard platform.",
    image: "/azauto.png",
    popup: "Web + mobile workflow for inventory, appointments, and reports.",
  },
  {
    title: "AZ Travel & Tours",
    subtitle: "Travel booking and management experience.",
    image: "/aztravel.png",
    popup: "Booking journeys, offers, and admin CRM in one dashboard.",
  },
  {
    title: "IoT Device Fabrication",
    subtitle: "Hardware-integrated monitoring solution.",
    image: "/iot.png",
    popup: "Sensor-driven analytics connected to custom fabricated devices.",
  },
  {
    title: "Custom 3D Model & Prints",
    subtitle: "Precision prototyping for real products.",
    image: "/3dmodel.png",
    popup: "From CAD-ready concepts to final physical prints.",
  },
  {
    title: "iTechPlus Solutions",
    subtitle: "Digital programs and project management portal.",
    image: "/itechplus.png",
    popup: "Modern platform for categories, projects, and user workflows.",
  },
];

const servicesCards: { title: string; image: string }[] = [
  { title: "Mobile & web", image: "/azauto.png" },
  { title: "Travel & CRM", image: "/aztravel.png" },
  { title: "IoT fabrication", image: "/iot.png" },
  { title: "3D model & print", image: "/3dmodel.png" },
];

const faqItems = [
  {
    q: "How much is the down payment?",
    a: "Down payment depends on project size and timeline. A typical split is discussed during inquiry (often 30–50% to start). Message me for a quote tailored to your scope.",
  },
  {
    q: "What are the available modes of payment?",
    a: "Common options include GCash, bank transfer, and other channels we agree on. Flexible arrangements are available for students and businesses.",
  },
  {
    q: "Is partial payment available?",
    a: "Yes — milestone-based partial payments are available, especially for larger builds delivered in phases.",
  },
  {
    q: "How can I get a discount?",
    a: "Like and leave a review on our official Facebook page to receive a 10% discount on your project!",
  },
];

type Category = "business" | "capstone" | "model3d" | null;

const categoryLabels: Record<Exclude<Category, null>, string> = {
  business: "BUSINESS",
  capstone: "CAPSTONE",
  model3d: "3D MODEL",
};

const inquiryOfferOptions = [
  { id: "web-app", label: "Web app" },
  { id: "mobile-app", label: "Mobile app" },
  { id: "3d-model", label: "3D model" },
  { id: "3d-printing", label: "3D printing" },
  { id: "iot-fabrication", label: "IoT fabrication" },
] as const;

type ClientKind = "business" | "student" | "";

type InquiryStep = 1 | 2 | 3;

const emptyOffers = (): Record<(typeof inquiryOfferOptions)[number]["id"], boolean> =>
  Object.fromEntries(inquiryOfferOptions.map((o) => [o.id, false])) as Record<
    (typeof inquiryOfferOptions)[number]["id"],
    boolean
  >;

export default function App() {
  const [openFaq, setOpenFaq] = useState<number | null>(3);
  const [category, setCategory] = useState<Category>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(0);

  const [inquiryName, setInquiryName] = useState("");
  const [inquiryAddress, setInquiryAddress] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquiryClientKind, setInquiryClientKind] = useState<ClientKind>("");
  const [inquiryOffers, setInquiryOffers] = useState(emptyOffers);
  const [inquiryDescription, setInquiryDescription] = useState("");
  const [inquiryMeetingDate, setInquiryMeetingDate] = useState("");
  const [inquiryConsent, setInquiryConsent] = useState(false);
  const [inquiryFormError, setInquiryFormError] = useState<string | null>(null);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryStep, setInquiryStep] = useState<InquiryStep>(1);
  const inquirySentRef = useRef(false);
  inquirySentRef.current = inquirySent;

  const toggleInquiryOffer = (id: (typeof inquiryOfferOptions)[number]["id"]) => {
    setInquiryOffers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const clearInquiryFields = () => {
    setInquiryName("");
    setInquiryAddress("");
    setInquiryEmail("");
    setInquiryClientKind("");
    setInquiryOffers(emptyOffers());
    setInquiryDescription("");
    setInquiryMeetingDate("");
    setInquiryConsent(false);
    setInquiryFormError(null);
    setInquirySent(false);
    setInquirySubmitting(false);
    setInquiryStep(1);
  };

  const openInquiryModal = () => {
    setInquiryFormError(null);
    setInquiryStep(1);
    if (inquirySent) {
      clearInquiryFields();
    }
    setInquiryModalOpen(true);
  };

  const handleInquireNavClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setMenuOpen(false);
    openInquiryModal();
  };

  const closeInquiryModal = () => {
    setInquiryModalOpen(false);
    setInquiryStep(1);
    setInquiryFormError(null);
    if (!inquirySentRef.current) {
      clearInquiryFields();
    }
  };

  const startAnotherInquiryInModal = () => {
    clearInquiryFields();
    setInquiryModalOpen(true);
  };

  const goInquiryBack = () => {
    setInquiryFormError(null);
    if (inquiryStep > 1) {
      setInquiryStep((s) => (s === 3 ? 2 : 1));
    }
  };

  const onInquiryWizardSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInquiryFormError(null);

    if (inquiryStep === 1) {
      if (!inquiryName.trim()) {
        setInquiryFormError("Please enter your name.");
        return;
      }
      if (!inquiryAddress.trim()) {
        setInquiryFormError("Please enter your address.");
        return;
      }
      if (!inquiryEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inquiryEmail.trim())) {
        setInquiryFormError("Please enter a valid email address.");
        return;
      }
      setInquiryStep(2);
      return;
    }

    if (inquiryStep === 2) {
      if (!inquiryClientKind) {
        setInquiryFormError("Please select Business or Student.");
        return;
      }
      if (!inquiryOfferOptions.some((o) => inquiryOffers[o.id])) {
        setInquiryFormError("Select at least one service you are interested in.");
        return;
      }
      if (!inquiryDescription.trim()) {
        setInquiryFormError("Please add a brief description of your project.");
        return;
      }
      setInquiryStep(3);
      return;
    }

    void submitInquiryToFirestore();
  };

  const submitInquiryToFirestore = async () => {
    setInquiryFormError(null);
    if (!inquiryConsent) {
      setInquiryFormError("Please check the box to confirm you want to be contacted.");
      return;
    }

    setInquirySubmitting(true);
    try {
      await addDoc(collection(db, "inquiries"), {
        name: inquiryName.trim(),
        email: inquiryEmail.trim(),
        address: inquiryAddress.trim(),
        clientKind: inquiryClientKind,
        services: inquiryOfferOptions.filter((o) => inquiryOffers[o.id]).map((o) => o.id),
        projectCategory: category ?? "none",
        description: inquiryDescription.trim(),
        meetingDate: inquiryMeetingDate.trim() || "",
        consent: inquiryConsent,
        createdAt: serverTimestamp(),
      });
      setInquirySent(true);
    } catch (err) {
      console.error(err);
      setInquiryFormError(
        "Could not save your inquiry. Confirm Firestore rules are published in the Firebase console, then try again.",
      );
    } finally {
      setInquirySubmitting(false);
    }
  };

  const toggleFaq = (i: number) => {
    setOpenFaq((prev) => (prev === i ? null : i));
  };

  useEffect(() => {
    document.body.style.overflow = menuOpen || inquiryModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, inquiryModalOpen]);

  useEffect(() => {
    if (!inquiryModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeInquiryModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inquiryModalOpen]);

  const totalProjects = showcaseProjects.length;
  const leftProject = showcaseProjects[(activeProject - 1 + totalProjects) % totalProjects];
  const centerProject = showcaseProjects[activeProject];
  const rightProject = showcaseProjects[(activeProject + 1) % totalProjects];

  return (
    <>
      <header className={`site-header${menuOpen ? " menu-open" : ""}`}>
        <div className="container header-inner">
          <a className="brand" href="#home" onClick={() => setMenuOpen(false)}>
            <img src="/OBRATECH.png" alt="Obratech" className="brand-logo" />
          </a>

          <nav className={`nav${menuOpen ? " is-open" : ""}`} id="primary-nav" aria-label="Primary">
            {nav.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            <a className="nav-inquire" href="#inquire" onClick={handleInquireNavClick}>
              Inquire
            </a>
          </nav>

          <div className="header-actions">
            <a className="btn-accent btn-header" href="#inquire" onClick={handleInquireNavClick}>
              Inquire
            </a>
            <button
              type="button"
              className="nav-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="primary-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}
      </header>

      <main>
        <section id="home" className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title">
                WE BUILD THE SYSTEM
                <br />
                BEHIND YOUR BUSINESS
              </h1>
              <p className="hero-tagline">
                Custom, Reliable, and Built for Growth
              </p>
              <div className="hero-cta">
                <a className="btn-accent" href="#inquire" onClick={handleInquireNavClick}>
                  Scale Me Up
                </a>
              </div>
            </div>
          </div>

          <div className="container stats-row">
            <div className="stat">
              <span className="stat-num">20+</span>
              <span className="stat-label">Projects</span>
            </div>
            <div className="stat">
              <span className="stat-num">100%</span>
              <span className="stat-label">Satisfaction</span>
            </div>
          </div>
        </section>

        <section id="services" className="section">
          <div className="container services-projects">
            <div className="services-head">
              <p className="section-label services-label">Our Projects</p>
              <p className="services-subhead">
                From idea to launch, we build systems that streamline operations, boost sales,
                and scale with you.
              </p>
            </div>

            <div className="services-carousel-wrap">
              <div className="services-smoke left" aria-hidden />
              <div className="services-smoke right" aria-hidden />

              <button
                type="button"
                className="carousel-arrow left"
                aria-label="Previous project"
                onClick={() =>
                  setActiveProject((prev) => (prev - 1 + totalProjects) % totalProjects)
                }
              >
                <ChevronLeft size={18} />
              </button>

              <div className="services-carousel">
                {[leftProject, centerProject, rightProject].map((project, idx) => (
                  <article
                    key={`${project.title}-${idx}`}
                    className={`showcase-card${idx === 1 ? " is-featured" : " is-side"}`}
                  >
                    <img src={project.image} alt={project.title} className="showcase-image" />
                    <div className="showcase-overlay">
                      <h3>{project.title}</h3>
                      <p>{project.subtitle}</p>
                    </div>
                    <div className="showcase-popup">{project.popup}</div>
                  </article>
                ))}
              </div>

              <button
                type="button"
                className="carousel-arrow right"
                aria-label="Next project"
                onClick={() => setActiveProject((prev) => (prev + 1) % totalProjects)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <section id="work" className="section section-work section-work-saas">
          <div className="container">
            <header className="work-saas-head">
              <div className="work-saas-head-copy">
                <h2 className="work-saas-h2">Built to sell, ship, and scale</h2>
                <p className="work-saas-lead">Apps · Travel · IoT · 3D</p>
              </div>
              <button
                type="button"
                className="work-saas-head-cta"
                onClick={() => {
                  setMenuOpen(false);
                  openInquiryModal();
                }}
              >
                <span>Start a project</span>
                <ArrowUpRight size={17} strokeWidth={2} aria-hidden />
              </button>
            </header>

            <div className="work-saas-grid">
              {servicesCards.map((card, idx) => {
                const openInquiry = () => {
                  setMenuOpen(false);
                  openInquiryModal();
                };
                return (
                  <article
                    key={card.title}
                    role="button"
                    tabIndex={0}
                    className={`work-saas-card${idx === 1 ? " is-featured" : ""}`}
                    onClick={openInquiry}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openInquiry();
                      }
                    }}
                    aria-label={`Start a project — ${card.title}`}
                  >
                    <div className="work-saas-card-top">
                      <h3 className="work-saas-card-title">{card.title}</h3>
                    </div>
                    <div className="work-saas-preview">
                      <img src={card.image} alt="" />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="section section-faq">
          <div className="container">
            <div className="faq-layout">
              <div className="faq-intro">
                <p className="section-label accent-label">FAQ</p>
                <h2 className="faq-headline">Got questions?</h2>
                <p className="faq-sub">Everything you need to know.</p>
              </div>
              <div className="faq-list-wrap">
                <div className="faq-list">
                  {faqItems.map((item, i) => {
                    const open = openFaq === i;
                    return (
                      <div key={item.q} className={`faq-item${open ? " is-open" : ""}`}>
                        <button
                          type="button"
                          className="faq-q"
                          aria-expanded={open}
                          onClick={() => toggleFaq(i)}
                        >
                          {item.q}
                          <span className="faq-icon" aria-hidden>
                            {open ? <X size={22} strokeWidth={2} /> : <Plus size={22} strokeWidth={2} />}
                          </span>
                        </button>
                        {open ? <p className="faq-a">{item.a}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="inquire" className="section section-inquire">
          <div className="container inquire-grid">
            <div className="inquire-panel">
              <div className="inquire-head">
                <p className="section-label">Inquire</p>
                <h2 className="inquire-title">
                  Ready to bring your next
                  <br />
                  idea to life?
                </h2>
                <p className="inquire-cat-label">Project type</p>
              </div>
              <div className="cat-list">
                <button
                  type="button"
                  className={`cat-card${category === "business" ? " is-active" : ""}`}
                  onClick={() => setCategory("business")}
                >
                  <Briefcase className="cat-icon" size={28} strokeWidth={1.75} />
                  <span className="cat-title">BUSINESS</span>
                  <span className="cat-sub">Select type</span>
                </button>
                <button
                  type="button"
                  className={`cat-card${category === "model3d" ? " is-active" : ""}`}
                  onClick={() => setCategory("model3d")}
                >
                  <Box className="cat-icon" size={28} strokeWidth={1.75} />
                  <span className="cat-title">3D MODEL</span>
                  <span className="cat-sub">Select type</span>
                </button>
                <button
                  type="button"
                  className={`cat-card${category === "capstone" ? " is-active" : ""}`}
                  onClick={() => setCategory("capstone")}
                >
                  <GraduationCap className="cat-icon" size={28} strokeWidth={1.75} />
                  <span className="cat-title">CAPSTONE</span>
                  <span className="cat-sub">Select type</span>
                </button>
              </div>
            </div>

            <div className="inquire-cta inquire-cta-card">
              <div className="sparkle-box" aria-hidden>
                <Sparkles size={22} className="sparkle-icon" strokeWidth={1.75} />
              </div>
              <h3 className="inquire-cta-title">Let&apos;s start your project.</h3>
              <p className="inquire-cta-body">
                Choose <strong>BUSINESS</strong>, <strong>3D MODEL</strong>, or <strong>CAPSTONE</strong> on the
                left so we can align on your project.
                {category ? (
                  <span className="inquire-picked">
                    {" "}
                    Selected: <strong>{categoryLabels[category]}</strong>.
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="inquire-form-wrap">
            <div className="container inquire-modal-cta-inner">
              <p className="section-label inquire-form-kicker">Inquiry form</p>
              <h3 className="inquire-form-heading">Share your details</h3>
              <p className="inquire-form-intro">
                Open the form and walk through a few quick steps. We will follow up using the project
                type you selected above{category ? ` (${categoryLabels[category]})` : ""}.
              </p>
              <button type="button" className="inquiry-open-modal" onClick={openInquiryModal}>
                Open inquiry form
              </button>
            </div>
          </div>
        </section>

        {inquiryModalOpen ? (
          <div
            className="inquiry-modal-root"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inquiry-modal-title"
          >
            <button
              type="button"
              className="inquiry-modal-backdrop"
              aria-label="Close dialog"
              onClick={closeInquiryModal}
            />
            <div className="inquiry-modal-dialog">
              <button
                type="button"
                className="inquiry-modal-x"
                aria-label="Close"
                onClick={closeInquiryModal}
              >
                <X size={20} strokeWidth={2} />
              </button>
              <h3 id="inquiry-modal-title" className="inquiry-modal-title">
                Project inquiry
              </h3>
              <div className="inquiry-modal-progress" aria-hidden>
                {([1, 2, 3] as const).map((n) => (
                  <span
                    key={n}
                    className={`inquiry-modal-dot${inquiryStep >= n ? " is-active" : ""}`}
                  />
                ))}
              </div>

              {inquirySent ? (
                <div className="inquire-form-success inquiry-modal-success" role="status">
                  <p className="inquire-form-success-title">Thanks — we received your inquiry.</p>
                  <p className="inquire-form-success-body">
                    Your details were saved to Firestore in the <strong>inquiries</strong> collection.
                    You can review them in the Firebase console under Firestore → Data.
                  </p>
                  <div className="inquiry-modal-success-actions">
                    <button type="button" className="inquire-form-reset" onClick={startAnotherInquiryInModal}>
                      Submit another inquiry
                    </button>
                    <button type="button" className="inquiry-modal-secondary" onClick={closeInquiryModal}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form className="inquiry-modal-form" onSubmit={onInquiryWizardSubmit} noValidate>
                  {inquiryStep === 1 ? (
                    <div className="inquiry-grid">
                      <label className="inquiry-field">
                        <span className="inquiry-label">Full name</span>
                        <input
                          className="inquiry-input"
                          type="text"
                          name="name"
                          autoComplete="name"
                          value={inquiryName}
                          onChange={(ev) => setInquiryName(ev.target.value)}
                          placeholder="Your name"
                        />
                      </label>
                      <label className="inquiry-field">
                        <span className="inquiry-label">Email</span>
                        <input
                          className="inquiry-input"
                          type="email"
                          name="email"
                          autoComplete="email"
                          value={inquiryEmail}
                          onChange={(ev) => setInquiryEmail(ev.target.value)}
                          placeholder="you@email.com"
                        />
                      </label>
                      <label className="inquiry-field inquiry-field-full">
                        <span className="inquiry-label">Address</span>
                        <input
                          className="inquiry-input"
                          type="text"
                          name="address"
                          autoComplete="street-address"
                          value={inquiryAddress}
                          onChange={(ev) => setInquiryAddress(ev.target.value)}
                          placeholder="City / region or full address"
                        />
                      </label>
                    </div>
                  ) : null}

                  {inquiryStep === 2 ? (
                    <>
                      <fieldset className="inquiry-fieldset">
                        <legend className="inquiry-legend">You are a</legend>
                        <div className="inquiry-segment" role="radiogroup" aria-label="Client type">
                          <button
                            type="button"
                            className={`inquiry-segment-btn${inquiryClientKind === "business" ? " is-on" : ""}`}
                            aria-pressed={inquiryClientKind === "business"}
                            onClick={() => setInquiryClientKind("business")}
                          >
                            Business
                          </button>
                          <button
                            type="button"
                            className={`inquiry-segment-btn${inquiryClientKind === "student" ? " is-on" : ""}`}
                            aria-pressed={inquiryClientKind === "student"}
                            onClick={() => setInquiryClientKind("student")}
                          >
                            Student
                          </button>
                        </div>
                      </fieldset>

                      <fieldset className="inquiry-fieldset">
                        <legend className="inquiry-legend">Interested in</legend>
                        <div className="inquiry-offers">
                          {inquiryOfferOptions.map((o) => (
                            <label key={o.id} className="inquiry-check">
                              <input
                                type="checkbox"
                                checked={inquiryOffers[o.id]}
                                onChange={() => toggleInquiryOffer(o.id)}
                              />
                              <span>{o.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <label className="inquiry-field inquiry-field-full">
                        <span className="inquiry-label">Brief description</span>
                        <textarea
                          className="inquiry-textarea"
                          name="description"
                          rows={4}
                          value={inquiryDescription}
                          onChange={(ev) => setInquiryDescription(ev.target.value)}
                          placeholder="Goals, timeline, budget range, or links…"
                        />
                      </label>
                    </>
                  ) : null}

                  {inquiryStep === 3 ? (
                    <>
                      <div className="inquiry-field inquiry-field-narrow inquiry-field-full">
                        <span className="inquiry-label" id="inquiry-meeting-label">
                          Preferred meeting date
                        </span>
                        <InquiryMeetingDatePicker
                          id="inquiry-meeting-trigger"
                          aria-labelledby="inquiry-meeting-label"
                          value={inquiryMeetingDate}
                          onChange={setInquiryMeetingDate}
                        />
                        <span className="inquiry-hint">Optional — leave blank if you do not have a day yet.</span>
                      </div>

                      <label className="inquiry-consent">
                        <input
                          type="checkbox"
                          checked={inquiryConsent}
                          onChange={(ev) => setInquiryConsent(ev.target.checked)}
                        />
                        <span>
                          I agree to be contacted about this inquiry and confirm the information I provided
                          is accurate.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {inquiryFormError ? (
                    <p className="inquiry-form-error" role="alert">
                      {inquiryFormError}
                    </p>
                  ) : null}

                  <div className="inquiry-modal-footer">
                    {inquiryStep > 1 ? (
                      <button type="button" className="inquiry-modal-secondary" onClick={goInquiryBack}>
                        Back
                      </button>
                    ) : (
                      <span className="inquiry-modal-footer-spacer" aria-hidden />
                    )}
                    <button
                      type="submit"
                      className="inquiry-modal-primary"
                      disabled={inquirySubmitting && inquiryStep === 3}
                    >
                      {inquiryStep < 3 ? "Next" : inquirySubmitting ? "Saving…" : "Submit inquiry"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <a className="footer-brand" href="#home">
            <img src="/OBRATECH.png" alt="Obratech" className="footer-logo" />
          </a>
          <p className="footer-copy">© 2026 All Rights Reserved</p>
        </div>
      </footer>
    </>
  );
}
