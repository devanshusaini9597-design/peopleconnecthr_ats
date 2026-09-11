import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Phone, MessageSquare, MapPin, Clock, Send, CheckCircle2, Building2, Users, Award, ArrowRight, Sparkles } from 'lucide-react';
import { Reveal, Magnetic, fadeUp } from './home/motionPrimitives';

export default function ContactPage() {
  const [contactForm, setContactForm] = useState({
    name: '', email: '', company: '', subject: '', message: '',
  });
  const [formSent, setFormSent] = useState(false);

  const updateForm = (field) => (e) => setContactForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormSent(true);
    // In production, this would send to your backend
  };

  const contactMethods = [
    {
      icon: Mail,
      title: 'Email Us',
      value: 'contact@peopleconnecthr.com',
      description: 'We\'ll respond within 24 hours',
      link: 'mailto:contact@peopleconnecthr.com'
    },
    {
      icon: Phone,
      title: 'Call Us',
      value: '+91 98765 43210',
      description: 'Mon-Fri, 9AM-6PM IST',
      link: 'tel:+919876543210'
    },
    {
      icon: MessageSquare,
      title: 'Live Chat',
      value: 'Available 24/7',
      description: 'Get instant support',
      link: '#chat'
    },
  ];

  const reasons = [
    {
      icon: Building2,
      title: 'Enterprise Solutions',
      description: 'Custom implementations for large organizations'
    },
    {
      icon: Users,
      title: 'Team Onboarding',
      description: 'Dedicated support for team setup and training'
    },
    {
      icon: Award,
      title: 'Partnership Inquiries',
      description: 'Explore collaboration opportunities'
    },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-br from-brand-50/50 via-white to-teal-50/50">
      {/* Premium gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-200/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-200/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-stone-200/80 bg-white/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
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
          <div className="flex items-center gap-3">
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 sm:pt-20 pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-brand-100 to-teal-100 border border-brand-200/50 mb-6">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Get in Touch</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 text-stone-900 tracking-tight">
              Contact Our Team
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-stone-600 leading-relaxed">
              Have questions? We're here to help. Reach out to our team and we'll get back to you within 24 hours.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="relative z-10 pb-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal stagger className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {contactMethods.map((method, i) => {
              const Icon = method.icon;
              return (
                <motion.a
                  key={i}
                  href={method.link}
                  whileHover={{ y: -8 }}
                  className="relative group"
                >
                  <div className="relative bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xl shadow-stone-200/50 overflow-hidden h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative z-10">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shadow-lg shadow-brand-500/30 mb-4"
                      >
                        <Icon className="w-7 h-7 text-white" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-stone-900 mb-2">{method.title}</h3>
                      <p className="text-brand-600 font-semibold mb-2">{method.value}</p>
                      <p className="text-stone-500 text-sm">{method.description}</p>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* Contact Form */}
      <section className="relative z-10 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Form */}
            <Reveal>
              <div className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-stone-200/80 shadow-xl shadow-stone-200/50">
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-6">Send us a message</h2>
                
                {formSent ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-stone-900 mb-2">Message Sent!</h3>
                    <p className="text-stone-600 mb-6">
                      Thank you for reaching out. Our team will get back to you within 24 hours.
                    </p>
                    <button onClick={() => setFormSent(false)} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
                      ← Send another message
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="contact-name" className="block text-sm font-semibold text-stone-700 mb-2">Full Name</label>
                        <input
                          id="contact-name"
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={updateForm('name')}
                          placeholder="John Doe"
                          className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        />
                      </div>
                      <div>
                        <label htmlFor="contact-email" className="block text-sm font-semibold text-stone-700 mb-2">Email Address</label>
                        <input
                          id="contact-email"
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={updateForm('email')}
                          placeholder="john@company.com"
                          className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="contact-company" className="block text-sm font-semibold text-stone-700 mb-2">Company</label>
                      <input
                        id="contact-company"
                        type="text"
                        value={contactForm.company}
                        onChange={updateForm('company')}
                        placeholder="Your Company"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-subject" className="block text-sm font-semibold text-stone-700 mb-2">Subject</label>
                      <select
                        id="contact-subject"
                        value={contactForm.subject}
                        onChange={updateForm('subject')}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      >
                        <option value="">Select a subject</option>
                        <option value="sales">Sales Inquiry</option>
                        <option value="support">Technical Support</option>
                        <option value="partnership">Partnership</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="contact-message" className="block text-sm font-semibold text-stone-700 mb-2">Message</label>
                      <textarea
                        id="contact-message"
                        rows={5}
                        required
                        value={contactForm.message}
                        onChange={updateForm('message')}
                        placeholder="How can we help you?"
                        className="w-full px-4 py-3 rounded-xl border border-stone-200/80 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
                      />
                    </div>
                    <Magnetic strength={0.15} className="w-full block">
                      <button type="submit" className="w-full btn-cta-primary rounded-xl inline-flex items-center justify-center gap-2 !py-4">
                        Send Message
                        <Send className="w-5 h-5" />
                      </button>
                    </Magnetic>
                  </form>
                )}
              </div>
            </Reveal>

            {/* Info */}
            <Reveal className="space-y-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-6">Why contact us?</h2>
                <div className="space-y-4">
                  {reasons.map((reason, i) => {
                    const Icon = reason.icon;
                    return (
                      <motion.div
                        key={i}
                        whileHover={{ x: 8 }}
                        className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-stone-200/80 shadow-sm"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-stone-900 mb-1">{reason.title}</h3>
                          <p className="text-sm text-stone-600">{reason.description}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-gradient-to-br from-brand-50 to-teal-50 rounded-3xl p-6 sm:p-8 border border-brand-100/50">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900 mb-1">Office Hours</h3>
                    <p className="text-sm text-stone-600">Monday - Friday</p>
                    <p className="text-lg font-bold text-brand-700">9:00 AM - 6:00 PM IST</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-stone-900 mb-1">Location</h3>
                    <p className="text-sm text-stone-600">India</p>
                    <p className="text-sm text-stone-600">Serving customers globally</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative z-10 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-brand-600 via-teal-700 to-brand-900 bg-[length:200%_200%] animate-aurora p-8 sm:p-12 lg:p-16 text-center shadow-2xl shadow-brand-500/30">
              <div className="absolute inset-0 landing-dot-grid opacity-20" />
              <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 text-brand-100 text-sm font-semibold mb-6 px-4 py-2 rounded-full bg-white/10 border border-white/15">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Start your free trial today</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-white tracking-tight">
                  Ready to transform your hiring?
                </h2>
                <p className="text-base sm:text-lg text-brand-50/90 mb-8 sm:mb-10 max-w-2xl mx-auto">
                  Join hundreds of forward-thinking companies building their dream teams with People Connect HR.
                </p>
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                  <Magnetic>
                    <Link to="/register" className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-brand-50 text-brand-800 rounded-full font-semibold shadow-lg transition-all">
                      Start Free Trial
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </Magnetic>
                  <Link to="/faq" className="text-brand-100 hover:text-white font-medium transition-colors">
                    View FAQ
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-stone-500">
            <p>&copy; {new Date().getFullYear()} People Connect HR. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-stone-700 transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-stone-700 transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
