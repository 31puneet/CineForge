import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Clapperboard,
  Film,
  Check,
  ShieldCheck,
  Play,
  Volume2,
  RotateCcw,
  Zap,
  FileText,
  Users,
  Mic,
  Video,
  CheckCircle2
} from 'lucide-react';
import strings from '../constants/strings.json';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

interface StudioStage {
  id: string;
  name: string;
  department: string;
  headline: string;
  description: string;
  directorControl: string;
  badges: string[];
  color: string;
  accent: string;
}

export default function LandingPage() {
  const content = strings.landingPage;
  const { user, isLoading } = useAuth();
  const [activeStageId, setActiveStageId] = useState<string>('script');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-stone-500 animate-pulse">{strings.common.loading}</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const stages: StudioStage[] = (content as any).studioStages?.stages || [];
  const currentStage = stages.find((s) => s.id === activeStageId) || stages[0];

  const stageIcons: Record<string, any> = {
    script: FileText,
    characters: Users,
    voice: Mic,
    video: Video,
    editor: Film
  };

  const featureIcons: Record<string, any> = {
    Users,
    ShieldCheck,
    RotateCcw,
    Volume2,
    Zap,
    Sparkles
  };

  return (
    <div className="min-h-screen text-stone-800 font-sans bg-warm-cream selection:bg-orange-200">
      {/* ─── Navigation ─── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-warm-cream/90 border-b border-stone-200/50">
        <div className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-9 h-9 rounded-xl shadow-sm object-cover" />
            <span className="text-xl font-bold tracking-tight text-stone-900">{content.nav.logo}</span>
            <span className="hidden sm:inline-flex items-center text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-mono">
              STUDIO
            </span>
          </div>
          <div className="flex items-center gap-7 text-sm font-medium">
            <a href="#how-it-works" className="text-stone-600 hover:text-stone-900 transition-colors">
              {(content.nav as any).howItWorks || 'How It Works'}
            </a>
            <a href="#studio-stages" className="text-stone-600 hover:text-stone-900 transition-colors">
              {(content.nav as any).studio || 'Studio Stages'}
            </a>
            <a href="#superpowers" className="text-stone-600 hover:text-stone-900 transition-colors">
              {(content.nav as any).features || 'Superpowers'}
            </a>
            <a href="#pricing" className="text-stone-600 hover:text-stone-900 transition-colors">
              {content.nav.pricing}
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-all shadow-sm text-sm font-medium hover:shadow"
            >
              {content.nav.signIn}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-7xl mx-auto px-8 pt-20 pb-20 text-center relative">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100/80 border border-orange-200 text-orange-900 text-xs font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          <span>{(content.hero as any).badge || 'Cinema 2.0 • Screenplay to Master Film in Minutes'}</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] text-stone-900 mb-6 max-w-4xl mx-auto">
          {content.hero.headline}
        </h1>

        <p className="text-lg md:text-xl text-stone-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          {content.hero.subheadline}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-orange-700 text-white rounded-xl hover:bg-orange-800 transition-all shadow-md hover:shadow-lg font-medium text-base hover:-translate-y-0.5 active:translate-y-0"
          >
            {content.hero.cta} <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#studio-stages"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors font-medium text-base shadow-sm"
          >
            <Clapperboard className="w-4 h-4 text-orange-600" /> Tour the Studio
          </a>
        </div>

        <p className="text-xs text-stone-400 mt-5">No film crew required • 100% royalty-free commercial export</p>
      </section>

      {/* ─── Video Circles Showcase ─── */}
      <section className="max-w-6xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {content.videos.map((video, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.03 }}
              className="flex flex-col items-center gap-5 group cursor-pointer"
            >
              <div className="w-72 h-72 rounded-full flex items-center justify-center overflow-hidden relative video-circle-shadow bg-stone-900">
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
                <h3 className="font-semibold text-lg text-stone-900">{video.title}</h3>
                <p className="text-sm text-stone-500 mt-1 max-w-[240px] mx-auto">{video.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Section 1: Creator Journey (3 Simple Beats) ─── */}
      <section className="py-24 bg-warm-beige border-y border-stone-200/60" id="how-it-works">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-700 uppercase tracking-widest block mb-2">
              THE WORKFLOW
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-stone-900 mb-4">{content.journey.title}</h2>
            <p className="text-stone-600 max-w-2xl mx-auto text-base">{content.journey.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {content.journey.steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative bg-white rounded-2xl p-8 shadow-sm border border-stone-200/80 hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center font-mono font-bold text-lg text-orange-800">
                    {step.step}
                  </div>
                  <span className="text-xs font-mono text-stone-400">STAGE 0{index + 1}</span>
                </div>
                <h3 className="font-bold text-xl text-stone-900 mb-3 group-hover:text-orange-700 transition-colors">
                  {step.label}
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 2: Interactive Studio Walkthrough (Replaces Technical Diagram) ─── */}
      <section className="py-24" id="studio-stages">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold text-orange-700 uppercase tracking-widest block mb-2">
              INTERACTIVE STUDIO TOUR
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
              {(content as any).studioStages?.title || 'Five Specialized Studio Departments'}
            </h2>
            <p className="text-stone-600 max-w-2xl mx-auto text-base">
              {(content as any).studioStages?.subtitle ||
                'Click through each stage to explore how CineForge orchestrates the entire filmmaking pipeline.'}
            </p>
          </div>

          {/* Department Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {stages.map((stage) => {
              const Icon = stageIcons[stage.id] || Sparkles;
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageId(stage.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-md scale-105'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200/80 hover:text-stone-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-400' : 'text-stone-500'}`} />
                  <span>{stage.name}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Stage Showcase Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStage.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-3xl border border-stone-200/80 shadow-xl overflow-hidden studio-card-glow"
            >
              {/* Top Accent Gradient Bar */}
              <div className={`h-2 bg-gradient-to-r ${currentStage.color}`} />

              <div className="p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                {/* Left Column: Department Description & Creative Controls */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div>
                    <span className="text-xs font-mono font-bold text-orange-700 tracking-wider uppercase">
                      {currentStage.department}
                    </span>
                    <h3 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 mt-2 mb-4 leading-tight">
                      {currentStage.headline}
                    </h3>
                    <p className="text-stone-600 text-sm leading-relaxed">{currentStage.description}</p>
                  </div>

                  {/* Director's Control Box */}
                  <div className="p-4 rounded-xl bg-warm-cream border border-stone-200/80 flex items-start gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-1">
                        Director's Final Authority
                      </h4>
                      <p className="text-xs text-stone-600 leading-relaxed">{currentStage.directorControl}</p>
                    </div>
                  </div>

                  {/* Feature Badges */}
                  <div className="flex flex-wrap gap-2">
                    {currentStage.badges.map((badge, bIdx) => (
                      <span
                        key={bIdx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right Column: Visual Studio Canvas / Mockup */}
                <div className="lg:col-span-7 bg-stone-950 rounded-2xl p-6 text-stone-200 shadow-inner border border-stone-800 relative overflow-hidden">
                  {/* Studio Header Bar */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500/80" />
                      <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <span className="w-3 h-3 rounded-full bg-green-500/80" />
                      <span className="ml-2 text-xs font-mono text-stone-400">cineforge-studio // {currentStage.id}.view</span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800 text-emerald-400 border border-stone-700">
                      LIVE RENDER
                    </span>
                  </div>

                  {/* Dynamic Studio Canvas per Stage */}
                  {currentStage.id === 'script' && (
                    <div className="space-y-4 font-mono text-xs">
                      <div className="p-3 rounded-lg bg-stone-900 border border-stone-800">
                        <span className="text-orange-400 font-bold block mb-1">SCENE 1: EXT. NEO-TOKYO SKIES - DUSK [ESTABLISHING SHOT]</span>
                        <p className="text-stone-300 leading-relaxed">
                          WIDE CINEMATIC DRONE SHOT — Sleek hovercraft glides between holographic spires. Rain droplets reflect neon amber glow.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/60 ml-4">
                        <div className="flex items-center gap-2 text-stone-400 font-semibold mb-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          <span>SOLARIS (V.O.)</span>
                          <span className="text-[10px] text-stone-500">[Filtered radio transmission]</span>
                        </div>
                        <p className="text-stone-200 italic pl-4 border-l-2 border-orange-500/60">
                          "We built this city on stolen memories... but tonight, the signal cuts through."
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-stone-400">
                        <div className="p-2 rounded bg-stone-900 border border-stone-800 text-center">
                          <span className="block text-stone-500 text-[10px]">DURATION</span>
                          <span className="text-stone-200 font-bold">6.0s (Paced)</span>
                        </div>
                        <div className="p-2 rounded bg-stone-900 border border-stone-800 text-center">
                          <span className="block text-stone-500 text-[10px]">CADENCE</span>
                          <span className="text-emerald-400 font-bold">2.3 words/sec</span>
                        </div>
                        <div className="p-2 rounded bg-stone-900 border border-stone-800 text-center">
                          <span className="block text-stone-500 text-[10px]">ASPECT</span>
                          <span className="text-stone-200 font-bold">16:9 Widescreen</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStage.id === 'characters' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { name: 'Solaris', role: 'Protagonist', img: '/solaris.jpg' },
                          { name: 'Aero', role: 'High-Altitude Courier', img: '/aero.jpg' },
                          { name: 'Malakor', role: 'Obsidian Enforcer', img: '/malakor.jpg' },
                          { name: 'Kira', role: 'Phantom Hacker', img: '/shadow_weaver.jpg' }
                        ].map((c, i) => (
                          <div key={i} className="group relative rounded-xl overflow-hidden border border-stone-800 bg-stone-900">
                            <img src={c.img} alt={c.name} className="w-full h-32 object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                            <div className="p-2 text-center bg-stone-950/90">
                              <div className="text-xs font-semibold text-stone-200">{c.name}</div>
                              <div className="text-[10px] text-stone-400 truncate">{c.role}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 rounded-lg bg-stone-900 border border-stone-800 flex items-center justify-between text-xs font-mono">
                        <span className="flex items-center gap-2 text-purple-400">
                          <ShieldCheck className="w-4 h-4 text-purple-400" />
                          <span>Persistent Character Memory: LOCKED</span>
                        </span>
                        <span className="text-stone-400">Identity Fidelity: 99.4%</span>
                      </div>
                    </div>
                  )}

                  {currentStage.id === 'voice' && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                            <Play className="w-4 h-4 fill-cyan-400" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-stone-200 block">Solaris — Heroic Resonant</span>
                            <span className="text-[11px] text-stone-400">Tone: Deep, gravelly, determined • Pitch +1Hz</span>
                          </div>
                        </div>
                        <div className="flex items-end gap-1 h-7">
                          {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 75, 60, 85].map((h, i) => (
                            <span
                              key={i}
                              style={{ height: `${h}%` }}
                              className="w-1 bg-cyan-400 rounded-full opacity-80"
                            />
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-stone-900/60 border border-stone-800/80 text-xs font-mono space-y-1.5">
                        <div className="flex justify-between text-stone-400 text-[10px]">
                          <span>CALIBRATION: EBU R128 BROADCAST</span>
                          <span className="text-emerald-400 font-bold">-16.0 LUFS (PASSED)</span>
                        </div>
                        <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full w-[78%]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStage.id === 'video' && (
                    <div className="space-y-3">
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-stone-900 border border-stone-800">
                        <video
                          src="/Card_2_Video.mp4"
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-stone-950/80 backdrop-blur-md text-emerald-400 text-xs font-mono flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>SHOT 02: TRACKING // 24 FPS CFR</span>
                        </div>
                        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded bg-stone-950/80 text-stone-400 text-[10px] font-mono">
                          1280x720 • 6.0 SEC
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs font-mono text-stone-400 px-1">
                        <span>Parallel Shading Engine: Active</span>
                        <span className="text-emerald-400 font-semibold">Zero Frame Drops</span>
                      </div>
                    </div>
                  )}

                  {currentStage.id === 'editor' && (
                    <div className="space-y-3 font-mono text-xs">
                      {/* Timeline Tracks */}
                      <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-2 timeline-track-pattern">
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] text-stone-400 font-bold">V1 VIDEO</span>
                          <div className="flex-1 flex gap-1 h-5">
                            <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 1 [6.0s]</span>
                            <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 2 [5.0s]</span>
                            <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 3 [8.0s]</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] text-stone-400 font-bold">A1 VOICE</span>
                          <div className="flex-1 flex gap-1 h-5">
                            <span className="w-[45%] bg-cyan-700/50 rounded text-[9px] flex items-center justify-center text-cyan-200 border border-cyan-500/40">Solaris Dialogue</span>
                            <span className="w-[50%] bg-cyan-700/50 rounded text-[9px] flex items-center justify-center text-cyan-200 border border-cyan-500/40">Malakor Response</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-14 text-[10px] text-stone-400 font-bold">SUBTITLES</span>
                          <div className="flex-1 h-4 bg-purple-900/40 rounded border border-purple-500/30 text-[9px] text-purple-300 flex items-center px-2">
                            ASS Synchronized Subtitle Burn-in
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between text-emerald-400">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          <span>Quality Gate MediaValidator: PASSED</span>
                        </span>
                        <span className="text-[11px] text-emerald-300">0 Freezes • 0 Stutters</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ─── Section 3: Creator Superpowers (Replaces Dry Project Manager Cards) ─── */}
      <section className="py-24 bg-warm-beige border-t border-stone-200/60" id="superpowers">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-700 uppercase tracking-widest block mb-2">
              WHY CREATORS CHOOSE CINEFORGE
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-stone-900 mb-4">
              {(content as any).superpowers?.title || 'Built for Filmmakers Who Want Complete Creative Control'}
            </h2>
            <p className="text-stone-600 max-w-2xl mx-auto text-base">
              {(content as any).superpowers?.subtitle ||
                'Everything you need to produce cinematic content without technical friction.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {((content as any).superpowers?.list || []).map((feature: any, index: number) => {
              const Icon = featureIcons[feature.icon] || Sparkles;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08 }}
                  className="bg-white rounded-2xl p-7 shadow-sm border border-stone-200/80 hover:shadow-md hover:-translate-y-1 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-700 font-bold mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg text-stone-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-stone-600 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 4: Pricing ─── */}
      <section className="py-24" id="pricing">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-700 uppercase tracking-widest block mb-2">
              PRICING PLANS
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-stone-900 mb-4">{content.pricing.title}</h2>
            <p className="text-stone-600 max-w-xl mx-auto text-base">{content.pricing.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.pricing.plans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-2xl p-7 shadow-sm border transition-all hover:shadow-md flex flex-col justify-between ${
                  plan.highlight
                    ? 'border-orange-400 bg-orange-50/50 ring-2 ring-orange-300'
                    : 'border-stone-200/80 bg-white'
                }`}
              >
                <div>
                  {plan.highlight && (
                    <div className="text-[11px] font-mono font-bold text-orange-800 mb-3 tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-orange-200/60 inline-block">
                      MOST POPULAR
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-stone-900 mb-1">{plan.name}</h3>
                  <div className="text-3xl font-extrabold text-stone-900 mb-6">
                    {plan.price}
                    {plan.period && <span className="text-sm font-normal text-stone-500"> {plan.period}</span>}
                  </div>
                  <ul className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2.5 text-sm text-stone-600">
                        <Check className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to="/login"
                  className={`mt-8 w-full py-2.5 rounded-xl font-medium text-sm text-center transition-all ${
                    plan.highlight
                      ? 'bg-orange-700 text-white hover:bg-orange-800 shadow-sm'
                      : 'bg-stone-100 text-stone-800 hover:bg-stone-200'
                  }`}
                >
                  Get Started
                </Link>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">Pricing tiers in beta. Generative usage subject to Fair Use policies.</p>
        </div>
      </section>

      {/* ─── Ready to Direct CTA Banner ─── */}
      <section className="max-w-6xl mx-auto px-8 pb-24">
        <div className="bg-stone-900 text-white rounded-3xl p-10 md:p-14 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Ready to bring your story to life?</h2>
            <p className="text-stone-300 text-base mb-8">
              Join visionary creators, indie filmmakers, and digital storytellers producing high-impact cinema with CineForge.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-orange-700 text-white rounded-xl hover:bg-orange-800 transition-all font-medium text-base shadow-md hover:shadow-lg"
            >
              Start Creating Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-stone-200/80 py-8 text-center text-stone-500 text-sm bg-warm-cream">
        <div className="max-w-6xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-6 h-6 rounded-md object-cover" />
            <span className="font-semibold text-stone-800">{content.nav.logo}</span>
          </div>
          <p>{content.footer.copyright}</p>
          <div className="flex items-center gap-6 text-xs text-stone-400">
            <a href="#how-it-works" className="hover:text-stone-600 transition-colors">Workflow</a>
            <a href="#studio-stages" className="hover:text-stone-600 transition-colors">Studio</a>
            <a href="#pricing" className="hover:text-stone-600 transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
