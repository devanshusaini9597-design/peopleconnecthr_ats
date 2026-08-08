import React from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export function HomeFooter() {
  return (
      <footer className="border-t border-stone-800 bg-stone-950 text-stone-300 pt-12 sm:pt-16 pb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
        <div className="max-w-7xl mx-auto landing-pad">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10 sm:mb-12">
            <div className="sm:col-span-2">
              <div className="flex items-center space-x-2.5 mb-5 sm:mb-6">
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                  <img src="/logo.png" alt="People Connect HR" className="w-full h-full object-cover" />
                </div>
                <span className="text-xl font-bold text-white">People Connect HR</span>
              </div>
              <p className="text-stone-400 mb-4 sm:mb-6 max-w-sm text-sm sm:text-base">
                The modern applicant tracking system designed for ambitious teams. Hire smarter, scale faster.
              </p>
              <p className="text-stone-500 text-sm">Built for recruiting teams that move fast.</p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-stone-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#video-demo" className="hover:text-white transition-colors">Demo Video</a></li>
                <li><a href="#product-tour" className="hover:text-white transition-colors">Product Tour</a></li>
                <li><a href="#integrations" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="hover:text-white transition-colors">Security</a></li>
                <li><Link to="/features" className="hover:text-white transition-colors">Feature Hub</Link></li>
                <li><Link to="/enterprise" className="hover:text-white transition-colors">Enterprise</Link></li>
                <li><Link to="/trust" className="hover:text-white transition-colors">Trust Center</Link></li>
                <li><Link to="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Get in touch</h4>
              <ul className="space-y-3 text-sm text-stone-400">
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="mailto:sales@skillnix.app" className="hover:text-white transition-colors inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Talk to Sales</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
                <li><Link to="/register" className="hover:text-white transition-colors">Start Free Trial</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-stone-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-stone-500 text-center sm:text-left">
            <p className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
              <span>&copy; {new Date().getFullYear()} SkillNix. All rights reserved.</span>
              <Link to="/privacy" className="hover:text-stone-300">Privacy</Link>
              <Link to="/terms" className="hover:text-stone-300">Terms</Link>
            </p>
            <Link to="/status" className="flex items-center space-x-2 hover:text-stone-300 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>All systems operational</span>
            </Link>
          </div>
        </div>
      </footer>
  );
}
