import { useEffect, useState } from "react";
import {
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

const servicesCards = [
  {
    title: "MOBILE APP & WEB APP DEVELOPMENT",
    desc: "Modern, scalable apps built for real-world use — fast UX, clean code, and maintainable architecture.",
    image: "/azauto.png",
  },
  {
    title: "AZ TRAVELS & TOURS",
    desc: "Booking and management system — packages, offers, CRM dashboard, and streamlined admin operations.",
    image: "/aztravel.png",
  },
  {
    title: "IOT DEVICE FABRICATION",
    desc: "Sensor-integrated systems with monitoring and dashboards — from prototype to deployment.",
    image: "/iot.png",
  },
  {
    title: "CUSTOM 3D MODEL & PRINTS",
    desc: "Precision 3D modeling and printing for prototypes, parts, and custom product ideas.",
    image: "/3dmodel.png",
  },
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
    a: "Like and leave a review on our official Facebook page, then send a screenshot when you inquire to receive a 10% discount on your project!",
  },
];

type Category = "business" | "capstone" | "model3d" | null;

const categoryLabels: Record<Exclude<Category, null>, string> = {
  business: "BUSINESS",
  capstone: "CAPSTONE",
  model3d: "3D MODEL",
};

export default function App() {
  const [openFaq, setOpenFaq] = useState<number | null>(3);
  const [category, setCategory] = useState<Category>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeProject, setActiveProject] = useState(0);

  const toggleFaq = (i: number) => {
    setOpenFaq((prev) => (prev === i ? null : i));
  };

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

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
            <a className="nav-inquire" href="#inquire" onClick={() => setMenuOpen(false)}>
              Inquire
            </a>
          </nav>

          <div className="header-actions">
            <a className="btn-accent btn-header" href="#inquire">
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
                <a className="btn-accent" href="#inquire">
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

        <section id="work" className="section section-work bg-mesh">
          <div className="container">
            <div className="work-services-head">
              <p className="section-label services-label">Our Services</p>
              <p className="work-services-subhead">
                Explore what we build — from custom systems to automation. Designed to solve real
                business problems with modern, scalable solutions.
              </p>
            </div>

            <div className="services-grid">
              {servicesCards.map((card) => (
                <article key={card.title} className="service-card">
                  <div className="service-card-media">
                    <img src={card.image} alt={card.title} />
                  </div>
                  <div className="service-card-body">
                    <h3 className="service-card-title">{card.title}</h3>
                    <p className="service-card-desc">{card.desc}</p>
                  </div>
                </article>
              ))}
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
        </section>
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
