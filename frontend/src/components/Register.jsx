import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, Users, Zap } from 'lucide-react';
import API_URL from '../config';

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [apiError, setApiError] = useState('');
    const [isRegistered, setIsRegistered] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const calculateStrength = (password) => {
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };
    const strengthScore = calculateStrength(formData.password);
    const strengthLabels = ['Weak', 'Weak', 'Medium', 'Strong', 'Strong'];
    const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-500'];

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: '' });
        }
        setApiError('');
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = 'Full name is required';
        if (!formData.email.trim()) {
            newErrors.email = 'Work email is required';
        } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/onboarding/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password
                })
            });
            const data = await response.json();

            if (!response.ok) {
                if (data.error === 'email_already_exists') {
                    setApiError('An account with this email already exists.');
                } else {
                    setApiError(data.message || 'Registration failed. Please try again.');
                }
            } else {
                setIsRegistered(true);
            }
        } catch (err) {
            console.error('[Register] fetch error:', err);
            setApiError(err.message ? `Network error: ${err.message}` : 'Network error. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResendLoading(true);
        setResendMessage('');
        try {
            const response = await fetch(`${API_URL}/api/onboarding/resend-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });
            if (response.ok) {
                setResendMessage('Verification email sent successfully.');
            } else {
                setResendMessage('Failed to resend. Please try again.');
            }
        } catch (err) {
            setResendMessage('Network error. Please try again.');
        } finally {
            setResendLoading(false);
        }
    };

    if (isRegistered) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Mail className="w-10 h-10 text-indigo-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Check your email</h2>
                    <p className="text-gray-600 mb-8">
                        We've sent a verification link to <span className="font-semibold text-gray-900">{formData.email}</span>
                    </p>
                    
                    <div className="space-y-4">
                        <button 
                            onClick={handleResend}
                            disabled={resendLoading}
                            className="w-full py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                        >
                            {resendLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Didn't receive it? Resend"}
                        </button>
                        {resendMessage && <p className="text-sm text-indigo-600">{resendMessage}</p>}
                        
                        <Link 
                            to="/login"
                            className="block w-full py-3 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Already verified? Continue to login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">
            {/* Left side - Brand Showcase */}
            <div className="hidden lg:flex lg:w-[60%] bg-gradient-to-br from-indigo-900 to-violet-800 text-white p-12 flex-col justify-between relative overflow-hidden">
                {/* Abstract shapes */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-16">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                            <Zap className="w-6 h-6 text-indigo-600" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">SkillNix</span>
                    </div>
                    
                    <h1 className="text-5xl font-bold leading-tight mb-6">
                        The intelligent ATS for<br/>modern enterprises.
                    </h1>
                    <p className="text-xl text-indigo-200 mb-12 max-w-lg">
                        Streamline your hiring process with our scalable, secure, and intuitive applicant tracking platform.
                    </p>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <Users className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Multi-tenant ATS</h3>
                                <p className="text-indigo-200">Secure data isolation for your organization</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <ShieldCheck className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Role-based access</h3>
                                <p className="text-indigo-200">Granular permissions for your entire team</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                <CheckCircle2 className="w-6 h-6 text-indigo-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">BYOK integrations</h3>
                                <p className="text-indigo-200">Bring your own keys for custom integrations</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-indigo-300 text-sm">
                    © {new Date().getFullYear()} SkillNix Inc. All rights reserved.
                </div>
            </div>

            {/* Right side - Form */}
            <div className="w-full lg:w-[40%] flex items-center justify-center p-8 bg-white overflow-y-auto">
                <div className="w-full max-w-md">
                    <div className="mb-10 text-center lg:text-left">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h2>
                        <p className="text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="text-indigo-600 font-semibold hover:text-indigo-500">
                                Log in
                            </Link>
                        </p>
                    </div>

                    {apiError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{apiError}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.name ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'} focus:ring-4 outline-none transition-all`}
                                placeholder="Jane Doe"
                            />
                            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Work Email *</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'} focus:ring-4 outline-none transition-all`}
                                placeholder="jane@company.com"
                            />
                            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-indigo-200 focus:ring-4 outline-none transition-all"
                                placeholder="+1 (555) 000-0000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2.5 rounded-lg border ${errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'} focus:ring-4 outline-none transition-all pr-12`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
                            
                            {/* Password Strength Meter */}
                            {formData.password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 h-1.5 mb-1">
                                        {[1, 2, 3, 4].map(idx => (
                                            <div 
                                                key={idx} 
                                                className={`flex-1 rounded-full ${strengthScore >= idx ? strengthColors[strengthScore] : 'bg-gray-200'} transition-all`}
                                            />
                                        ))}
                                    </div>
                                    <p className={`text-xs ${strengthScore >= 3 ? 'text-green-600' : strengthScore >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                                        Password strength: {strengthLabels[strengthScore] || 'Weak'}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.confirmPassword ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-200'} focus:ring-4 outline-none transition-all`}
                                placeholder="••••••••"
                            />
                            {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-3 rounded-lg hover:from-indigo-700 hover:to-violet-700 focus:ring-4 focus:ring-indigo-200 transition-all flex items-center justify-center disabled:opacity-70"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-6">
                            By creating an account, you agree to our <a href="#" className="text-indigo-600 hover:underline">Terms of Service</a> and <a href="#" className="text-indigo-600 hover:underline">Privacy Policy</a>
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Register;