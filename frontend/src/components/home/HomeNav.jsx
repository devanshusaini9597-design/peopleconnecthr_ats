import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Magnetic } from './motionPrimitives';
import { NAV_LINKS } from './homeData';

export function HomeNav({
  scrolled,
  mobileMenuOpen,
  setMobileMenuOpen,
  hoveredLink,
  setHoveredLink,
}) {
  return (
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'nav-glass-ats' : 'bg-stone-50/50 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <motion.div
                whileHover={{ rotate: -8, scale: 1.08 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-brand-500/25 ring-1 ring-brand-500/20 flex-shrink-0"
              >
                <img src="/logo.png" alt="People Connect HR" className="w-full h-full object-cover" />
              </motion.div>
              <span className="text-xl font-bold text-stone-900 tracking-tight group-hover:text-brand-800 transition-colors">
                People Connect HR
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.href)}
                  onMouseLeave={() => setHoveredLink(null)}
                  className="relative text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors px-4 py-2 rounded-full"
                >
                  {hoveredLink === link.href && (
                    <motion.span
                      layoutId="nav-hover-pill"
                      className="absolute inset-0 bg-brand-50 border border-brand-100/80 rounded-full -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  {link.label}
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center space-x-2">
              <Link to="/login" className="text-sm font-semibold text-stone-600 hover:text-brand-700 transition-colors px-4 py-2 rounded-xl hover:bg-brand-50/60">
                Login
              </Link>
              <Magnetic strength={0.2}>
                <Link to="/register" className="btn-cta-primary rounded-full px-5 py-2.5 shadow-lg shadow-brand-500/20">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Magnetic>
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-stone-600 hover:text-stone-900 p-2 rounded-xl hover:bg-stone-100 focus:outline-none" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden bg-white/95 backdrop-blur-xl border-t border-stone-100 w-full shadow-lg overflow-hidden"
            >
              <div className="px-4 pt-2 pb-6 space-y-2">
                {NAV_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="block px-3 py-2.5 text-base font-medium text-stone-600 hover:text-brand-700 hover:bg-brand-50/50 rounded-xl transition-colors" onClick={() => setMobileMenuOpen(false)}>
                    {link.label}
                  </a>
                ))}
                <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                  <Link to="/login" className="btn-secondary block w-full text-center rounded-xl">Login</Link>
                  <Link to="/register" className="btn-cta-primary block w-full text-center rounded-xl">Start Free Trial</Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
  );
}
