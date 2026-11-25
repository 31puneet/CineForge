import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring
} from 'framer-motion';
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
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import strings from '../constants/strings.json';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
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

// ─── 3D Physics Tilt Wrapper ───
function InteractiveTiltCard({
  children,
  className = '',
  maxTilt = 6
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 220, damping: 24 });
  const mouseYSpring = useSpring(y, { stiffness: 220, damping: 24 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], [`${maxTilt}deg`, `-${maxTilt}deg`]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], [`-${maxTilt}deg`, `${maxTilt}deg`]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        transformPerspective: 1200
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const content = strings.landingPage;
  const { user, isLoading } = useAuth();
  const [activeStageId, setActiveStageId] = useState<string>('script');
  const { isDark, toggleTheme } = useTheme();

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#08090D]' : 'bg-[#FAF7F2]'}`}>
        <div className="text-stone-400 animate-pulse">{strings.common.loading}</div>
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
    <div
      className={`min-h-screen font-sans selection:bg-orange-500 selection:text-white relative overflow-hidden transition-colors duration-500 ${
        isDark ? 'theme-dark' : 'theme-cream'
      }`}
    >
      {/* Ambient Radial Mesh Glows for 3D Glass Refraction */}
      <div className="glow-orb-orange -top-24 -left-20 orb-drift" />
      <div className="glow-orb-purple top-96 -right-24 orb-drift" style={{ animationDelay: '-5s' }} />
      <div className="glow-orb-cyan top-[1600px] -left-28 orb-drift" style={{ animationDelay: '-10s' }} />
      <div className="glow-orb-orange top-[2400px] -right-24 orb-drift" style={{ animationDelay: '-7s' }} />

      {/* ─── Navigation ─── */}
      <nav
        className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-500 ${
          isDark
            ? 'bg-[#08090D]/85 border-white/10 shadow-lg shadow-black/20'
            : 'bg-[#FAF7F2]/80 border-stone-200/60 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={`p-1 rounded-xl shadow-xs border ${isDark ? 'bg-white/10 border-white/20' : 'bg-white/80 border-white'}`}>
              <img src="/cineforge-logo.jpg" alt="CineForge" className="w-8 h-8 rounded-lg object-cover" />
            </div>
            <span className={`text-xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {content.nav.logo}
            </span>
            <span className={`hidden sm:inline-flex items-center text-[10px] font-semibold tracking-wider uppercase px-2.5 py-0.5 rounded-full font-mono border ${
              isDark
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                : 'bg-orange-100 text-orange-800 border-orange-200'
            }`}>
              STUDIO
            </span>
          </div>

          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#how-it-works" className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'}`}>
              {(content.nav as any).howItWorks || 'How It Works'}
            </a>
            <a href="#studio-stages" className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'}`}>
              {(content.nav as any).studio || 'Studio Stages'}
            </a>
            <a href="#superpowers" className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'}`}>
              {(content.nav as any).features || 'Superpowers'}
            </a>
            <a href="#pricing" className={`transition-colors ${isDark ? 'text-slate-400 hover:text-white' : 'text-stone-600 hover:text-stone-900'}`}>
              {content.nav.pricing}
            </a>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                isDark
                  ? 'bg-white/10 hover:bg-white/15 text-amber-300 border-white/15 shadow-inner'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200/90 shadow-2xs'
              }`}
              title={isDark ? 'Switch to Warm Cream Theme' : 'Switch to Cinema Dark Theme'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                  <span className="font-mono text-[11px] text-amber-200">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-stone-700" />
                  <span className="font-mono text-[11px] text-stone-700">Dark</span>
                </>
              )}
            </button>

            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-500 hover:to-amber-500 transition-all shadow-md shadow-orange-600/20 text-sm font-medium hover:scale-102 active:scale-98"
            >
              {content.nav.signIn}
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="max-w-7xl mx-auto px-8 pt-24 pb-20 text-center relative z-10">
        {/* Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 border transition-all ${
            isDark
              ? 'glass-panel text-orange-400 border-orange-500/30'
              : 'glass-panel text-stone-800 border-orange-200 bg-orange-100/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>{(content.hero as any).badge || 'Cinema 2.0 • Screenplay to Master Film in Minutes'}</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={`text-5xl md:text-7xl font-serif font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl mx-auto ${
            isDark ? 'text-white' : 'text-stone-900'
          }`}
        >
          {content.hero.headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className={`text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-stone-600'
          }`}
        >
          {content.hero.subheadline}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl hover:from-orange-500 hover:to-amber-500 transition-all shadow-xl shadow-orange-600/25 font-medium text-base hover:-translate-y-0.5 active:translate-y-0 border border-orange-400/30"
          >
            {content.hero.cta} <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#studio-stages"
            className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl transition-all font-medium text-base border ${
              isDark
                ? 'glass-panel text-slate-200 hover:bg-white/10 border-white/15'
                : 'glass-panel text-stone-800 hover:bg-white border-white/90 shadow-2xs'
            }`}
          >
            <Clapperboard className="w-4 h-4 text-orange-500" /> Tour the Studio
          </a>
        </motion.div>

        <p className="text-xs text-stone-400 mt-5">No film crew required • 100% royalty-free commercial export</p>
      </section>

      {/* ─── Video Circles Showcase ─── */}
      <section className="max-w-6xl mx-auto px-8 pb-24 relative z-10 perspective-container">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {content.videos.map((video, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.05, rotateY: index === 0 ? 4 : index === 2 ? -4 : 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-5 group cursor-pointer preserve-3d"
            >
              <div
                className={`w-72 h-72 rounded-full flex items-center justify-center overflow-hidden relative video-circle-shadow border-2 transition-colors duration-500 ${
                  isDark ? 'bg-black border-white/20 group-hover:border-orange-500/80' : 'bg-stone-900 border-white/80 group-hover:border-orange-300'
                }`}
              >
                <video
                  src={video.src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover pointer-events-none group-hover:scale-108 transition-transform duration-700 video-blur-mask"
                />
              </div>
              <div className="text-center translate-z-20">
                <h3 className={`font-semibold text-lg group-hover:text-orange-500 transition-colors ${
                  isDark ? 'text-white' : 'text-stone-900'
                }`}>
                  {video.title}
                </h3>
                <p className={`text-sm mt-1 max-w-[240px] mx-auto ${isDark ? 'text-slate-400' : 'text-stone-500'}`}>
                  {video.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Section 1: Creator Journey (3D Glass Cards) ─── */}
      <section
        className={`py-24 relative z-10 border-y transition-colors duration-500 ${
          isDark ? 'bg-[#0F121C]/60 border-white/10' : 'bg-[#F5F0E8] border-stone-200/60'
        }`}
        id="how-it-works"
      >
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-500 uppercase tracking-widest block mb-2">
              THE WORKFLOW
            </span>
            <h2 className={`text-3xl md:text-5xl font-serif font-bold mb-4 ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {content.journey.title}
            </h2>
            <p className={`max-w-2xl mx-auto text-base ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
              {content.journey.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 perspective-container">
            {content.journey.steps.map((step, index) => (
              <InteractiveTiltCard key={index} maxTilt={8} className="h-full">
                <div
                  className={`glass-panel rounded-3xl p-8 border relative group h-full flex flex-col justify-between preserve-3d shadow-xl hover:shadow-2xl transition-all duration-300 ${
                    isDark ? 'border-white/10 hover:border-orange-500/40' : 'border-white/90 hover:border-orange-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-6 translate-z-30">
                      <div className="w-13 h-13 rounded-2xl bg-orange-500/20 border border-orange-500/30 text-orange-500 flex items-center justify-center font-mono font-bold text-xl shadow-xs group-hover:scale-110 transition-transform">
                        {step.step}
                      </div>
                      <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${
                        isDark ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-stone-100 text-stone-500 border-stone-200/60'
                      }`}>
                        STAGE 0{index + 1}
                      </span>
                    </div>
                    <h3 className={`font-bold text-xl mb-3 group-hover:text-orange-500 transition-colors translate-z-20 ${
                      isDark ? 'text-white' : 'text-stone-900'
                    }`}>
                      {step.label}
                    </h3>
                    <p className={`text-sm leading-relaxed translate-z-10 ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </InteractiveTiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 2: Interactive Studio Walkthrough (3D Holographic Stage) ─── */}
      <section className="py-24 relative z-10" id="studio-stages">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-mono font-bold text-orange-500 uppercase tracking-widest block mb-2">
              INTERACTIVE STUDIO TOUR
            </span>
            <h2 className={`text-3xl md:text-5xl font-serif font-bold mb-4 ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {(content as any).studioStages?.title || 'Five Specialized Studio Departments'}
            </h2>
            <p className={`max-w-2xl mx-auto text-base ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
              {(content as any).studioStages?.subtitle ||
                'Click through each stage to explore how CineForge orchestrates the entire filmmaking pipeline.'}
            </p>
          </div>

          {/* Department Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-10">
            {stages.map((stage) => {
              const Icon = stageIcons[stage.id] || Sparkles;
              const isActive = stage.id === activeStageId;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStageId(stage.id)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-medium text-sm transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-600/30 scale-105 border-orange-400/40'
                      : isDark
                      ? 'glass-panel text-slate-400 hover:text-white hover:bg-white/10 border-white/10'
                      : 'glass-panel text-stone-600 hover:text-stone-900 hover:bg-white border-white/90 shadow-2xs'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-orange-500'}`} />
                  <span>{stage.name}</span>
                </button>
              );
            })}
          </div>

          {/* 3D Holographic Flip Canvas on Stage Switch */}
          <div className="perspective-container">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage.id}
                initial={{ opacity: 0, rotateY: -12, scale: 0.97 }}
                animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                exit={{ opacity: 0, rotateY: 12, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                style={{ transformStyle: 'preserve-3d', transformPerspective: 1200 }}
              >
                <InteractiveTiltCard maxTilt={5}>
                  <div className={`glass-panel rounded-3xl border shadow-2xl overflow-hidden preserve-3d ${
                    isDark ? 'border-white/15' : 'border-white/95'
                  }`}>
                    {/* Top Accent Gradient Bar */}
                    <div className={`h-2 bg-gradient-to-r ${currentStage.color}`} />

                    <div className="p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                      {/* Left Column: Department Description & Creative Controls */}
                      <div className="lg:col-span-5 flex flex-col gap-6 translate-z-20">
                        <div>
                          <span className="text-xs font-mono font-bold text-orange-500 tracking-wider uppercase">
                            {currentStage.department}
                          </span>
                          <h3 className={`text-2xl md:text-3xl font-serif font-bold mt-2 mb-4 leading-tight ${
                            isDark ? 'text-white' : 'text-stone-900'
                          }`}>
                            {currentStage.headline}
                          </h3>
                          <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
                            {currentStage.description}
                          </p>
                        </div>

                        {/* Director's Control Box */}
                        <div className={`p-4 rounded-2xl flex items-start gap-3.5 translate-z-30 border ${
                          isDark
                            ? 'glass-badge-dark border-orange-500/30'
                            : 'bg-orange-50/80 border-orange-200 text-stone-800'
                        }`}>
                          <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5 border border-orange-400/40">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                              Director's Final Authority
                            </h4>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
                              {currentStage.directorControl}
                            </p>
                          </div>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-2 translate-z-10">
                          {currentStage.badges.map((badge, bIdx) => (
                            <span
                              key={bIdx}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                                isDark
                                  ? 'glass-badge-dark text-slate-300 border-white/10'
                                  : 'bg-white text-stone-700 border-stone-200/80 shadow-2xs'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right Column: 3D Dark Glass Studio Canvas */}
                      <div className="lg:col-span-7 glass-panel-dark rounded-3xl p-6 text-slate-200 relative overflow-hidden translate-z-40 shadow-2xl border border-white/15">
                        {/* Studio Header Bar */}
                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-red-500/80 shadow-xs" />
                            <span className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-xs" />
                            <span className="w-3 h-3 rounded-full bg-green-500/80 shadow-xs" />
                            <span className="ml-2 text-xs font-mono text-slate-400">cineforge-studio // {currentStage.id}.view</span>
                          </div>
                          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full glass-badge-dark text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>LIVE RENDER</span>
                          </span>
                        </div>

                        {/* Dynamic Studio Canvas Content */}
                        {currentStage.id === 'script' && (
                          <div className="space-y-4 font-mono text-xs">
                            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                              <span className="text-orange-400 font-bold block mb-1">SCENE 1: EXT. NEO-TOKYO SKIES - DUSK [ESTABLISHING SHOT]</span>
                              <p className="text-slate-300 leading-relaxed">
                                WIDE CINEMATIC DRONE SHOT — Sleek hovercraft glides between holographic spires. Rain droplets reflect neon amber glow.
                              </p>
                            </div>
                            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 ml-4">
                              <div className="flex items-center gap-2 text-slate-400 font-semibold mb-1">
                                <span className="w-2 h-2 rounded-full bg-orange-500" />
                                <span>SOLARIS (V.O.)</span>
                                <span className="text-[10px] text-slate-500">[Filtered radio transmission]</span>
                              </div>
                              <p className="text-slate-200 italic pl-4 border-l-2 border-orange-500/60">
                                "We built this city on stolen memories... but tonight, the signal cuts through."
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2 text-[11px] text-slate-400">
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                                <span className="block text-slate-500 text-[10px]">DURATION</span>
                                <span className="text-white font-bold">6.0s (Paced)</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                                <span className="block text-slate-500 text-[10px]">CADENCE</span>
                                <span className="text-emerald-400 font-bold">2.3 words/sec</span>
                              </div>
                              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center">
                                <span className="block text-slate-500 text-[10px]">ASPECT</span>
                                <span className="text-white font-bold">16:9 Widescreen</span>
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
                                <div key={i} className="group relative rounded-2xl overflow-hidden border border-white/15 bg-white/5 hover:border-orange-400/80 transition-colors">
                                  <img src={c.img} alt={c.name} className="w-full h-32 object-cover object-top group-hover:scale-108 transition-transform duration-500" />
                                  <div className="p-2 text-center bg-black/80 backdrop-blur-md">
                                    <div className="text-xs font-semibold text-white">{c.name}</div>
                                    <div className="text-[10px] text-slate-400 truncate">{c.role}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono">
                              <span className="flex items-center gap-2 text-purple-400">
                                <ShieldCheck className="w-4 h-4 text-purple-400" />
                                <span>Persistent Character Memory: LOCKED</span>
                              </span>
                              <span className="text-slate-400">Identity Fidelity: 99.4%</span>
                            </div>
                          </div>
                        )}

                        {currentStage.id === 'voice' && (
                          <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 shadow-xs">
                                  <Play className="w-4 h-4 fill-cyan-400" />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white block">Solaris — Heroic Resonant</span>
                                  <span className="text-[11px] text-slate-400">Tone: Deep, gravelly, determined • Pitch +1Hz</span>
                                </div>
                              </div>
                              <div className="flex items-end gap-1 h-8">
                                {[35, 75, 40, 95, 60, 100, 45, 85, 50, 95, 30, 80, 65, 90, 40, 70].map((h, i) => (
                                  <motion.span
                                    key={i}
                                    animate={{ height: [`${h * 0.4}%`, `${h}%`, `${h * 0.4}%`] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.08, ease: 'easeInOut' }}
                                    className="w-1 bg-gradient-to-t from-cyan-500 to-cyan-300 rounded-full opacity-85"
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono space-y-1.5">
                              <div className="flex justify-between text-slate-400 text-[10px]">
                                <span>CALIBRATION: EBU R128 BROADCAST</span>
                                <span className="text-emerald-400 font-bold">-16.0 LUFS (PASSED)</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full w-[78%]" />
                              </div>
                            </div>
                          </div>
                        )}

                        {currentStage.id === 'video' && (
                          <div className="space-y-3">
                            <div className="relative rounded-2xl overflow-hidden aspect-video bg-black/60 border border-white/15 shadow-xl">
                              <video
                                src="/Card_2_Video.mp4"
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-3 left-3 px-3 py-1 rounded-full glass-badge-dark text-emerald-400 text-xs font-mono flex items-center gap-1.5 border border-emerald-500/40 shadow-md">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>SHOT 02: TRACKING // 24 FPS CFR</span>
                              </div>
                              <div className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full glass-badge-dark text-slate-300 text-[10px] font-mono border border-white/10">
                                1280x720 • 6.0 SEC
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                              <span>Parallel Shading Engine: Active</span>
                              <span className="text-emerald-400 font-semibold">Zero Frame Drops</span>
                            </div>
                          </div>
                        )}

                        {currentStage.id === 'editor' && (
                          <div className="space-y-3 font-mono text-xs">
                            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 timeline-track-pattern">
                              <div className="flex items-center gap-2">
                                <span className="w-14 text-[10px] text-slate-400 font-bold">V1 VIDEO</span>
                                <div className="flex-1 flex gap-1 h-5">
                                  <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 1 [6.0s]</span>
                                  <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 2 [5.0s]</span>
                                  <span className="flex-1 bg-amber-700/60 rounded text-[9px] flex items-center justify-center text-amber-200 border border-amber-500/40">Shot 3 [8.0s]</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="w-14 text-[10px] text-slate-400 font-bold">A1 VOICE</span>
                                <div className="flex-1 flex gap-1 h-5">
                                  <span className="w-[45%] bg-cyan-700/50 rounded text-[9px] flex items-center justify-center text-cyan-200 border border-cyan-500/40">Solaris Dialogue</span>
                                  <span className="w-[50%] bg-cyan-700/50 rounded text-[9px] flex items-center justify-center text-cyan-200 border border-cyan-500/40">Malakor Response</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="w-14 text-[10px] text-slate-400 font-bold">SUBTITLES</span>
                                <div className="flex-1 h-4 bg-purple-900/40 rounded border border-purple-500/30 text-[9px] text-purple-300 flex items-center px-2">
                                  ASS Synchronized Subtitle Burn-in
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-emerald-400">
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
                  </div>
                </InteractiveTiltCard>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ─── Section 3: Creator Superpowers (3D Glass Bento Grid) ─── */}
      <section className="py-24 relative z-10" id="superpowers">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-500 uppercase tracking-widest block mb-2">
              WHY CREATORS CHOOSE CINEFORGE
            </span>
            <h2 className={`text-3xl md:text-5xl font-serif font-bold mb-4 ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {(content as any).superpowers?.title || 'Built for Filmmakers Who Want Complete Creative Control'}
            </h2>
            <p className={`max-w-2xl mx-auto text-base ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
              {(content as any).superpowers?.subtitle ||
                'Everything you need to produce cinematic content without technical friction.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-container">
            {((content as any).superpowers?.list || []).map((feature: any, index: number) => {
              const Icon = featureIcons[feature.icon] || Sparkles;
              return (
                <InteractiveTiltCard key={index} maxTilt={6} className="h-full">
                  <div
                    className={`glass-panel rounded-3xl p-7 border shadow-xl hover:shadow-2xl transition-all duration-300 group h-full flex flex-col justify-between preserve-3d ${
                      isDark ? 'border-white/10 hover:border-orange-500/40' : 'border-white/90 hover:border-orange-300'
                    }`}
                  >
                    <div>
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 font-bold mb-5 group-hover:scale-115 transition-transform shadow-xs translate-z-30">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3 className={`font-bold text-lg mb-2 translate-z-20 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                        {feature.title}
                      </h3>
                      <p className={`text-sm leading-relaxed translate-z-10 ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </InteractiveTiltCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 4: Pricing (Glassmorphic Cards) ─── */}
      <section className="py-24 relative z-10" id="pricing">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-mono font-bold text-orange-500 uppercase tracking-widest block mb-2">
              PRICING PLANS
            </span>
            <h2 className={`text-3xl md:text-5xl font-serif font-bold mb-4 ${isDark ? 'text-white' : 'text-stone-900'}`}>
              {content.pricing.title}
            </h2>
            <p className={`max-w-xl mx-auto text-base ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
              {content.pricing.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-container">
            {content.pricing.plans.map((plan, index) => (
              <InteractiveTiltCard key={index} maxTilt={6} className="h-full">
                <div
                  className={`rounded-3xl p-7 transition-all flex flex-col justify-between h-full preserve-3d ${
                    plan.highlight
                      ? isDark
                        ? 'bg-gradient-to-b from-orange-500/20 via-slate-900/80 to-slate-950/90 border-2 border-orange-500 shadow-2xl shadow-orange-500/20 ring-2 ring-orange-500/30 backdrop-blur-xl'
                        : 'bg-gradient-to-b from-orange-50/95 to-amber-50/85 border-2 border-orange-400 shadow-xl ring-2 ring-orange-200 backdrop-blur-xl'
                      : isDark
                      ? 'glass-panel border border-white/10 shadow-lg hover:shadow-2xl hover:border-white/20'
                      : 'glass-panel border border-white/90 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div>
                    {plan.highlight && (
                      <div className="text-[11px] font-mono font-bold text-orange-500 mb-3 tracking-wider uppercase px-3 py-1 rounded-full bg-orange-500/20 inline-block border border-orange-500/40 translate-z-20">
                        MOST POPULAR
                      </div>
                    )}
                    <h3 className={`text-xl font-bold mb-1 translate-z-20 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                      {plan.name}
                    </h3>
                    <div className={`text-3xl font-extrabold mb-6 translate-z-20 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                      {plan.price}
                      {plan.period && <span className="text-sm font-normal text-stone-400"> {plan.period}</span>}
                    </div>
                    <ul className="space-y-3 translate-z-10">
                      {plan.features.map((feature, fIndex) => (
                        <li key={fIndex} className={`flex items-start gap-2.5 text-sm ${isDark ? 'text-slate-300' : 'text-stone-600'}`}>
                          <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link
                    to="/login"
                    className={`mt-8 w-full py-3 rounded-2xl font-medium text-sm text-center transition-all translate-z-20 ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-500 hover:to-amber-500 shadow-md shadow-orange-600/30 hover:scale-102'
                        : isDark
                        ? 'bg-white/10 text-white hover:bg-white/15 hover:scale-102'
                        : 'bg-stone-900/10 text-stone-800 hover:bg-stone-900/20 hover:scale-102'
                    }`}
                  >
                    Get Started
                  </Link>
                </div>
              </InteractiveTiltCard>
            ))}
          </div>
          <p className="text-center text-xs text-stone-400 mt-8">Pricing tiers in beta. Generative usage subject to Fair Use policies.</p>
        </div>
      </section>

      {/* ─── Ready to Direct CTA Banner ─── */}
      <section className="max-w-6xl mx-auto px-8 pb-24 relative z-10 perspective-container">
        <InteractiveTiltCard maxTilt={4}>
          <div className="glass-panel-dark text-white rounded-3xl p-10 md:p-14 text-center relative overflow-hidden shadow-2xl border border-orange-500/30 shadow-orange-500/10 preserve-3d">
            <div className="relative z-10 max-w-2xl mx-auto translate-z-20">
              <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">Ready to bring your story to life?</h2>
              <p className="text-slate-300 text-base mb-8">
                Join visionary creators, indie filmmakers, and digital storytellers producing high-impact cinema with CineForge.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-2xl hover:from-orange-500 hover:to-amber-500 transition-all font-medium text-base shadow-xl shadow-orange-600/25 hover:scale-104 border border-orange-400/40"
              >
                Start Creating Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </InteractiveTiltCard>
      </section>

      {/* ─── Footer ─── */}
      <footer
        className={`border-t py-8 text-center text-sm backdrop-blur-md relative z-10 transition-colors duration-500 ${
          isDark ? 'bg-black/80 border-white/10 text-slate-500' : 'bg-[#FAF7F2]/90 border-stone-200/80 text-stone-500'
        }`}
      >
        <div className="max-w-6xl mx-auto px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/cineforge-logo.jpg" alt="CineForge" className="w-6 h-6 rounded-md object-cover" />
            <span className={`font-semibold ${isDark ? 'text-slate-300' : 'text-stone-800'}`}>{content.nav.logo}</span>
          </div>
          <p>{content.footer.copyright}</p>
          <div className="flex items-center gap-6 text-xs text-stone-400">
            <a href="#how-it-works" className="hover:text-stone-200 transition-colors">Workflow</a>
            <a href="#studio-stages" className="hover:text-stone-200 transition-colors">Studio</a>
            <a href="#pricing" className="hover:text-stone-200 transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
