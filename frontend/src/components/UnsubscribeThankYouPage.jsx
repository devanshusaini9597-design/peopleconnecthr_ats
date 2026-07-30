import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';

const UnsubscribeThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const errorMsg = error ? (error === 'invalid' ? 'Invalid email.' : error === 'invalid_link' ? 'Invalid or expired link.' : error === 'unavailable' ? 'Service temporarily unavailable.' : 'Unsubscribe failed. Please try again.') : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden text-center">
          <div className="p-8">
            {errorMsg ? (
              <>
                <p className="text-red-600 text-sm font-medium mb-4">{errorMsg}</p>
                <Link to="/unsubscribe" className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">Try again</Link>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="w-9 h-9 text-gray-600" />
                </div>
                <h1 className="text-xl font-bold text-gray-900 mb-2">You have been unsubscribed</h1>
                <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                  You have been removed from our mailing list. You will no longer receive marketing emails from Skillnix Recruitment Services.
                </p>
                <p className="text-gray-500 text-xs mt-4">
                  To receive updates again, you can <Link to="/subscribe" className="text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2">subscribe here</Link>.
                </p>
              </>
            )}
          </div>
          <div className="px-6 pb-8 pt-2 border-t border-gray-100">
            <Link to="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-medium text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribeThankYouPage;
