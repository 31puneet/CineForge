import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown, Check, ShieldCheck } from 'lucide-react';
import strings from '../constants/strings.json';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const AGENT_COLORS: Record<string, string> = {
  'Script Agent': 'bg-orange-700',
  'Character Agent': 'bg-purple-600',
  'Voiceover Agent': 'bg-cyan-600',
  'Video Agent': 'bg-emerald-600',
  'Editor Agent': 'bg-amber-700',
};

export default function LandingPage() {
  const content = strings.landingPage;
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-stone-500 animate-pulse">{strings.common.loading}</div>
      </div>
    );
  }

  // If already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen text-stone-800 font-sans bg-warm-cream">
      {/* ─── Navigation ─── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <img src="/cineforge-logo.jpg" alt="CineForge" className="w-9 h-9 rounded-lg" />
          <span className="text-xl font-bold tracking-tight">{content.nav.logo}</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-medium">
          <a href="#pipeline" className="text-stone-500 hover:text-stone-800 transition-colors">{content.nav.pipeline}</a>
          <a href="#agents" className="text-stone-500 hover:text-stone-800 transition-colors">{content.nav.features}</a>
          <a href="#pricing" className="text-stone-500 hover:text-stone-800 transition-colors">{content.nav.pricing}</a>
          <Link to="/login" className="px-5 py-2 bg-orange-700 text-white rounded-lg hover:bg-orange-800 transition-colors shadow-sm text-sm">
            {content.nav.signIn}
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-24 text-center">
        <h1 className="text-5xl md:text-6xl font-serif font-semibold tracking-tight leading-tight text-stone-800 mb-6 max-w-4xl mx-auto">
          {content.hero.headline}
        </h1>
        <p className="text-lg text-stone-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          {content.hero.subheadline}
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 px-7 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-800 transition-colors shadow-sm font-medium text-base">
          {content.hero.cta} <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ─── Video Circles ─── */}
      <section className="max-w-6xl mx-auto px-8 pb-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-14">
          {content.videos.map((video, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.03 }}
              className="flex flex-col items-center gap-5 group cursor-pointer"
            >
              <div
                className="w-80 h-80 rounded-full flex items-center justify-center overflow-hidden relative video-circle-shadow"
              >
                <video
                  src={video.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-700 video-blur-mask"
                />
              </div>
              <div className="text-center">
                <h3 className="font-semibold text-lg text-stone-800">{video.title}</h3>
                <p className="text-sm text-stone-500 mt-1.5 max-w-[240px] mx-auto">{video.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Section 1: User Journey ─── */}
      <section className="py-24 bg-warm-beige" id="pipeline">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-800 mb-4">{content.journey.title}</h2>
            <p className="text-stone-500 max-w-2xl mx-auto">{content.journey.subtitle}</p>
          </div>

          {/* Pipeline Flow Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {content.journey.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative bg-white rounded-xl p-6 shadow-sm border border-stone-200/60 hover:shadow-md transition-shadow"
              >
                <div className="text-xs font-mono font-bold text-orange-700 mb-3 tracking-wider">STEP {step.step}</div>
                <h3 className="font-semibold text-base text-stone-800 mb-2">{step.label}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{step.description}</p>
                {index < content.journey.steps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5 text-orange-400" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 2: Agentic Workflow ─── */}
      <section className="py-24" id="agents">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-800 mb-4">{content.agents.title}</h2>
            <p className="text-stone-500 max-w-2xl mx-auto">{content.agents.subtitle}</p>
          </div>

          {/* ── Horizontal Pipeline Diagram (SVG) ── */}
          <div className="mb-16 overflow-x-auto">
            <div className="flex items-center justify-center gap-0 min-w-[700px] px-4">
              {content.agents.list.map((agent, index) => {
                const color = AGENT_COLORS[agent.name] || '#C2410C';
                return (
                  <div key={index} className="flex items-center">
                    {/* Agent Node */}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${color}`}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <span className="text-xs font-semibold text-stone-700 text-center max-w-[80px] leading-tight">{agent.name}</span>
                      <span className="text-[10px] font-mono text-stone-400">{agent.role}</span>
                    </div>
                    {/* Arrow Connector + Approval Checkpoint */}
                    {index < content.agents.list.length - 1 && (
                      <div className="flex flex-col items-center mx-3">
                        <div className="flex items-center gap-1">
                          <div className="w-8 h-0.5 bg-stone-300" />
                          <div className="w-6 h-6 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center" title="Human Approval Checkpoint">
                            <ShieldCheck className="w-3 h-3 text-green-600" />
                          </div>
                          <div className="w-8 h-0.5 bg-stone-300" />
                          <ArrowRight className="w-4 h-4 text-stone-400" />
                        </div>
                        <span className="text-[9px] text-green-600 font-medium mt-1">Approval</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Expanded Agent Detail Cards ── */}
          <div className="flex flex-col gap-0 items-center">
            {content.agents.list.map((agent, index) => {
              const color = AGENT_COLORS[agent.name] || '#C2410C';
              return (
                <div key={index} className="w-full max-w-4xl">
                  <motion.div
                    initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-xl shadow-sm border border-stone-200/60 hover:shadow-md transition-shadow overflow-hidden"
                  >
                    {/* Color top bar */}
                    <div className={`h-1 ${color}`} />
                    <div className="p-6">
                      <div className="flex items-start gap-5">
                        {/* Agent Number */}
                        <div className="flex-shrink-0 mt-1">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${color}`}>
                            {String(index + 1).padStart(2, '0')}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1.5">
                            <h3 className="font-semibold text-lg text-stone-800">{agent.name}</h3>
                            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-500">{agent.role}</span>
                          </div>
                          <p className="text-sm text-stone-600 mb-4 leading-relaxed">{agent.description}</p>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 mb-4">
                            <div>
                              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Capabilities</h4>
                              <ul className="space-y-1.5">
                                {agent.details.map((detail, dIndex) => (
                                  <li key={dIndex} className="flex items-start gap-2 text-xs text-stone-600">
                                    <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${color}`} />
                                    {detail}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Your Control</h4>
                              <p className="text-xs text-stone-600 leading-relaxed">{agent.approval}</p>
                              {/* Input → Output */}
                              <div className="flex items-center gap-2 mt-4">
                                <span className="px-2.5 py-1 rounded-md bg-stone-100 text-stone-600 font-medium text-xs">{agent.input}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                <span className={`px-2.5 py-1 rounded-md text-white font-medium text-xs ${color}`}>{agent.output}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Connector Arrow */}
                  {index < content.agents.list.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="w-5 h-5 text-stone-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 3: Project Manager / Asset Management ─── */}
      <section className="py-24 bg-warm-beige">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-800 mb-4">{content.projectManager.title}</h2>
            <p className="text-stone-500 max-w-2xl mx-auto">{content.projectManager.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.projectManager.features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-stone-200/60 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm mb-4">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="font-semibold text-base text-stone-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 4: Pricing ─── */}
      <section className="py-24" id="pricing">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-stone-800 mb-4">{content.pricing.title}</h2>
            <p className="text-stone-500 max-w-xl mx-auto">{content.pricing.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.pricing.plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl p-6 shadow-sm border transition-shadow hover:shadow-md ${
                  plan.highlight
                    ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-stone-200/60 bg-white'
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-mono font-bold text-orange-700 mb-2 tracking-wider">MOST POPULAR</div>
                )}
                <h3 className="text-xl font-semibold text-stone-800 mb-1">{plan.name}</h3>
                <div className="text-2xl font-bold text-stone-800 mb-5">
                  {plan.price}
                  {plan.period && <span className="text-sm font-normal text-stone-400"> {plan.period}</span>}
                </div>
                <ul className="space-y-2.5">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2 text-sm text-stone-600">
                      <Check className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">Pricing details coming soon. All plans are subject to change.</p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-stone-200 py-8 text-center text-stone-400 text-sm bg-warm-cream">
        <p>{content.footer.copyright}</p>
      </footer>
    </div>
  );
}
